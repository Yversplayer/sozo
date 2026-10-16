"""Joue toute la suite contre un VRAI PostgreSQL 16, local et jetable.

Pourquoi : SQLite sert au développement, PostgreSQL porte la production.
Les deux moteurs n'acceptent pas le même SQL et ne se comportent pas pareil
sous concurrence (leçon de Klassio : quatre requêtes refusées par PostgreSQL
n'avaient été vues que comme ça). Aucune donnée réelle ne peut être touchée :
le serveur naît dans un dossier temporaire et disparaît à la fin.

    backend_venv/bin/python backend/tools/pg_tests.py
    backend_venv/bin/python backend/tools/pg_tests.py tests.test_socle
"""
import os
import shutil
import subprocess
import sys
import tempfile

RACINE_BACKEND = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))


def main():
    import pgserver
    dossier = tempfile.mkdtemp(prefix="sozo-pg-")
    srv = pgserver.get_server(dossier, cleanup_mode="stop")
    try:
        # Rôle applicatif NON superutilisateur, SANS BYPASSRLS : comme en
        # production, la Row Level Security s'applique pour de vrai.
        srv.psql("DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sozo_app') THEN CREATE ROLE sozo_app NOLOGIN NOSUPERUSER NOBYPASSRLS; END IF; END $$;")
        srv.psql("GRANT sozo_app TO postgres;")
        env = dict(os.environ, SOZO_DB_BACKEND="postgres", SOZO_DATABASE_URL=srv.get_uri(), SOZO_PG_SCHEMA="sozo_test", SOZO_PG_ROLE="sozo_app")
        cible = sys.argv[1:] or ["discover", "-s", "tests", "-t", "."]
        print("PostgreSQL local :", srv.psql("SELECT version();").strip().splitlines()[2].strip()[:40], flush=True)
        r = subprocess.run([sys.executable, "-W", "ignore", "-m", "unittest", *cible], cwd=RACINE_BACKEND, env=env)
        return r.returncode
    finally:
        srv.cleanup()
        shutil.rmtree(dossier, ignore_errors=True)


if __name__ == "__main__":
    sys.exit(main())
