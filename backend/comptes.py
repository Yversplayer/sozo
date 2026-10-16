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
import notifications
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

    def _masquer(email):
        nom, _, dom = email.partition("@")
        return (nom[:2] + "•" * max(1, len(nom) - 2)) + "@" + dom

    def _envoyer_code(cx, u, objet):
        code = security.creer_code(cx, u["id"], objet)
        minutes = int(security.DUREE_CODE.total_seconds() // 60)
        titre = "Votre code Sōzō" if objet == "reinitialisation" else "Code pour changer votre mot de passe"
        html, texte = gabarits.page(titre, [f"Bonjour {u['nom']},",
                                            "Voici votre code pour choisir un nouveau mot de passe :" if objet == "reinitialisation"
                                            else "Voici votre code pour confirmer le changement de votre mot de passe :"],
                                    code=code,
                                    note=f"Il est valable {minutes} minutes et ne sert qu’une fois. Personne chez Sōzō ne vous le demandera jamais. "
                                         "Si vous n’êtes pas à l’origine de cette demande, ignorez ce message : votre mot de passe ne change pas.",
                                    raison="Vous recevez ce message parce qu’un code a été demandé pour votre compte Sōzō.")
        mailer.preparer(cx, u["email"], f"{code} — {titre}", texte, html, user_id=u["id"], sensible=True)
        return minutes

    def _alerte_mot_de_passe(cx, u):
        html, texte = gabarits.page("Votre mot de passe a changé", [f"Bonjour {u['nom']},",
                                    "Le mot de passe de votre compte Sōzō vient d’être modifié. Vos autres sessions ont été fermées."],
                                    note="Si ce n’est pas vous, répondez immédiatement à ce message : nous bloquerons le compte.",
                                    raison="Message de sécurité, envoyé à chaque changement de mot de passe.")
        mailer.preparer(cx, u["email"], "Votre mot de passe Sōzō a changé", texte, html, user_id=u["id"])

    @app.post("/api/moi/mot-de-passe/code")
    @connectee
    def code_mot_de_passe():
        """Changer de mot de passe exige, en plus de l'actuel, un code reçu par
        e-mail : une session volée (téléphone prêté, poste partagé) ne suffit
        plus à prendre le compte."""
        cx = db.connecter()
        try:
            if security.depasse(cx, "codemdp:compte", str(g.user["id"])):
                cx.valider()
                return _limite()
            u = cx.un("SELECT id, nom, email FROM users WHERE id = ?", (g.user["id"],))
            minutes = _envoyer_code(cx, u, "changement")
            auditer("compte.code_mot_de_passe", ressource=f"user:{u['id']}", cx=cx)
            cx.valider()
        finally:
            cx.fermer()
        envois.declencher()
        return jsonify(ok=True, envoye_a=_masquer(u["email"]), minutes=minutes, email=config.email_mode() != "capture" and "envoi" or "capture"), 202

    @app.post("/api/moi/mot-de-passe")
    @connectee
    def changer_mot_de_passe():
        d = v.corps_json(request)
        ancien = v.texte(d, "ancien", maxi=MDP_MAX)
        nouveau = v.texte(d, "nouveau", mini=MDP_MIN, maxi=MDP_MAX)
        code = v.texte(d, "code", maxi=6)
        cx = db.connecter()
        try:
            if security.depasse(cx, "mdp:compte", str(g.user["id"])):
                cx.valider()
                return _limite()
            u = cx.un("SELECT id, nom, email, password_hash FROM users WHERE id = ?", (g.user["id"],))
            if not security.verifier_mot_de_passe(ancien, u["password_hash"]):
                auditer("compte.mot_de_passe", ressource=f"user:{g.user['id']}", resultat="refus", cx=cx)
                cx.valider()
                return jsonify(erreur="Mot de passe actuel incorrect.", champ="ancien"), 403
            if not security.verifier_code(cx, u["id"], "changement", code):
                auditer("compte.mot_de_passe", ressource=f"user:{g.user['id']}", apres="code", resultat="refus", cx=cx)
                cx.valider()             # l'essai est compté même s'il échoue
                return jsonify(erreur="Code incorrect ou expiré. Après 5 essais, demandez un nouveau code.", champ="code"), 403
            cx.execute("UPDATE users SET password_hash = ? WHERE id = ?", (security.hacher_mot_de_passe(nouveau), g.user["id"]))
            # Toutes les AUTRES sessions tombent : un voleur de session est mis dehors
            security.revoquer_toutes(cx, g.user["id"], sauf=g.user["session_id"])
            # Cloche + appareil + e-mail (la sécurité part toujours par e-mail)
            notifications.emettre(cx, u["id"], "securite", "Votre mot de passe a changé",
                                  "Vos autres sessions ont été fermées. Si ce n’est pas vous, répondez à l’e-mail reçu.",
                                  "/app/compte.html", f"securite:mdp:{v.maintenant()}",
                                  email=("Votre mot de passe a changé", ["Le mot de passe de votre compte Sōzō vient d’être modifié. Vos autres sessions ont été fermées.",
                                                                         "Si ce n’est pas vous, répondez immédiatement à ce message : nous bloquerons le compte."]))
            auditer("compte.mot_de_passe", ressource=f"user:{g.user['id']}", cx=cx)
            cx.valider()
        finally:
            cx.fermer()
        envois.declencher()
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
            u = cx.un("SELECT id, nom, email FROM users WHERE email = ? AND actif = 1", (email,))
            if u:
                _envoyer_code(cx, u, "reinitialisation")
            auditer("compte.reinitialisation.demande", ressource=email, cx=cx)
            cx.valider()
        finally:
            cx.fermer()
        envois.declencher()
        # Même réponse que le compte existe ou non : pas de liste d'adresses à deviner.
        return jsonify(ok=True, minutes=int(security.DUREE_CODE.total_seconds() // 60),
                       email=config.email_mode() != "capture" and "envoi" or "capture"), 202

    @app.post("/api/comptes/reinitialisation/confirmer")
    @ouverte
    def confirmer_reinitialisation():
        d = v.corps_json(request)
        email = v.email(d)
        code = v.texte(d, "code", maxi=6)
        nouveau = v.texte(d, "nouveau", mini=MDP_MIN, maxi=MDP_MAX)
        if _trop([("code:ip", ip_client()), ("code:compte", email)]):
            return _limite()
        cx = db.connecter()
        try:
            u = cx.un("SELECT id, nom, email FROM users WHERE email = ? AND actif = 1", (email,))
            # Compte inconnu, code faux, expiré ou épuisé : UNE seule réponse.
            # Sinon, demander un code puis en essayer un faux dirait si l'adresse a un compte.
            if not u or not security.verifier_code(cx, u["id"], "reinitialisation", code):
                auditer("compte.reinitialisation", ressource=email, resultat="refus", cx=cx)
                cx.valider()
                return jsonify(erreur="Code incorrect ou expiré. Après 5 essais, demandez un nouveau code.", champ="code"), 400
            cx.execute("UPDATE users SET password_hash = ? WHERE id = ?", (security.hacher_mot_de_passe(nouveau), u["id"]))
            security.revoquer_toutes(cx, u["id"])
            _alerte_mot_de_passe(cx, u)
            auditer("compte.reinitialisation", ressource=f"user:{u['id']}", cx=cx)
            cx.valider()
        finally:
            cx.fermer()
        envois.declencher()
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

    @app.get("/api/etat")
    @ouverte
    def etat_public():
        """Ce que l'interface doit DIRE honnêtement : les e-mails partent-ils,
        les notifications d'appareil sont-elles possibles. Aucun secret."""
        return jsonify(email="capture" if config.email_mode() == "capture" else "envoi", push=config.push_actif(),
                       contact=config.email_contact())

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
