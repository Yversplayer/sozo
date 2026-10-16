"""Notifications : QUI prévenir, de QUOI, par QUELS canaux.

Trois canaux, un seul fait :
  · dans l'application (la cloche) — toujours ;
  · sur l'appareil (Web Push) — si la personne l'a activé sur cet appareil
    et que le serveur a ses clés VAPID ;
  · par e-mail — selon ses préférences ; les messages de SÉCURITÉ partent
    toujours (on ne laisse pas couper l'alerte « votre mot de passe a changé »).

Les SMS et WhatsApp ne sont pas branchés : aucun fournisseur n'est choisi.
Rien ici ne prétend le contraire.

`emettre()` écrit dans la transaction de l'appelant : une notification n'existe
que si le fait qu'elle annonce a bien été validé. Elle est dédoublonnée par
`cle` : rejouer une tâche ou un webhook ne prévient jamais deux fois.
"""
import json
from urllib.parse import urlparse

from flask import g, jsonify, request

import config
import db
import gabarits
import mailer
import validation as v
from app import auditer, connectee

TYPES = {
    # type : (libellé, appareil par défaut, e-mail par défaut)
    "parution": ("Nouvelles pages des livres suivis", True, False),
    "paiement": ("Mes paiements et reçus", True, True),
    "vente": ("Mes ventes (auteur)", True, False),
    "reversement": ("Mes reversements (auteur)", True, True),
    "plume": ("Mon abonnement Plume", True, True),
    "moderation": ("Décisions de modération", False, True),
    "securite": ("Sécurité du compte", True, True),
}
TOUJOURS_PAR_EMAIL = {"securite"}

# Services de notification connus. Le serveur ne POSTe qu'à ceux-là.
SERVICES_PUSH = ("fcm.googleapis.com", "updates.push.services.mozilla.com", "push.services.mozilla.com",
                 "notify.windows.com", "push.apple.com")


def preferences(cx, user_id):
    u = cx.un("SELECT preferences FROM users WHERE id = ?", (user_id,))
    try:
        p = json.loads(u["preferences"]) if u and u["preferences"] else {}
    except ValueError:
        p = {}
    out = {}
    for t, (_, push, email) in TYPES.items():
        c = p.get(t) if isinstance(p.get(t), dict) else {}
        out[t] = {"push": bool(c.get("push", push)), "email": True if t in TOUJOURS_PAR_EMAIL else bool(c.get("email", email))}
    return out


def emettre(cx, user_id, type_, titre, corps, lien, cle, *, email=None):
    """Crée la notification et range ses envois. Rend False si elle existait
    déjà (même `cle`) : rien n'est alors envoyé une seconde fois.
    `email` : (titre, paragraphes) pour un e-mail plus détaillé que la cloche."""
    m = v.maintenant()
    cur = cx.execute("""INSERT INTO notifications (user_id, type, titre, corps, lien, cle, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)
                        ON CONFLICT (user_id, cle) DO NOTHING""", (user_id, type_, titre, corps, lien, cle[:200], m))
    if cur.rowcount != 1:
        return False
    prefs = preferences(cx, user_id).get(type_, {"push": True, "email": False})
    if type_ == "test":
        prefs = {"push": True, "email": True}
    if prefs["push"] and config.push_actif():
        for a in cx.tous("SELECT id FROM appareils WHERE user_id = ?", (user_id,)):
            cx.execute("""INSERT INTO envois (canal, user_id, destinataire, sujet, texte, lien, etat, prochain_essai, created_at)
                          VALUES ('push', ?, ?, ?, ?, ?, 'attente', ?, ?)""", (user_id, str(a["id"]), titre, corps, lien, m, m))
    if prefs["email"]:
        u = cx.un("SELECT nom, email FROM users WHERE id = ? AND actif = 1", (user_id,))
        if u:
            t, paras = email or (titre, [corps])
            html, texte = gabarits.page(t, [f"Bonjour {u['nom']},"] + list(paras),
                                        bouton=("Ouvrir dans Sōzō", gabarits.lien(lien)) if lien else None,
                                        raison=f"Vous recevez ce message selon vos préférences « {TYPES.get(type_, ('Notifications',))[0]} ». "
                                               f"Réglez-les dans Mon compte : {gabarits.lien('/app/compte.html#notifications')}")
            mailer.preparer(cx, u["email"], f"{titre} — Sōzō", texte, html, user_id=user_id, lien=lien)
    return True


def service_autorise(endpoint):
    try:
        u = urlparse(endpoint)
    except ValueError:
        return False
    hote = (u.hostname or "").lower()
    return u.scheme == "https" and not u.port and any(hote == s or hote.endswith("." + s) for s in SERVICES_PUSH)


