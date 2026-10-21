"""Accès à la base : SQLite en développement, PostgreSQL en production.

Une seule écriture du SQL (paramètres « ? »), traduite pour PostgreSQL.
Le schéma (`schema.sql`) est écrit dans un sous-ensemble commun ; les rares
différences (clés auto-incrémentées, déclencheurs) sont posées ici, par moteur.

Migrations : ADDITIVES uniquement (`ALTER TABLE … ADD COLUMN`), jamais de
suppression. Le schéma est appliqué AVANT que le serveur n'accepte une
requête : un déploiement échoue plutôt que d'exposer une API sans son schéma.
"""
import os
from decimal import Decimal
from datetime import datetime, timezone
import re
import sqlite3
import threading

import config

VERSION_SCHEMA = 13   # v13 (21/10/2026) : avis sur les livres ; v12 (21/10/2026) : charte de la communauté ; v11 (21/10/2026) : corbeille et retrait des livres, réponses, e-mail ; v10 : écrits ; v9 (19/10/2026) : cadeaux (dons) ; v8 : apparence, couvertures, épingles, relectures IA
_verrou = threading.Lock()


def _propre(ligne):
    """PostgreSQL rend SUM() d'entiers en `Decimal` ; SQLite, en entier. Flask
    sérialisait le premier en TEXTE (« 510 » au lieu de 510) : soldes et
    revenus changeaient de type selon le moteur (constaté le 16/10/2026). Les
    montants sont des centimes entiers : un Decimal entier redevient un int."""
    d = dict(ligne)
    for k, val in d.items():
        if isinstance(val, Decimal):
            d[k] = int(val) if val == val.to_integral_value() else float(val)
    return d


class Connexion:
    """Enveloppe minimale commune aux deux moteurs."""

    def __init__(self, brute, moteur, contexte=None):
        self.brute = brute
        self.moteur = moteur
        # PostgreSQL : (rôle, app.user_id, app.global), reposés au début de
        # CHAQUE transaction — voir _poser_contexte.
        self.contexte = contexte
        self._pose = False

    def _poser_contexte(self):
        """Pose le rôle et l'identité DANS la transaction (SET LOCAL,
        set_config(…, true)), et de nouveau après chaque validation.

        Pourquoi : derrière un pooler en mode transaction (Supavisor, port
        6543), chaque transaction peut partir sur une autre connexion serveur.
        Posés une fois pour la session, le rôle et `app.user_id` restaient sur
        une connexion pendant que les requêtes tournaient sur une autre, réglée
        pour quelqu'un d'autre : 12 transactions sur 12 avec une identité
        fausse, des lecteurs privés de leurs pages achetées, la RLS sans effet
        (reproduit le 16/10/2026, tests/test_pooler.py). Local à la
        transaction, le contexte ne peut ni lui survivre ni passer à autrui."""
        role, uid, glob = self.contexte
        cur = self.brute.cursor()
        if role:
            cur.execute(f"SET LOCAL ROLE {role}")
        # search_path aussi : un pooler ne transmet pas toujours les options
        # de démarrage d'un client aux connexions serveur qu'il partage.
        cur.execute("SELECT set_config('app.user_id', %s, true), set_config('app.global', %s, true), set_config('search_path', %s, true)",
                    (uid, glob, config.schema_postgres()))
        self._pose = True

    def _sql(self, sql):
        if self.moteur == "postgres":
            # « ? » → « %s » ; un « % » littéral doit être doublé pour psycopg
            return sql.replace("%", "%%").replace("?", "%s")
        return sql

    def execute(self, sql, params=()):
        if self.contexte is not None and not self._pose:
            self._poser_contexte()
        cur = self.brute.cursor()
        cur.execute(self._sql(sql), tuple(params))
        return cur

    def un(self, sql, params=()):
        ligne = self.execute(sql, params).fetchone()
        return _propre(ligne) if ligne is not None else None

    def tous(self, sql, params=()):
        return [_propre(l) for l in self.execute(sql, params).fetchall()]

    def inserer(self, sql, params=()):
        """INSERT qui rend l'identifiant créé, sur les deux moteurs."""
        if self.moteur == "postgres":
            return self.execute(sql + " RETURNING id", params).fetchone()["id"]
        return self.execute(sql, params).lastrowid

    def valider(self):
        self.brute.commit()
        self._pose = False

    def annuler(self):
        self.brute.rollback()
        self._pose = False

    def fermer(self):
        self.brute.close()

    def poser_utilisateur(self, user_id):
        """Contexte de la Row Level Security (PostgreSQL, étape 3) : une
        connexion dont l'utilisateur n'est pas posé ne voit aucune ligne privée."""
        if self.moteur == "postgres":
            role, _, glob = self.contexte
            self.contexte = (role, str(user_id or ""), glob)
            if self._pose:
                self.brute.cursor().execute("SELECT set_config('app.user_id', %s, true)", (self.contexte[1],))


