"""Comptes d'administration de la plateforme — créés UNIQUEMENT ici, jamais par une route.

    backend_venv/bin/python backend/tools/admin.py creer --email admin@exemple.cd --nom "Prénom Nom"
    backend_venv/bin/python backend/tools/admin.py desactiver --email admin@exemple.cd
    backend_venv/bin/python backend/tools/admin.py roles --email admin@exemple.cd --roles finance,moderation
    backend_venv/bin/python backend/tools/admin.py reinitialiser-totp --email admin@exemple.cd

Rôles (moindre privilège) : « lecture » voit tout sans rien changer ;
« finance » confirme, refuse, rembourse et verse ; « moderation » retire des
livres, traite les signalements, désactive des comptes. Un compte n'a QUE les
rôles qu'on lui donne ici.

Téléphone perdu : `reinitialiser-totp` génère un nouveau secret et ferme
toutes les sessions de ce compte. Il n'existe aucune récupération en ligne —
c'est voulu : elle serait la porte d'entrée d'un attaquant.

Le mot de passe est demandé au clavier (jamais en argument : il resterait
dans l'historique du terminal). Le secret TOTP s'affiche UNE fois : à scanner
dans une application d'authentification (Google Authenticator, Aegis…).
"""
import argparse
import getpass
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import admin  # noqa: E402
import db  # noqa: E402
import security  # noqa: E402
import validation  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("action", choices=["creer", "desactiver", "roles", "reinitialiser-totp"])
    ap.add_argument("--roles", default="lecture")
    ap.add_argument("--email", required=True)
    ap.add_argument("--nom", default="Administration")
    a = ap.parse_args()
    email = validation.email({"email": a.email})
    db.appliquer_schema()
    cx = db.connecter()
    try:
        if a.action == "desactiver":
            n = cx.execute("UPDATE admin_users SET actif = 0 WHERE email = ?", (email,)).rowcount
            cx.execute("UPDATE admin_sessions SET revoked_at = ? WHERE admin_id IN (SELECT id FROM admin_users WHERE email = ?) AND revoked_at IS NULL",
                       (validation.maintenant(), email))
            cx.valider()
            print("Désactivé." if n else "Aucun compte avec cette adresse.")
            return
        roles = ",".join(sorted({r.strip() for r in a.roles.split(",") if r.strip()}))
        if not roles or not set(roles.split(",")) <= admin.ROLES:
            sys.exit(f"Rôles possibles : {', '.join(sorted(admin.ROLES))}.")
        if a.action in ("roles", "reinitialiser-totp"):
            ligne = cx.un("SELECT id FROM admin_users WHERE email = ?", (email,))
            if not ligne:
                sys.exit("Aucun compte avec cette adresse.")
            if a.action == "roles":
                cx.execute("UPDATE admin_users SET roles = ? WHERE id = ?", (roles, ligne["id"]))
                print("Rôles :", roles)
            else:
                secret = admin.nouveau_secret_totp()
                cx.execute("UPDATE admin_users SET totp_secret = ?, totp_dernier_pas = 0 WHERE id = ?", (secret, ligne["id"]))
                print("Nouveau secret :", secret, "\nLien :", admin.uri_totp(secret, email))
            # toute modification de sécurité ferme les sessions ouvertes
            cx.execute("UPDATE admin_sessions SET revoked_at = ? WHERE admin_id = ? AND revoked_at IS NULL", (validation.maintenant(), ligne["id"]))
            cx.valider()
            return
        if cx.un("SELECT id FROM admin_users WHERE email = ?", (email,)):
            sys.exit("Un administrateur existe déjà avec cette adresse.")
        mdp = getpass.getpass("Mot de passe (12 caractères au moins) : ")
        if len(mdp) < 12 or mdp != getpass.getpass("Encore une fois : "):
            sys.exit("Mots de passe trop courts ou différents.")
        secret = admin.nouveau_secret_totp()
        cx.execute("INSERT INTO admin_users (email, nom, password_hash, totp_secret, roles, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                   (email, a.nom, security.hacher_mot_de_passe(mdp), secret, roles, validation.maintenant()))
        cx.valider()
        print("\nAdministrateur créé. Ajoutez ce compte à votre application d'authentification :")
        print("  secret :", secret)
        print("  lien   :", admin.uri_totp(secret, email))
        print("\nCe secret ne sera plus jamais affiché.")
    finally:
        cx.fermer()


if __name__ == "__main__":
    main()
