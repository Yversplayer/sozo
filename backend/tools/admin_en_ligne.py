"""Créer (ou gérer) un compte d'administration sur la base EN LIGNE (Supabase).

Le mot de passe de la base est demandé au clavier, jamais écrit dans une
commande, un fichier ou l'historique du terminal ; l'adresse complète n'existe
que dans la mémoire de ce processus.

    backend_venv/bin/python backend/tools/admin_en_ligne.py --projet <ref> --port 6543 \\
        creer --email vous@exemple.cd --nom "Prénom Nom" --roles finance,lecture,moderation

Port 5432 (pooler, mode session) ou 6543 (mode transaction, sûr depuis le
16/10/2026) : prendre 6543 si le réseau local bloque le 5432.
"""
import getpass
import os
import re
import subprocess
import sys
from urllib.parse import quote

ICI = os.path.dirname(os.path.abspath(__file__))


def main():
    args = sys.argv[1:]
    if "--projet" not in args:
        sys.exit("Indiquez --projet <identifiant du projet Supabase>.")
    i = args.index("--projet")
    projet = args[i + 1]
    del args[i:i + 2]
    port = "6543"
    if "--port" in args:
        i = args.index("--port")
        port = args[i + 1]
        del args[i:i + 2]
    if not projet.isalnum() or port not in ("5432", "6543"):
        sys.exit("Projet ou port invalide.")
    mdp = getpass.getpass("Collez l'adresse SOZO_DATABASE_URL de Render, ou le seul mot de passe de la base (rien ne s'affiche, c'est normal) : ").strip()
    if not mdp:
        sys.exit("Rien n'a été collé.")
    if mdp.startswith(("postgresql://", "postgres://")):
        # l'adresse entière, copiée depuis Render : on n'en change que le port
        # (le réseau local peut bloquer le 5432)
        url = re.sub(r":(5432|6543)/", f":{port}/", mdp, count=1)
    else:
        url = f"postgresql://postgres.{projet}:{quote(mdp, safe='')}@aws-1-eu-central-1.pooler.supabase.com:{port}/postgres"
    env = dict(os.environ, SOZO_DB_BACKEND="postgres", SOZO_DATABASE_URL=url, SOZO_PG_SCHEMA="public", SOZO_PG_ROLE="sozo_app")
    env.pop("SOZO_MODE_TEST", None)
    r = subprocess.run([sys.executable, os.path.join(ICI, "admin.py"), *args], env=env)
    sys.exit(r.returncode)


if __name__ == "__main__":
    main()