def _contexte():
    """(user_id, globale) d'après la requête en cours : l'administration agit
    en connexion GLOBALE, une personne connectée sur ses seules lignes."""
    try:
        from flask import g, has_request_context
        if not has_request_context():
            return None, False
        if getattr(g, "admin", None):
            return None, True
        u = getattr(g, "user", None)
        return (u["id"] if u else None), False
    except Exception:
        return None, False


def connecter(globale=False):
    """Ouvre une connexion. Sous PostgreSQL, la Row Level Security filtre les
    tables privées sur `app.user_id` ; `globale=True` (administration,
    webhooks, agrégats publics) est rare, explicite, et se voit dans le code."""
    m = config.moteur()
    if m == "sqlite":
        brute = sqlite3.connect(config.chemin_sqlite(), timeout=10)
        brute.row_factory = sqlite3.Row
        brute.execute("PRAGMA foreign_keys = ON")
        brute.execute("PRAGMA journal_mode = WAL")
        return Connexion(brute, m)
    import psycopg
    from psycopg.rows import dict_row
    role = os.environ.get("SOZO_PG_ROLE", "")
    if role and not role.replace("_", "").isalnum():
        raise RuntimeError("SOZO_PG_ROLE invalide.")
    # prepare_threshold=None : pas de requêtes préparées nommées. Une connexion
    # serveur resservie par un pooler les garde : « prepared statement _pg3_0
    # already exists », 13 erreurs 500 sur 320 requêtes (16/10/2026).
    brute = psycopg.connect(config.url_postgres(), row_factory=dict_row, autocommit=False, prepare_threshold=None,
                            options=f"-c search_path={config.schema_postgres()}")
    uid, glob = _contexte()
    # Rôle applicatif SANS BYPASSRLS (la base applique les politiques) et
    # identité : posés dans chaque transaction, jamais dans la session.
    return Connexion(brute, m, (role, str(uid) if uid else "", "1" if (globale or glob) else ""))


# ---------------------------------------------------------------------------
# Schéma
# ---------------------------------------------------------------------------

def _instructions(texte):
    texte = re.sub(r"--[^\n]*", "", texte)
    return [s.strip() for s in texte.split(";") if s.strip()]


def _traduire(ddl, moteur):
    if moteur == "postgres":
        ddl = ddl.replace("INTEGER PRIMARY KEY AUTOINCREMENT", "BIGSERIAL PRIMARY KEY")
        ddl = ddl.replace(" BLOB", " BYTEA")
    return ddl


# Le journal d'audit ne se modifie ni ne se supprime — ni par l'application,
# ni par une erreur de code : la base elle-même refuse.
_AUDIT_IMMUABLE = {
    "sqlite": [
        """CREATE TRIGGER IF NOT EXISTS audit_sans_modification BEFORE UPDATE ON audit_log
           BEGIN SELECT RAISE(ABORT, 'journal d''audit immuable'); END""",
        """CREATE TRIGGER IF NOT EXISTS audit_sans_suppression BEFORE DELETE ON audit_log
           BEGIN SELECT RAISE(ABORT, 'journal d''audit immuable'); END""",
    ],
    "postgres": [
        """CREATE OR REPLACE FUNCTION audit_immuable() RETURNS trigger AS $$
           BEGIN RAISE EXCEPTION 'journal d''audit immuable'; END; $$ LANGUAGE plpgsql""",
        """DROP TRIGGER IF EXISTS audit_sans_modification ON audit_log""",
        """CREATE TRIGGER audit_sans_modification BEFORE UPDATE OR DELETE ON audit_log
           FOR EACH ROW EXECUTE FUNCTION audit_immuable()""",
    ],
}


