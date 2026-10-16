"""Routes des comptes : inscription, connexion, déconnexion, profil,
mot de passe, vérification d'e-mail, réinitialisation.

Le rôle choisi à l'inscription (lecteur / auteur) est le SEUL moment où le
client propose un rôle, et seulement parmi ces deux-là. Ensuite tout vient
de la session.
"""
from datetime import timedelta

from flask import g, jsonify, request

import config
import db
import envois
import gabarits
import mailer
import security
import validation as v
from app import auditer, connectee, ip_client, ouverte

MDP_MIN, MDP_MAX = 8, 200
ERREUR_CONNEXION = "E-mail ou mot de passe incorrect."


def _moi(user):
    return {"id": user["id"], "nom": user["nom"], "email": user["email"], "role": user["role"],
            "email_verifie": bool(user["email_verifie_at"])}


def _trop(action_cles):
    """Vérifie plusieurs limites ; vrai si l'une est dépassée."""
    cx = db.connecter()
    try:
        trop = any(security.depasse(cx, a, k) for a, k in action_cles)
        cx.valider()
        return trop
    finally:
        cx.fermer()


def _limite():
    return jsonify(erreur="Trop de tentatives. Réessayez dans quelques minutes."), 429


def enregistrer(app):

    @app.post("/api/comptes")
    @ouverte
    def inscription():
        d = v.corps_json(request)
        nom = v.texte(d, "nom", mini=2, maxi=60)
        email = v.email(d)
        mdp = v.texte(d, "mot_de_passe", mini=MDP_MIN, maxi=MDP_MAX)
        role = v.choix(d, "role", {"lecteur", "auteur"})
        if d.get("cgu") is not True:
            raise v.Invalide("Les conditions d'utilisation doivent être acceptées.", "cgu")
        if _trop([("inscription:ip", ip_client())]):
            return _limite()
        cx = db.connecter()
        try:
            if cx.un("SELECT id FROM users WHERE email = ?", (email,)):
                auditer("compte.inscription", ressource=email, resultat="refus", cx=cx)
                cx.valider()
                return jsonify(erreur="Un compte existe déjà avec cette adresse. Connectez-vous.", champ="email"), 409
            uid = cx.inserer("INSERT INTO users (email, nom, role, password_hash, created_at) VALUES (?, ?, ?, ?, ?)",
                             (email, nom, role, security.hacher_mot_de_passe(mdp), v.maintenant()))
            jeton_v = security.creer_jeton_usage_unique(cx, uid, "verification", timedelta(days=3))
            html, texte = gabarits.page("Confirmez votre adresse", [f"Bonjour {nom},", "Bienvenue sur Sōzō. Confirmez votre adresse pour recevoir vos codes de sécurité et vos reçus."],
                                        bouton=("Confirmer mon adresse", gabarits.lien(f"/app/connexion.html?verifier={jeton_v}")),
                                        note="Ce lien est valable 3 jours et ne sert qu’une fois. Si vous n’avez pas créé de compte, ignorez ce message.",
                                        raison="Vous recevez ce message parce qu’un compte Sōzō vient d’être créé avec cette adresse.")
            mailer.preparer(cx, email, "Confirmez votre adresse — Sōzō", texte, html, user_id=uid)
            jeton = security.ouvrir_session(cx, uid, ip_client(), request.headers.get("User-Agent"))
            g.user = {"id": uid}
            auditer("compte.inscription", ressource=f"user:{uid}", apres=role, cx=cx)
            cx.valider()
            user = cx.un("SELECT id, email, nom, role, email_verifie_at FROM users WHERE id = ?", (uid,))
        finally:
            cx.fermer()
        envois.declencher()
        rep = jsonify(moi=_moi(user), email_verification=config.email_mode() != "capture" and "envoi" or "capture")
        security.poser_cookies(rep, jeton, config.https_force())
        return rep, 201

    @app.post("/api/sessions")
    @ouverte
    def connexion():
        d = v.corps_json(request)
        email = v.email(d)
        mdp = v.texte(d, "mot_de_passe", maxi=MDP_MAX)
        if _trop([("connexion:ip", ip_client()), ("connexion:compte", email)]):
            auditer("session.ouverture", ressource=email, resultat="refus")
            return _limite()
        cx = db.connecter()
        try:
            u = cx.un("SELECT id, email, nom, role, email_verifie_at, password_hash, actif FROM users WHERE email = ?", (email,))
            # Même message, même durée, que le compte existe ou non
            ok = security.verifier_mot_de_passe(mdp, u["password_hash"]) if u else security.verifier_leurre(mdp)
            if not ok or not u["actif"]:
                auditer("session.ouverture", ressource=email, resultat="refus", cx=cx)
                cx.valider()
                return jsonify(erreur=ERREUR_CONNEXION), 401
            jeton = security.ouvrir_session(cx, u["id"], ip_client(), request.headers.get("User-Agent"))
            g.user = {"id": u["id"]}
            auditer("session.ouverture", ressource=f"user:{u['id']}", cx=cx)
            cx.valider()
        finally:
            cx.fermer()
        rep = jsonify(moi=_moi(u))
        security.poser_cookies(rep, jeton, config.https_force())
        return rep

    @app.delete("/api/sessions/courante")
    @connectee
    def deconnexion():
        cx = db.connecter()
        try:
            security.revoquer_session(cx, g.user["session_id"])
            auditer("session.fermeture", ressource=f"user:{g.user['id']}", cx=cx)
            cx.valider()
        finally:
            cx.fermer()
        rep = jsonify(ok=True)
        security.effacer_cookies(rep)
        return rep

    @app.get("/api/moi")
    @connectee
    def moi():
        return jsonify(moi=_moi(g.user))

    @app.post("/api/moi/mot-de-passe")
    @connectee
    def changer_mot_de_passe():
        d = v.corps_json(request)
        ancien = v.texte(d, "ancien", maxi=MDP_MAX)
        nouveau = v.texte(d, "nouveau", mini=MDP_MIN, maxi=MDP_MAX)
        cx = db.connecter()
        try:
            u = cx.un("SELECT password_hash FROM users WHERE id = ?", (g.user["id"],))
            if not security.verifier_mot_de_passe(ancien, u["password_hash"]):
                auditer("compte.mot_de_passe", ressource=f"user:{g.user['id']}", resultat="refus", cx=cx)
                cx.valider()
                return jsonify(erreur="Mot de passe actuel incorrect.", champ="ancien"), 403
            cx.execute("UPDATE users SET password_hash = ? WHERE id = ?", (security.hacher_mot_de_passe(nouveau), g.user["id"]))
            # Toutes les AUTRES sessions tombent : un voleur de session est mis dehors
            security.revoquer_toutes(cx, g.user["id"], sauf=g.user["session_id"])
            auditer("compte.mot_de_passe", ressource=f"user:{g.user['id']}", cx=cx)
            cx.valider()
        finally:
            cx.fermer()
        return jsonify(ok=True)

    @app.post("/api/comptes/reinitialisation")
    @ouverte
    def demander_reinitialisation():
        d = v.corps_json(request)
        email = v.email(d)
        if _trop([("reinit:ip", ip_client()), ("reinit:compte", email)]):
            return _limite()
        cx = db.connecter()
        try:
            u = cx.un("SELECT id, nom FROM users WHERE email = ? AND actif = 1", (email,))
            if u:
                jeton = security.creer_jeton_usage_unique(cx, u["id"], "reinitialisation", timedelta(hours=1))
                mailer.preparer(cx, email, "Réinitialiser votre mot de passe — Sōzō",
                                f"Bonjour {u['nom']},\n\nChoisissez un nouveau mot de passe : /app/connexion.html?reinitialiser={jeton}\n"
                                "Ce lien expire dans une heure et ne sert qu'une fois.\n")
            auditer("compte.reinitialisation.demande", ressource=email, cx=cx)
            cx.valider()
        finally:
            cx.fermer()
        # Même réponse que le compte existe ou non : pas de liste d'adresses à deviner.
        return jsonify(ok=True, email="capture"), 202

    @app.post("/api/comptes/reinitialisation/confirmer")
    @ouverte
    def confirmer_reinitialisation():
        d = v.corps_json(request)
        jeton = v.texte(d, "jeton", maxi=100)
        nouveau = v.texte(d, "nouveau", mini=MDP_MIN, maxi=MDP_MAX)
        cx = db.connecter()
        try:
            uid = security.consommer_jeton(cx, jeton, "reinitialisation")
            if not uid:
                auditer("compte.reinitialisation", resultat="refus", cx=cx)
                cx.valider()
                return jsonify(erreur="Ce lien n'est plus valable. Demandez-en un nouveau."), 400
            cx.execute("UPDATE users SET password_hash = ? WHERE id = ?", (security.hacher_mot_de_passe(nouveau), uid))
            security.revoquer_toutes(cx, uid)
            auditer("compte.reinitialisation", ressource=f"user:{uid}", cx=cx)
            cx.valider()
        finally:
            cx.fermer()
        return jsonify(ok=True)

    @app.post("/api/comptes/verification")
    @ouverte
    def verifier_email():
        d = v.corps_json(request)
        jeton = v.texte(d, "jeton", maxi=100)
        if _trop([("verification:ip", ip_client())]):
            return _limite()
        cx = db.connecter()
        try:
            uid = security.consommer_jeton(cx, jeton, "verification")
            if not uid:
                cx.valider()
                return jsonify(erreur="Ce lien de vérification n'est plus valable."), 400
            cx.execute("UPDATE users SET email_verifie_at = ? WHERE id = ? AND email_verifie_at IS NULL", (v.maintenant(), uid))
            auditer("compte.verification", ressource=f"user:{uid}", cx=cx)
            cx.valider()
        finally:
            cx.fermer()
        return jsonify(ok=True)

    @app.get("/api/dev/boite")
    @ouverte
    def boite_de_test():
        """Boîte aux lettres de DÉVELOPPEMENT : les e-mails capturés, pour
        tester vérification et réinitialisation sans fournisseur. Existe
        seulement en SOZO_MODE_TEST, lui-même refusé sur une base distante."""
        if not config.mode_test():
            return jsonify(erreur="Introuvable."), 404
        cx = db.connecter()
        try:
            return jsonify(emails=cx.tous("SELECT id, destinataire, sujet, texte AS corps, etat, created_at FROM envois WHERE canal = 'email' ORDER BY id DESC LIMIT 20"))
        finally:
            cx.fermer()
