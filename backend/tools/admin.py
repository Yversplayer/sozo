"""Comptes d'administration de la plateforme — créés UNIQUEMENT ici, jamais par une route.

    backend_venv/bin/python backend/tools/admin.py creer --email admin@exemple.cd --nom "Prénom Nom"
    backend_venv/bin/python backend/tools/admin.py desactiver --email admin@exemple.cd

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
    ap.add_argument("action", choices=["creer", "desactiver"])
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
        if cx.un("SELECT id FROM admin_users WHERE email = ?", (email,)):
            sys.exit("Un administrateur existe déjà avec cette adresse.")
        mdp = getpass.getpass("Mot de passe (12 caractères au moins) : ")
        if len(mdp) < 12 or mdp != getpass.getpass("Encore une fois : "):
            sys.exit("Mots de passe trop courts ou différents.")
        secret = admin.nouveau_secret_totp()
        cx.execute("INSERT INTO admin_users (email, nom, password_hash, totp_secret, created_at) VALUES (?, ?, ?, ?, ?)",
                   (email, a.nom, security.hacher_mot_de_passe(mdp), secret, validation.maintenant()))
        cx.valider()
        print("\nAdministrateur créé. Ajoutez ce compte à votre application d'authentification :")
        print("  secret :", secret)
        print("  lien   :", admin.uri_totp(secret, email))
        print("\nCe secret ne sera plus jamais affiché.")
    finally:
        cx.fermer()


if __name__ == "__main__":
    main()