# ── Row Level Security (PostgreSQL) ───────────────────────────────────────
# Défense en profondeur : même si une requête oubliait son filtre, la base ne
# rend que les lignes de la personne posée dans `app.user_id`. FORCE : la
# règle s'applique aussi au propriétaire des tables. Une connexion sans
# contexte ne voit RIEN. Tables d'authentification (users, sessions, jetons)
# hors RLS : il faut les lire AVANT de savoir qui parle.
_MOI = "NULLIF(current_setting('app.user_id', true), '')::bigint"
_GLOBALE = "current_setting('app.global', true) = '1'"
_MES_LIVRES = f"(SELECT id FROM books WHERE owner_id = {_MOI})"
_MES_ECRITS = f"(SELECT id FROM ecrits WHERE user_id = {_MOI})"
_ECRITS_PUBLICS = "ecrit_id IN (SELECT id FROM ecrits WHERE statut = 'publie' AND corbeille_le IS NULL AND retire_le IS NULL)"
RLS = {
    "follows": f"user_id = {_MOI} OR book_id IN {_MES_LIVRES}",
    "progress": f"user_id = {_MOI}",
    "payments": f"user_id = {_MOI} OR book_id IN {_MES_LIVRES}",
    "entitlements": f"user_id = {_MOI}",
    "receipts": f"user_id = {_MOI}",
    "subscriptions": f"user_id = {_MOI}",
    "ledger": f"author_id = {_MOI}",
    "payouts": f"author_id = {_MOI}",
    "imports": f"user_id = {_MOI}",
    "signalements": f"user_id = {_MOI}",
    "refunds": f"user_id = {_MOI}",
    "notifications": f"user_id = {_MOI}",
    "appareils": f"user_id = {_MOI}",
    "epingles": f"user_id = {_MOI}",
    "ia_usages": f"user_id = {_MOI}",
    "dons": f"user_id = {_MOI}",
    # v10 (21/10/2026) — (lecture, écriture) : un écrit PUBLIÉ, ses j'aime et ses
    # commentaires se lisent par tous ; on n'écrit jamais qu'en son propre nom.
    "ecrits": (f"user_id = {_MOI} OR (statut = 'publie' AND corbeille_le IS NULL AND retire_le IS NULL)", f"user_id = {_MOI}"),
    "ecrits_gestes": (f"user_id = {_MOI} OR {_ECRITS_PUBLICS}", f"user_id = {_MOI}"),
    "ecrits_commentaires": (f"user_id = {_MOI} OR {_ECRITS_PUBLICS} OR ecrit_id IN {_MES_ECRITS}",
                            f"user_id = {_MOI} OR ecrit_id IN {_MES_ECRITS}"),
    "signalements_ecrits": f"user_id = {_MOI}",
    # Lot C : on voit qui on suit, et qui nous suit ; on ne s'abonne qu'en son nom
    "abonnements": (f"user_id = {_MOI} OR auteur_id = {_MOI}", f"user_id = {_MOI}"),
    # Lot D
    "versets": f"user_id = {_MOI}",
    "signets": f"user_id = {_MOI}",
    # Backlog : un avis visible se lit par tous ; on n'écrit que le sien
    "avis": (f"user_id = {_MOI} OR retire_le IS NULL", f"user_id = {_MOI}"),
}


def _politiques_rls():
    out = []
    for table, regle in RLS.items():
        lire, ecrire = regle if isinstance(regle, tuple) else (regle, regle)
        out += [f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY",
                f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY",
                f"DROP POLICY IF EXISTS sozo_{table} ON {table}",
                f"CREATE POLICY sozo_{table} ON {table} USING (({lire}) OR {_GLOBALE}) WITH CHECK (({ecrire}) OR {_GLOBALE})"]
    return out


def verifier_role(cx):
    """Refuse de servir une base DISTANTE si la RLS ne peut pas s'appliquer.

    Pourquoi : sans SOZO_PG_ROLE, Sōzō parle avec le compte de connexion —
    sur Supabase, `postgres`, qui peut contourner la RLS. Rien ne le
    signalerait : la protection de la base serait coupée en silence. Un
    déploiement qui échoue vaut mieux qu'un déploiement sans ceinture."""
    if not config.base_distante():
        return
    if not os.environ.get("SOZO_PG_ROLE"):
        raise RuntimeError("SOZO_PG_ROLE manque : sur une base distante, Sōzō exige son rôle applicatif sans BYPASSRLS.")
    r = cx.un("SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user")
    if not r or r["rolsuper"] or r["rolbypassrls"]:
        raise RuntimeError("Le rôle applicatif contourne la RLS (SUPERUSER ou BYPASSRLS) : démarrage refusé.")


