"""Accès à la base : SQLite en développement, PostgreSQL en production.

Une seule écriture du SQL (paramètres « ? »), traduite pour PostgreSQL.
Le schéma (`schema.sql`) est écrit dans un sous-ensemble commun ; les rares
différences (clés auto-incrémentées, déclencheurs) sont posées ici, par moteur.

Migrations : ADDITIVES uniquement (`ALTER TABLE … ADD COLUMN`), jamais de
suppression. Le schéma est appliqué AVANT que le serveur n'accepte une
requête : un déploiement échoue plutôt que d'exposer une API sans son schéma.
"""
import os
import re
import sqlite3
import threading

import config

VERSION_SCHEMA = 2
_verrou = threading.Lock()


class Connexion:
    """Enveloppe minimale commune aux deux moteurs."""

    def __init__(self, brute, moteur):
        self.brute = brute
        self.moteur = moteur

    def _sql(self, sql):
        if self.moteur == "postgres":
            # « ? » → « %s » ; un « % » littéral doit être doublé pour psycopg
            return sql.replace("%", "%%").replace("?", "%s")
        return sql

    def execute(self, sql, params=()):
        cur = self.brute.cursor()
        cur.execute(self._sql(sql), tuple(params))
        return cur

    def un(self, sql, params=()):
        ligne = self.execute(sql, params).fetchone()
        return dict(ligne) if ligne is not None else None

    def tous(self, sql, params=()):
        return [dict(l) for l in self.execute(sql, params).fetchall()]

    def inserer(self, sql, params=()):
        """INSERT qui rend l'identifiant créé, sur les deux moteurs."""
        if self.moteur == "postgres":
            return self.execute(sql + " RETURNING id", params).fetchone()["id"]
        return self.execute(sql, params).lastrowid

    def valider(self):
        self.brute.commit()

    def annuler(self):
        self.brute.rollback()

    def fermer(self):
        self.brute.close()

    def poser_utilisateur(self, user_id):
        """Contexte de la Row Level Security (PostgreSQL, étape 3) : une
        connexion dont l'utilisateur n'est pas posé ne voit aucune ligne privée."""
        if self.moteur == "postgres":
            self.execute("SELECT set_config('app.user_id', ?, true)", (str(user_id or ""),))


def connecter():
    m = config.moteur()
    if m == "sqlite":
        brute = sqlite3.connect(config.chemin_sqlite(), timeout=10)
        brute.row_factory = sqlite3.Row
        brute.execute("PRAGMA foreign_keys = ON")
        brute.execute("PRAGMA journal_mode = WAL")
        return Connexion(brute, m)
    import psycopg
    from psycopg.rows import dict_row
    brute = psycopg.connect(config.url_postgres(), row_factory=dict_row, autocommit=False,
                            options=f"-c search_path={config.schema_postgres()}")
    return Connexion(brute, m)


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


def appliquer_schema(cx=None):
    """Crée les tables manquantes puis joue les migrations additives.
    Idempotent : on peut l'appeler à chaque démarrage."""
    propre = cx is None
    cx = cx or connecter()
    with _verrou:
        try:
            with open(os.path.join(config.RACINE_BACKEND, "schema.sql"), encoding="utf-8") as f:
                for ddl in _instructions(f.read()):
                    cx.execute(_traduire(ddl, cx.moteur))
            for ddl in _AUDIT_IMMUABLE[cx.moteur]:
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


def _migrer(cx):
    """Les migrations à venir s'ajoutent ici, à la suite, sans jamais en
    retirer une. Exemple : _ajouter_colonne(cx, "users", "langue", "TEXT")."""
    return None