def enregistrer(app):

    @app.get("/api/notifications")
    @connectee
    def notifications_liste():
        cx = db.connecter()
        try:
            uid = g.user["id"]
            n = cx.un("SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND lu_le IS NULL", (uid,))["n"]
            if request.args.get("compte"):
                return jsonify(non_lues=n)
            liste = cx.tous("SELECT id, type, titre, corps, lien, lu_le, created_at FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 60", (uid,))
            return jsonify(non_lues=n, liste=liste)
        finally:
            cx.fermer()

    @app.post("/api/notifications/lues")
    @connectee
    def notifications_lues():
        d = v.corps_json(request)
        ids = d.get("ids")
        cx = db.connecter()
        try:
            if isinstance(ids, list) and ids and all(isinstance(x, int) and not isinstance(x, bool) for x in ids[:200]):
                marques = ",".join("?" * len(ids[:200]))
                cx.execute(f"UPDATE notifications SET lu_le = ? WHERE user_id = ? AND lu_le IS NULL AND id IN ({marques})",
                           (v.maintenant(), g.user["id"], *ids[:200]))
            else:
                cx.execute("UPDATE notifications SET lu_le = ? WHERE user_id = ? AND lu_le IS NULL", (v.maintenant(), g.user["id"]))
            cx.valider()
            return jsonify(ok=True)
        finally:
            cx.fermer()

    @app.get("/api/notifications/preferences")
    @connectee
    def notifications_preferences():
        cx = db.connecter()
        try:
            return jsonify(preferences=preferences(cx, g.user["id"]), types={k: t[0] for k, t in TYPES.items()}, ordre=list(TYPES),
                           toujours_email=sorted(TOUJOURS_PAR_EMAIL), push_actif=config.push_actif(),
                           cle_publique=config.vapid()["public"] if config.push_actif() else None,
                           email=config.email_mode() != "capture",
                           appareils=cx.tous("SELECT id, libelle, created_at, dernier_succes FROM appareils WHERE user_id = ? ORDER BY id", (g.user["id"],)))
        finally:
            cx.fermer()

    @app.put("/api/notifications/preferences")
    @connectee
    def notifications_regler():
        d = v.corps_json(request)
        p = d.get("preferences")
        if not isinstance(p, dict):
            raise v.Invalide("« preferences » attendu.", "preferences")
        propre = {}
        for t in TYPES:                      # liste FERMÉE : rien d'autre n'est enregistré
            c = p.get(t) if isinstance(p.get(t), dict) else {}
            propre[t] = {"push": c.get("push") is True, "email": True if t in TOUJOURS_PAR_EMAIL else c.get("email") is True}
        cx = db.connecter()
        try:
            cx.execute("UPDATE users SET preferences = ? WHERE id = ?", (json.dumps(propre), g.user["id"]))
            cx.valider()
            return jsonify(preferences=preferences(cx, g.user["id"]))
        finally:
            cx.fermer()

    @app.post("/api/notifications/appareils")
    @connectee
    def appareil_ajouter():
        d = v.corps_json(request)
        endpoint = v.texte(d, "endpoint", maxi=1000)
        cles = d.get("keys") if isinstance(d.get("keys"), dict) else {}
        p256dh = v.texte(cles, "p256dh", mini=40, maxi=200)
        auth = v.texte(cles, "auth", mini=10, maxi=60)
        libelle = v.texte(d, "libelle", requis=False, maxi=80)
        if not service_autorise(endpoint):
            raise v.Invalide("Service de notification inconnu.", "endpoint")
        if not config.push_actif():
            return jsonify(erreur="Les notifications d'appareil ne sont pas encore activées sur ce serveur.", code="push_inactif"), 409
        cx = db.connecter()
        try:
            # Un appareil appartient à UNE personne : s'il change de compte
            # (téléphone partagé), l'ancien abonnement est retiré.
            cg = db.connecter(globale=True)
            try:
                cg.execute("DELETE FROM appareils WHERE endpoint = ? AND user_id <> ?", (endpoint, g.user["id"]))
                cg.valider()
            finally:
                cg.fermer()
            ex = cx.un("SELECT id FROM appareils WHERE endpoint = ?", (endpoint,))
            if ex:
                cx.execute("UPDATE appareils SET p256dh = ?, auth = ?, libelle = ? WHERE id = ?", (p256dh, auth, libelle, ex["id"]))
                aid = ex["id"]
            else:
                aid = cx.inserer("INSERT INTO appareils (user_id, endpoint, p256dh, auth, libelle, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                                 (g.user["id"], endpoint, p256dh, auth, libelle, v.maintenant()))
            auditer("notifications.appareil", ressource=f"appareil:{aid}", cx=cx)
            cx.valider()
            return jsonify(ok=True, id=aid), 201
        finally:
            cx.fermer()

    @app.delete("/api/notifications/appareils/<int:aid>")
    @connectee
    def appareil_retirer(aid):
        cx = db.connecter()
        try:
            if cx.execute("DELETE FROM appareils WHERE id = ? AND user_id = ?", (aid, g.user["id"])).rowcount != 1:
                return jsonify(erreur="Introuvable."), 404
            cx.valider()
            return jsonify(ok=True)
        finally:
            cx.fermer()

    @app.post("/api/notifications/test")
    @connectee
    def notifications_test():
        """Une vraie notification, sur tous les canaux actifs : la personne
        vérifie elle-même que son téléphone la reçoit."""
        import envois
        cx = db.connecter()
        try:
            n = cx.un("SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND type = 'test' AND created_at > ?",
                      (g.user["id"], (v.maintenant()[:15])))["n"]
            if n >= 5:
                return jsonify(erreur="Assez d'essais pour l'instant : réessayez dans une dizaine de minutes."), 429
            appareils = cx.un("SELECT COUNT(*) AS n FROM appareils WHERE user_id = ?", (g.user["id"],))["n"]
            emettre(cx, g.user["id"], "test", "Notification d'essai", "Si vous lisez ceci, Sōzō sait vous prévenir.",
                    "/app/compte.html#notifications", f"test:{v.maintenant()}:{appareils}")
            cx.valider()
        finally:
            cx.fermer()
        envois.declencher()
        return jsonify(ok=True, appareils=appareils if config.push_actif() else 0,
                       email="capture" if config.email_mode() == "capture" else "envoi")
