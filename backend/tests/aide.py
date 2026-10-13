"""Outils communs aux tests : une base NEUVE pour chaque classe de tests."""
import os
import shutil
import sys
import tempfile
import unittest

RACINE_BACKEND = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, RACINE_BACKEND)

import config  # noqa: E402
import db  # noqa: E402


def base_neuve():
    """SQLite : un fichier temporaire. PostgreSQL : le schéma de test vidé.
    Jamais la base de développement, jamais une base distante."""
    if config.moteur() == "sqlite":
        d = tempfile.mkdtemp(prefix="sozo-test-")
        os.environ["SOZO_DB_PATH"] = os.path.join(d, "test.db")
        return d
    if config.base_distante():
        raise RuntimeError("Les tests refusent de tourner sur une base distante.")
    schema = config.schema_postgres()
    if schema == "public":
        raise RuntimeError("Les tests PostgreSQL exigent un schéma dédié (SOZO_PG_SCHEMA).")
    import psycopg
    with psycopg.connect(config.url_postgres(), autocommit=True) as c:
        c.execute(f"DROP SCHEMA IF EXISTS {schema} CASCADE")
        c.execute(f"CREATE SCHEMA {schema}")
    return None


class TestBase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls._dossier = base_neuve()
        from app import creer_app
        cls.app = creer_app()
        cls.app.testing = True

    @classmethod
    def tearDownClass(cls):
        if cls._dossier:
            shutil.rmtree(cls._dossier, ignore_errors=True)

    def setUp(self):
        self.client = self.app.test_client()

    def app_neuve(self):
        """Une application qui n'a encore servi aucune requête : on peut y
        greffer une route de test (Flask l'interdit après la première)."""
        from app import creer_app
        a = creer_app()
        a.testing = True
        return a