def appliquer_schema(cx=None):
    """Crée les tables manquantes puis joue les migrations additives.
    Idempotent : on peut l'appeler à chaque démarrage."""
    propre = cx is None
    cx = cx or connecter(globale=True)
    with _verrou:
        try:
            if cx.moteur == "postgres":
                # Plusieurs processus (workers gunicorn) démarrent ensemble et
                # appliquent tous le schéma : leurs DDL s'interbloquaient
                # (« deadlock detected », serveur arrêté — constaté le 16/10/2026).
                # Ce verrou consultatif, tenu jusqu'à la fin de la transaction,
                # les fait passer l'un après l'autre ; le schéma est idempotent.
                cx.execute("SELECT pg_advisory_xact_lock(4243500)")
                verifier_role(cx)
            with open(os.path.join(config.RACINE_BACKEND, "schema.sql"), encoding="utf-8") as f:
                for ddl in _instructions(f.read()):
                    cx.execute(_traduire(ddl, cx.moteur))
            for ddl in _AUDIT_IMMUABLE[cx.moteur]:
                cx.execute(ddl)
            if cx.moteur == "postgres":
                for ddl in _politiques_rls():
                    cx.execute(ddl)
            _migrer(cx)
            cx.execute("DELETE FROM schema_meta")
            cx.execute("INSERT INTO schema_meta (version) VALUES (?)", (VERSION_SCHEMA,))
            cx.valider()
        except Exception:
            cx.annuler()
            raise
        finally:
            if propre:
                cx.fermer()


def _colonnes(cx, table):
    if cx.moteur == "sqlite":
        return {r["name"] for r in cx.tous(f"PRAGMA table_info({table})")}
    return {r["column_name"] for r in cx.tous(
        "SELECT column_name FROM information_schema.columns WHERE table_schema = ? AND table_name = ?",
        (config.schema_postgres(), table))}


def _ajouter_colonne(cx, table, colonne, definition):
    """Migration additive : ajoute une colonne si elle manque, rien d'autre."""
    if colonne not in _colonnes(cx, table):
        cx.execute(f"ALTER TABLE {table} ADD COLUMN {colonne} {definition}")


TYPES_NOTIFICATION = ('parution', 'paiement', 'vente', 'reversement', 'securite', 'plume', 'moderation', 'test', 'communaute', 'abonnements')


def _types_de_notification(cx):
    """Lot C (21/10/2026) : deux types de notification de plus (« communaute »,
    « abonnements »). Une règle CHECK ne s'élargit pas par ALTER … ADD COLUMN :
    * PostgreSQL (la production) : on remplace la contrainte, rien d'autre ne bouge ;
    * SQLite (développement, tests) : seule une reconstruction de la table change
      un CHECK. Toutes les lignes sont recopiées, colonnes nommées, dans une
      transaction : la table neuve a exactement le contenu de l'ancienne.
    Idempotent : ne fait rien si la règle connaît déjà les nouveaux types."""
    voulus = "type IN ('parution', 'paiement', 'vente', 'reversement', 'securite', 'plume', 'moderation', 'test', 'communaute', 'abonnements')"
    if cx.moteur == "postgres":
        for r in cx.tous("""SELECT conname, pg_get_constraintdef(oid) AS d FROM pg_constraint
                             WHERE conrelid = 'notifications'::regclass AND contype = 'c'"""):
            if "type" in r["d"] and "communaute" not in r["d"]:
                cx.execute(f'ALTER TABLE notifications DROP CONSTRAINT "{r["conname"]}"')
                cx.execute(f"ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK ({voulus})")
        return
    ligne = cx.un("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'notifications'")
    if not ligne or "communaute" in ligne["sql"]:
        return
    cols = "id, user_id, type, titre, corps, lien, cle, lu_le, created_at"
    cx.execute(f"""CREATE TABLE notifications_v11 (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users (id),
      type TEXT NOT NULL CHECK ({voulus}),
      titre TEXT NOT NULL, corps TEXT NOT NULL, lien TEXT, cle TEXT NOT NULL, lu_le TEXT, created_at TEXT NOT NULL,
      UNIQUE (user_id, cle))""")
    avant = cx.un("SELECT COUNT(*) AS n FROM notifications")["n"]
    cx.execute(f"INSERT INTO notifications_v11 ({cols}) SELECT {cols} FROM notifications")
    if cx.un("SELECT COUNT(*) AS n FROM notifications_v11")["n"] != avant:
        raise RuntimeError("Reconstruction des notifications incomplète : rien n'est changé.")
    cx.execute("DROP TABLE notifications")
    cx.execute("ALTER TABLE notifications_v11 RENAME TO notifications")
    cx.execute("CREATE INDEX IF NOT EXISTS notifications_personne ON notifications (user_id, id)")


