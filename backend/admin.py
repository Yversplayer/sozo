"""Administration de la plateforme — séparée des comptes des utilisateurs.

Comme chez Klassio :
* comptes DISTINCTS (table admin_users), créés UNIQUEMENT en ligne de
  commande (`tools/admin.py`) — aucune route ne crée d'administrateur ;
* connexion : mot de passe + code TOTP (RFC 6238). Un code ne sert qu'UNE
  fois : on mémorise le dernier pas utilisé, un code rejoué est refusé ;
* cookies et CSRF propres (`sozo_admin`, préfixe distinct) : une session de
  lecteur n'ouvre jamais l'administration, et inversement ;
* chaque action est inscrite au journal d'audit, avec l'administrateur.
"""
import base64
import hashlib
import hmac
import secrets
import struct
import time
from datetime import timedelta
from functools import wraps

from flask import g, jsonify, request

import acces
import argent
import catalogue
import charte
import envois
import notifications
import config
import db
import security
import validation as v
from app import auditer, ip_client, ouverte

COOKIE = "sozo_admin"
COOKIE_CSRF = "sozo_admin_csrf"
DUREE = timedelta(hours=8)


# ── TOTP (RFC 6238 : HMAC-SHA1, pas de 30 s, 6 chiffres) ───────────────────

def nouveau_secret_totp():
    return base64.b32encode(secrets.token_bytes(20)).decode().rstrip("=")


def _code(secret, pas):
    cle = base64.b32decode(secret + "=" * (-len(secret) % 8))
    h = hmac.new(cle, struct.pack(">Q", pas), hashlib.sha1).digest()
    o = h[-1] & 0x0F
    return str((struct.unpack(">I", h[o:o + 4])[0] & 0x7FFFFFFF) % 1_000_000).zfill(6)