def _migrer(cx):
    """Migrations ADDITIVES, à la suite, sans jamais en retirer une."""
    # v3 : profil public et atelier personnalisé de l'auteur
    _ajouter_colonne(cx, "users", "bio", "TEXT")
    _ajouter_colonne(cx, "users", "ville", "TEXT")
    _ajouter_colonne(cx, "users", "photo", "TEXT")
    _ajouter_colonne(cx, "users", "atelier", "TEXT")
    _ajouter_colonne(cx, "users", "demo", "INTEGER NOT NULL DEFAULT 0")
    # v4 (16/10/2026) : remboursements, rôles d'administration, réauthentification
    _ajouter_colonne(cx, "entitlements", "revoque_le", "TEXT")
    _ajouter_colonne(cx, "subscriptions", "revoque_le", "TEXT")
    # Moindre privilège : un compte d'administration n'a QUE les rôles qu'on
    # lui donne en ligne de commande (« lecture » seule par défaut).
    _ajouter_colonne(cx, "admin_users", "roles", "TEXT NOT NULL DEFAULT 'lecture'")
    _ajouter_colonne(cx, "admin_sessions", "reauth_le", "TEXT")
    # v5 (16/10/2026) : notifications, conservation des manuscrits
    _ajouter_colonne(cx, "users", "preferences", "TEXT")
    _ajouter_colonne(cx, "imports", "efface_le", "TEXT")
    # v6 (17/10/2026) : thème de la personne (NULL = nocturne, le défaut du propriétaire)
    _ajouter_colonne(cx, "users", "theme", "TEXT")
    # v8 (19/10/2026) : apparence choisie par l'auteur (couverture et mise en
    # page intérieure), en JSON validé clé par clé par studio.apparence_propre
    _ajouter_colonne(cx, "books", "apparence", "TEXT")
    if "annoncee_le" not in _colonnes(cx, "pages"):
        _ajouter_colonne(cx, "pages", "annoncee_le", "TEXT")
        # Les pages DÉJÀ sorties sont réputées annoncées : sans cela, la première
        # tâche enverrait à chaque lecteur une notification pour tout l'historique.
        cx.execute("UPDATE pages SET annoncee_le = publie_le WHERE statut <> 'draft' AND publie_le IS NOT NULL AND publie_le <= ?",
                   (datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),))
    # v10 (21/10/2026) : corbeille des pages. Une page jetée garde sa ligne et
    # tout son historique de versions ; elle quitte la numérotation (n négatif,
    # pour libérer UNIQUE(book_id, n)) et se récupère depuis la corbeille.
    _ajouter_colonne(cx, "pages", "corbeille_le", "TEXT")
    _ajouter_colonne(cx, "pages", "n_avant", "INTEGER")
    # v11 (21/10/2026), lot A « compléter ce qui existe » :
    # un livre se RETIRE du catalogue par son auteur (cache_le : ses lecteurs
    # gardent leurs pages) ou va à la CORBEILLE (corbeille_le : seulement s'il
    # n'a jamais rien publié) ;
    _ajouter_colonne(cx, "books", "cache_le", "TEXT")
    _ajouter_colonne(cx, "books", "corbeille_le", "TEXT")
    # un écrit effacé pour de bon par son auteur (texte vidé, ligne gardée) ;
    _ajouter_colonne(cx, "ecrits", "efface_le", "TEXT")
    # un commentaire peut répondre à un autre, et se corriger quelques minutes ;
    _ajouter_colonne(cx, "ecrits_commentaires", "parent_id", "INTEGER")
    _ajouter_colonne(cx, "ecrits_commentaires", "modifie_le", "TEXT")
    # un code peut servir à confirmer une NOUVELLE adresse e-mail (but = 'email')
    _ajouter_colonne(cx, "codes", "but", "TEXT")
    _ajouter_colonne(cx, "codes", "nouvel_email", "TEXT")
    # lot B : les thèmes d'un écrit (liste fermée, JSON reconstruit par ecrits.py)
    _ajouter_colonne(cx, "ecrits", "themes", "TEXT")
    # lot C : un écrit n'est annoncé qu'une fois à ceux qui suivent son auteur
    _ajouter_colonne(cx, "ecrits", "annonce_le", "TEXT")
    _types_de_notification(cx)
    # v12, lot E : la charte de la communauté acceptée (quelle version, quand) ;
    # une nouvelle version de la charte se fait accepter de nouveau.
    _ajouter_colonne(cx, "users", "charte_version", "TEXT")
    _ajouter_colonne(cx, "users", "charte_le", "TEXT")