def pas_valide(secret, code, maintenant=None):
    """Le pas (fenêtre de 30 s) qui correspond au code, ±1 pour l'horloge ; sinon None."""
    if not code or not code.isdigit() or len(code) != 6:
        return None
    t = int((maintenant or time.time()) // 30)
    for pas in (t, t - 1, t + 1):
        if hmac.compare_digest(_code(secret, pas), code):
            return pas
    return None


def uri_totp(secret, email):
    return f"otpauth://totp/S%C5%8Dz%C5%8D:{email}?secret={secret}&issuer=S%C5%8Dz%C5%8D&digits=6&period=30"


def jeton_csrf_admin(jeton):
    return hashlib.sha256(("admin-csrf:" + jeton).encode()).hexdigest()


# ── Garde ──────────────────────────────────────────────────────────────────

def admin_requis(f):
    @wraps(f)
    def enveloppe(*a, **k):
        jeton = request.cookies.get(COOKIE)
        g.admin = None
        if jeton and len(jeton) <= 100:
            cx = db.connecter()
            try:
                g.admin = cx.un("""SELECT a.id, a.email, a.nom, a.roles, s.id AS session_id, s.reauth_le FROM admin_sessions s JOIN admin_users a ON a.id = s.admin_id
                                    WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > ? AND a.actif = 1""",
                                (security.empreinte("admin:" + jeton), acces.maintenant()))
            finally:
                cx.fermer()
        if not g.admin:
            auditer("admin.acces", ressource=request.path, resultat="refus")
            return jsonify(erreur="Connexion d'administration requise."), 401
        if request.method in ("POST", "PUT", "PATCH", "DELETE"):
            fourni = request.headers.get(security.EN_TETE_CSRF, "")
            if not fourni or not secrets.compare_digest(fourni, jeton_csrf_admin(jeton)):
                auditer("admin.csrf", ressource=request.path, resultat="refus")
                return jsonify(erreur="Requête refusée (jeton de sécurité)."), 403
        return f(*a, **k)
    enveloppe._sozo = "admin"
    return enveloppe


ROLES = {"lecture", "finance", "moderation"}
REAUTH = timedelta(minutes=10)


def role_requis(nom):
    """Moindre privilège (audit du 16/10/2026) : avant, TOUT administrateur
    pouvait confirmer un paiement, verser de l'argent et retirer un livre.
    Chaque action sensible exige désormais son rôle, lu en base, jamais envoyé
    par le navigateur. À poser SOUS @admin_requis."""
    def deco(f):
        @wraps(f)
        def enveloppe(*a, **k):
            if nom not in set((g.admin["roles"] or "").split(",")):
                auditer("admin.role", ressource=request.path, apres=f"{nom} manquant — admin:{g.admin['id']}", resultat="refus")
                return jsonify(erreur=f"Votre compte n'a pas le rôle « {nom} » pour cette action.", code="role"), 403
            return f(*a, **k)
        return enveloppe
    return deco


def reauth_requise(f):
    """Rembourser, verser de l'argent, désactiver un compte : une session volée
    (ou un poste laissé ouvert) ne suffit pas. Un code TOTP frais (< 10 min)
    est exigé ; l'interface le demande puis rejoue l'action."""
    @wraps(f)
    def enveloppe(*a, **k):
        le = g.admin["reauth_le"]
        limite = (security.maintenant() - REAUTH).strftime("%Y-%m-%dT%H:%M:%SZ")
        if not le or le < limite:
            return jsonify(erreur="Confirmez avec votre code à 6 chiffres.", code="reauth"), 403
        return f(*a, **k)
    return enveloppe


def _trace(action, ressource, detail, cx):
    auditer("admin." + action, ressource=ressource, apres=f"{detail} — par admin:{g.admin['id']}", cx=cx)


def enregistrer(app):

    @app.post("/api/admin/sessions")
    @ouverte
    def admin_connexion():
        d = v.corps_json(request)
        email = v.email(d)
        mdp = v.texte(d, "mot_de_passe", maxi=200)
        code = v.texte(d, "code", maxi=6)
        cx = db.connecter()
        try:
            if security.depasse(cx, "admin:ip", ip_client()) or security.depasse(cx, "admin:compte", email):
                cx.valider()
                return jsonify(erreur="Trop de tentatives. Réessayez plus tard."), 429
            a = cx.un("SELECT * FROM admin_users WHERE email = ? AND actif = 1", (email,))
            ok = security.verifier_mot_de_passe(mdp, a["password_hash"]) if a else security.verifier_leurre(mdp)
            pas = pas_valide(a["totp_secret"], code) if (a and ok) else None
            # Un code ne sert qu'une fois : le pas doit être STRICTEMENT plus récent
            # que le dernier accepté, et la mise à jour est atomique.
            if pas is not None and cx.execute("UPDATE admin_users SET totp_dernier_pas = ? WHERE id = ? AND totp_dernier_pas < ?",
                                              (pas, a["id"], pas)).rowcount != 1:
                pas = None
            if not ok or pas is None:
                auditer("admin.connexion", ressource=email, resultat="refus", cx=cx)
                cx.valider()
                return jsonify(erreur="Identifiants ou code incorrects."), 401
            jeton = security.nouveau_jeton()
            m = security.maintenant()
            cx.execute("INSERT INTO admin_sessions (admin_id, token_hash, created_at, expires_at) VALUES (?, ?, ?, ?)",
                       (a["id"], security.empreinte("admin:" + jeton), security._utc(m), security._utc(m + DUREE)))
            auditer("admin.connexion", ressource=f"admin:{a['id']}", cx=cx)
            cx.valider()
        finally:
            cx.fermer()
        rep = jsonify(admin={"nom": a["nom"], "email": a["email"]})
        age = int(DUREE.total_seconds())
        rep.set_cookie(COOKIE, jeton, max_age=age, httponly=True, secure=config.https_force(), samesite="Strict", path="/")
        rep.set_cookie(COOKIE_CSRF, jeton_csrf_admin(jeton), max_age=age, httponly=False, secure=config.https_force(), samesite="Strict", path="/")
        return rep

    @app.delete("/api/admin/sessions/courante")
    @admin_requis
    def admin_deconnexion():
        cx = db.connecter()
        try:
            cx.execute("UPDATE admin_sessions SET revoked_at = ? WHERE id = ?", (acces.maintenant(), g.admin["session_id"]))
            cx.valider()
        finally:
            cx.fermer()
        rep = jsonify(ok=True)
        rep.delete_cookie(COOKIE, path="/")
        rep.delete_cookie(COOKIE_CSRF, path="/")
        return rep

    @app.post("/api/admin/reauth")
    @admin_requis
    def admin_reauth():
        code = v.texte(v.corps_json(request), "code", maxi=6)
        cx = db.connecter()
        try:
            if security.depasse(cx, "admin:reauth", g.admin["email"]):
                cx.valider()
                return jsonify(erreur="Trop de tentatives. Réessayez plus tard."), 429
            a = cx.un("SELECT totp_secret FROM admin_users WHERE id = ?", (g.admin["id"],))
            pas = pas_valide(a["totp_secret"], code)
            # même règle qu'à la connexion : un code ne sert qu'une fois
            if pas is None or cx.execute("UPDATE admin_users SET totp_dernier_pas = ? WHERE id = ? AND totp_dernier_pas < ?",
                                         (pas, g.admin["id"], pas)).rowcount != 1:
                auditer("admin.reauth", ressource=f"admin:{g.admin['id']}", resultat="refus", cx=cx)
                cx.valider()
                return jsonify(erreur="Code incorrect ou déjà utilisé."), 401
            cx.execute("UPDATE admin_sessions SET reauth_le = ? WHERE id = ?", (acces.maintenant(), g.admin["session_id"]))
            auditer("admin.reauth", ressource=f"admin:{g.admin['id']}", cx=cx)
            cx.valider()
            return jsonify(ok=True)
        finally:
            cx.fermer()

    @app.get("/api/admin/tableau")
    @admin_requis
    def admin_tableau():
        cx = db.connecter()
        try:
            n = lambda q, p=(): cx.un(q, p)["n"]
            return jsonify(
                admin={"nom": g.admin["nom"], "email": g.admin["email"], "roles": sorted(set((g.admin["roles"] or "").split(",")) & ROLES)},
                rembourses=n("SELECT COUNT(*) AS n FROM refunds"),
                paiements_attente=n("SELECT COUNT(*) AS n FROM payments WHERE etat IN ('PENDING', 'UNKNOWN')"),
                reversements_attente=n("SELECT COUNT(*) AS n FROM payouts WHERE etat = 'DEMANDE'"),
                signalements=n("SELECT COUNT(*) AS n FROM signalements WHERE etat = 'ouvert'"),
                # Lot E (21/10/2026) : la communauté — écrits, commentaires, abonnements
                signalements_ecrits=n("SELECT COUNT(*) AS n FROM signalements_ecrits WHERE etat = 'ouvert'"),
                ecrits=n("SELECT COUNT(*) AS n FROM ecrits WHERE statut = 'publie' AND corbeille_le IS NULL AND retire_le IS NULL AND efface_le IS NULL AND publie_le <= ?", (acces.maintenant(),)),
                ecrits_retires=n("SELECT COUNT(*) AS n FROM ecrits WHERE retire_le IS NOT NULL AND efface_le IS NULL"),
                commentaires=n("SELECT COUNT(*) AS n FROM ecrits_commentaires WHERE retire_le IS NULL"),
                abonnements=n("SELECT COUNT(*) AS n FROM abonnements"),
                charte=n("SELECT COUNT(*) AS n FROM users WHERE actif = 1 AND charte_version = ?", (charte.VERSION,)),
                utilisateurs=n("SELECT COUNT(*) AS n FROM users WHERE actif = 1"),
                auteurs=n("SELECT COUNT(*) AS n FROM users WHERE actif = 1 AND role = 'auteur'"),
                livres=n("SELECT COUNT(*) AS n FROM books WHERE statut = 'actif'"),
                ventes=n("SELECT COUNT(*) AS n FROM payments WHERE etat = 'CONFIRMED'"),
                encaisse=n("SELECT COALESCE(SUM(montant), 0) AS n FROM payments WHERE etat = 'CONFIRMED'"),
                commission=n("SELECT COALESCE(SUM(montant), 0) AS n FROM ledger WHERE beneficiaire = 'plateforme'"),
                du_aux_auteurs=n("SELECT COALESCE(SUM(montant), 0) AS n FROM ledger WHERE beneficiaire = 'auteur'") - n("SELECT COALESCE(SUM(montant), 0) AS n FROM payouts WHERE etat = 'PAYE'"))
        finally:
            cx.fermer()

    @app.get("/api/admin/paiements")
    @admin_requis
    def admin_paiements():
        etat = request.args.get("etat", "PENDING")
        if etat not in ("PENDING", "UNKNOWN", "CONFIRMED", "FAILED", "CREATED", "CANCELLED", "EXPIRED", "TOUS"):
            raise v.Invalide("État inconnu.", "etat")
        cx = db.connecter()
        try:
            if argent.expirer(cx):
                cx.valider()
            filtre = "" if etat == "TOUS" else "WHERE p.etat = ?"
            return jsonify(paiements=cx.tous(f"""SELECT p.id, p.objet, p.montant, p.etat, p.operateur, p.reference, p.created_at, p.updated_at,
                                                        p.page_de, p.page_a, p.motif_refus, p.prestataire, p.confirme_par, u.nom AS lecteur, u.email, b.titre,
                                                        rf.created_at AS rembourse_le, rf.motif AS motif_remboursement
                                                   FROM payments p JOIN users u ON u.id = p.user_id LEFT JOIN books b ON b.id = p.book_id
                                                   LEFT JOIN refunds rf ON rf.payment_id = p.id
                                                   {filtre} ORDER BY p.updated_at DESC LIMIT 200""", () if etat == "TOUS" else (etat,)))
        finally:
            cx.fermer()

    @app.post("/api/admin/paiements/<int:pid>/confirmer")
    @admin_requis
    @role_requis("finance")
    def admin_confirmer(pid):
        cx = db.connecter()
        try:
            if not argent.confirmer(cx, pid, f"admin:{g.admin['id']}"):
                cx.annuler()
                return jsonify(erreur="Ce paiement est déjà traité (ou n'existe pas)."), 409
            _trace("paiement.confirmation", f"payment:{pid}", "confirmé", cx)
            cx.valider()
            envois.declencher()
            return jsonify(ok=True, recu=cx.un("SELECT numero FROM receipts WHERE payment_id = ?", (pid,))["numero"])
        finally:
            cx.fermer()

    @app.post("/api/admin/paiements/<int:pid>/refuser")
    @admin_requis
    @role_requis("finance")
    def admin_refuser(pid):
        motif = v.texte(v.corps_json(request), "motif", mini=3, maxi=300)
        cx = db.connecter()
        try:
            if not argent.refuser(cx, pid, f"admin:{g.admin['id']}", motif):
                return jsonify(erreur="Ce paiement est déjà traité (ou n'existe pas)."), 409
            _trace("paiement.refus", f"payment:{pid}", motif, cx)
            cx.valider()
            envois.declencher()
            return jsonify(ok=True)
        finally:
            cx.fermer()

    @app.post("/api/admin/paiements/<int:pid>/rembourser")
    @admin_requis
    @role_requis("finance")
    @reauth_requise
    def admin_rembourser(pid):
        d = v.corps_json(request)
        motif = v.texte(d, "motif", mini=3, maxi=300)
        reference = v.texte(d, "reference", requis=False, maxi=120)
        cx = db.connecter()
        try:
            if not argent.rembourser(cx, pid, f"admin:{g.admin['id']}", motif, reference):
                cx.annuler()
                return jsonify(erreur="Seul un paiement confirmé, pas encore remboursé, peut l'être."), 409
            _trace("paiement.remboursement", f"payment:{pid}", motif, cx)
            cx.valider()
            envois.declencher()
            return jsonify(ok=True)
        finally:
            cx.fermer()

    @app.get("/api/admin/reversements")
    @admin_requis
    def admin_reversements():
        cx = db.connecter()
        try:
            return jsonify(reversements=cx.tous("""SELECT r.*, u.nom, u.email FROM payouts r JOIN users u ON u.id = r.author_id
                                                    ORDER BY CASE WHEN r.etat = 'DEMANDE' THEN 0 ELSE 1 END, r.id DESC LIMIT 200"""))
        finally:
            cx.fermer()

    @app.post("/api/admin/reversements/<int:rid>/<action>")
    @admin_requis
    @role_requis("finance")
    def traiter_reversement(rid, action):
        if action not in ("payer", "refuser"):
            return jsonify(erreur="Introuvable."), 404
        if action == "payer":
            refus = reauth_requise(lambda: None)()
            if refus:
                return refus
        d = v.corps_json(request)
        detail = v.texte(d, "reference" if action == "payer" else "motif", mini=3, maxi=120)
        cx = db.connecter()
        try:
            col = "reference" if action == "payer" else "motif"
            cur = cx.execute(f"UPDATE payouts SET etat = ?, {col} = ?, traite_le = ?, traite_par = ? WHERE id = ? AND etat = 'DEMANDE'",
                             ("PAYE" if action == "payer" else "REFUSE", detail, acces.maintenant(), f"admin:{g.admin['id']}", rid))
            if cur.rowcount != 1:
                return jsonify(erreur="Ce reversement est déjà traité (ou n'existe pas)."), 409
            _trace("reversement." + action, f"payout:{rid}", detail, cx)
            r = cx.un("SELECT author_id, montant FROM payouts WHERE id = ?", (rid,))
            if action == "payer":
                notifications.emettre(cx, r["author_id"], "reversement", "Reversement envoyé",
                                      f"{r['montant'] / 100:.2f} $ vous ont été envoyés (référence {detail}).", "/app/studio.html#revenus", f"reversement:{rid}")
            else:
                notifications.emettre(cx, r["author_id"], "reversement", "Reversement refusé",
                                      f"Votre demande de {r['montant'] / 100:.2f} $ est refusée : {detail}. Le montant redevient disponible.",
                                      "/app/studio.html#revenus", f"reversement:{rid}")
            cx.valider()
            envois.declencher()
            return jsonify(ok=True)
        finally:
            cx.fermer()

    # ── Cadeaux (19/10/2026) : offrir un livre ou Plume, sans argent ─────────
    # Demandé par le propriétaire tant que Mobile Money n'est pas branché :
    # tester toutes les fonctions, faire lire un livre à un relecteur, remercier
    # quelqu'un. Ce n'est PAS une vente : ni paiement, ni reçu, ni revenu pour
    # l'auteur, ni commission. Rôle finance + code frais, motif obligatoire,
    # trace dans le journal d'audit, notification à la personne. Retirable.
    @app.get("/api/admin/dons")
    @admin_requis
    def admin_dons():
        cx = db.connecter()
        try:
            return jsonify(dons=cx.tous("""SELECT d.id, d.objet, d.debut, d.fin, d.motif, d.created_at, d.revoque_le,
                                                  u.nom, u.email, b.titre, b.slug, a.email AS par
                                             FROM dons d JOIN users u ON u.id = d.user_id LEFT JOIN books b ON b.id = d.book_id
                                             JOIN admin_users a ON a.id = d.admin_id ORDER BY d.id DESC LIMIT 300"""))
        finally:
            cx.fermer()

    @app.post("/api/admin/dons")
    @admin_requis
    @role_requis("finance")
    @reauth_requise
    def offrir():
        d = v.corps_json(request)
        email = v.email(d)
        objet = v.choix(d, "objet", {"livre", "plume"})
        motif = v.texte(d, "motif", mini=3, maxi=200)
        cx = db.connecter()
        try:
            u = cx.un("SELECT id, nom FROM users WHERE email = ? AND actif = 1", (email,))
            if not u:
                return jsonify(erreur="Aucun compte actif avec cette adresse.", champ="email"), 404
            m = acces.maintenant()
            if objet == "livre":
                slug = v.texte(d, "livre", maxi=80)
                b = cx.un("SELECT id, titre, owner_id FROM books WHERE slug = ? AND statut = 'actif'", (slug,))
                if not b:
                    return jsonify(erreur="Livre introuvable (ou retiré).", champ="livre"), 404
                if b["owner_id"] == u["id"]:
                    raise v.Invalide("C'est son propre livre : il le lit déjà en entier.", "livre")
                if cx.un("SELECT id FROM dons WHERE user_id = ? AND book_id = ? AND objet = 'livre' AND revoque_le IS NULL", (u["id"], b["id"])):
                    raise v.Invalide("Ce livre lui est déjà offert.", "livre")
                did = cx.inserer("INSERT INTO dons (user_id, objet, book_id, debut, motif, admin_id, created_at) VALUES (?, 'livre', ?, ?, ?, ?, ?)",
                                 (u["id"], b["id"], m, motif, g.admin["id"], m))
                notifications.emettre(cx, u["id"], "paiement", "Un livre vous est offert",
                                      f"Sōzō vous offre « {b['titre']} » en entier, pages à venir comprises.", f"/app/livre.html?id={slug}", f"don:{did}")
            else:
                jours = v.entier(d, "jours", mini=1, maxi=365, requis=False) or 30
                from datetime import datetime, timedelta, timezone
                depart = max(m, argent.plume_actif(cx, u["id"])["fin"] or m)        # prolonge une Plume en cours
                fin = (datetime.strptime(depart, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc) + timedelta(days=jours)).strftime("%Y-%m-%dT%H:%M:%SZ")
                did = cx.inserer("INSERT INTO dons (user_id, objet, debut, fin, motif, admin_id, created_at) VALUES (?, 'plume', ?, ?, ?, ?, ?)",
                                 (u["id"], depart, fin, motif, g.admin["id"], m))
                notifications.emettre(cx, u["id"], "plume", "Plume vous est offerte",
                                      f"Sōzō vous offre Plume pendant {jours} jours.", "/app/studio.html#revenus", f"don:{did}")
            _trace("don." + objet, f"don:{did}", f"{email} — {motif}", cx)
            cx.valider()
            envois.declencher()
            return jsonify(ok=True, id=did), 201
        finally:
            cx.fermer()

    @app.post("/api/admin/dons/<int:did>/retirer")
    @admin_requis
    @role_requis("finance")
    @reauth_requise
    def retirer_don(did):
        motif = v.texte(v.corps_json(request), "motif", mini=3, maxi=200)
        cx = db.connecter()
        try:
            cur = cx.execute("UPDATE dons SET revoque_le = ? WHERE id = ? AND revoque_le IS NULL", (acces.maintenant(), did))
            if cur.rowcount != 1:
                return jsonify(erreur="Ce cadeau est déjà retiré (ou n'existe pas)."), 404
            _trace("don.retrait", f"don:{did}", motif, cx)
            cx.valider()
            return jsonify(ok=True)
        finally:
            cx.fermer()

    @app.get("/api/admin/livres")
    @admin_requis
    def admin_livres():
        cx = db.connecter()
        try:
            return jsonify(livres=cx.tous("""SELECT b.id, b.slug, b.titre, b.categorie, b.statut, b.retrait_motif, b.acces, b.demo, u.nom AS auteur,
                                                    (SELECT COUNT(*) FROM signalements s WHERE s.book_id = b.id AND s.etat = 'ouvert') AS signalements
                                               FROM books b JOIN users u ON u.id = b.owner_id ORDER BY b.id DESC LIMIT 500"""))
        finally:
            cx.fermer()

    @app.post("/api/admin/livres/<int:bid>/<action>")
    @admin_requis
    @role_requis("moderation")
    def moderer_livre(bid, action):
        if action not in ("retirer", "retablir"):
            return jsonify(erreur="Introuvable."), 404
        motif = v.texte(v.corps_json(request), "motif", mini=3, maxi=300) if action == "retirer" else None
        cx = db.connecter()
        try:
            cur = cx.execute("UPDATE books SET statut = ?, retrait_motif = ?, updated_at = ? WHERE id = ?",
                             ("retire" if action == "retirer" else "actif", motif, acces.maintenant(), bid))
            if cur.rowcount != 1:
                return jsonify(erreur="Introuvable."), 404
            _trace("livre." + action, f"book:{bid}", motif or "rétabli", cx)
            b = cx.un("SELECT owner_id, titre, slug FROM books WHERE id = ?", (bid,))
            notifications.emettre(cx, b["owner_id"], "moderation", "Livre retiré du catalogue" if action == "retirer" else "Livre rétabli",
                                  f"« {b['titre']} » : {motif}" if action == "retirer" else f"« {b['titre']} » est de nouveau visible.",
                                  f"/app/studio.html?id={b['slug']}", f"moderation:{bid}:{action}:{acces.maintenant()}")
            cx.valider()
            catalogue.invalider_vitrine()
            envois.declencher()
            return jsonify(ok=True)
        finally:
            cx.fermer()

    @app.get("/api/admin/signalements")
    @admin_requis
    def admin_signalements():
        cx = db.connecter()
        try:
            return jsonify(signalements=cx.tous("""SELECT s.id, s.motif, s.etat, s.created_at, b.id AS book_id, b.titre, u.nom AS par
                                                     FROM signalements s JOIN books b ON b.id = s.book_id JOIN users u ON u.id = s.user_id
                                                    ORDER BY CASE WHEN s.etat = 'ouvert' THEN 0 ELSE 1 END, s.id DESC LIMIT 200"""))
        finally:
            cx.fermer()

    @app.post("/api/admin/signalements/<int:sid>")
    @admin_requis
    @role_requis("moderation")
    def traiter_signalement(sid):
        etat = v.choix(v.corps_json(request), "etat", {"traite", "rejete"})
        cx = db.connecter()
        try:
            if cx.execute("UPDATE signalements SET etat = ? WHERE id = ? AND etat = 'ouvert'", (etat, sid)).rowcount != 1:
                return jsonify(erreur="Déjà traité (ou introuvable)."), 409
            _trace("signalement." + etat, f"signalement:{sid}", etat, cx)
            cx.valider()
            return jsonify(ok=True)
        finally:
            cx.fermer()

    # 21/10/2026 : signalements des écrits et des commentaires (ecrits.py)
    import ecrits
    ecrits.enregistrer_admin(app, admin_requis, role_requis, _trace)

    @app.get("/api/admin/utilisateurs")
    @admin_requis
    def admin_utilisateurs():
        q = (request.args.get("q") or "").strip()[:80]
        cx = db.connecter()
        try:
            motif = f"%{q.lower()}%"
            return jsonify(utilisateurs=cx.tous("""SELECT id, nom, email, role, actif, email_verifie_at, created_at FROM users
                                                    WHERE LOWER(nom) LIKE ? OR LOWER(email) LIKE ? ORDER BY id DESC LIMIT 100""", (motif, motif)))
        finally:
            cx.fermer()

    @app.post("/api/admin/utilisateurs/<int:uid>/<action>")
    @admin_requis
    @role_requis("moderation")
    def moderer_utilisateur(uid, action):
        if action not in ("desactiver", "reactiver"):
            return jsonify(erreur="Introuvable."), 404
        if action == "desactiver":
            refus = reauth_requise(lambda: None)()
            if refus:
                return refus
        motif = v.texte(v.corps_json(request), "motif", mini=3, maxi=300)
        cx = db.connecter()
        try:
            if cx.execute("UPDATE users SET actif = ? WHERE id = ?", (0 if action == "desactiver" else 1, uid)).rowcount != 1:
                return jsonify(erreur="Introuvable."), 404
            if action == "desactiver":
                security.revoquer_toutes(cx, uid)          # un compte désactivé perd TOUTES ses sessions
            _trace("utilisateur." + action, f"user:{uid}", motif, cx)
            cx.valider()
            catalogue.invalider_vitrine()
            return jsonify(ok=True)
        finally:
            cx.fermer()

    @app.get("/api/admin/audit")
    @admin_requis
    def admin_audit():
        cx = db.connecter()
        try:
            return jsonify(lignes=cx.tous("SELECT id, at, user_id, ip, action, ressource, apres, resultat FROM audit_log ORDER BY id DESC LIMIT 300"))
        finally:
            cx.fermer()
