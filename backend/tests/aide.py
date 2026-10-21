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
        role = os.environ.get("SOZO_PG_ROLE")
        if role:   # le rôle applicatif crée et possède les tables, sans BYPASSRLS
            c.execute(f"GRANT USAGE, CREATE ON SCHEMA {schema} TO {role}")
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


# ── Outils pour les étapes 3 à 6 ──────────────────────────────────────────
import itertools  # noqa: E402

_compteur = itertools.count(1)
MDP = "Lumiere-2026!"


class Personne:
    """Un client de test connecté, avec son jeton CSRF posé sur chaque mutation."""

    def __init__(self, app, role="lecteur", nom=None, charte=True):
        self.c = app.test_client()
        k = next(_compteur)
        self.email = f"p{k}-{os.getpid()}@exemple.cd"
        r = self.c.post("/api/comptes", json={"nom": nom or f"Personne {k}", "email": self.email, "mot_de_passe": MDP, "role": role, "cgu": True},
                        environ_base={"REMOTE_ADDR": f"10.{k // 250}.{k % 250}.1"})
        assert r.status_code == 201, r.get_json()
        self.id = r.get_json()["moi"]["id"]
        if charte:
            # Lot E : publier ou commenter exige la charte acceptée. Par défaut,
            # une personne de test l'a acceptée ; test_lot_e éprouve le cas contraire.
            import charte as ch
            assert self.post("/api/moi/charte", {"version": ch.VERSION}).status_code == 200

    def _h(self):
        import security
        ck = self.c.get_cookie(security.COOKIE_CSRF)
        return {security.EN_TETE_CSRF: ck.value if ck else ""}

    def get(self, url, **k):
        return self.c.get(url, **k)

    def post(self, url, json=None, **k):
        return self.c.post(url, json=json if json is not None else {}, headers=self._h(), **k)

    def put(self, url, json=None):
        return self.c.put(url, json=json or {}, headers=self._h())

    def patch(self, url, json=None):
        return self.c.patch(url, json=json or {}, headers=self._h())

    def delete(self, url):
        return self.c.delete(url, headers=self._h())

    def livre(self, titre="Livre", acces="mixed", prix=(25, 75, 300), pages=6, publier=(1, 2, 3, 4), payantes=(3, 4, 5, 6)):
        r = self.post("/api/studio/livres", {"titre": titre, "categorie": "Foi", "mode": "progressive", "acces": acces,
                                            "prix_page": prix[0], "prix_chapitre": prix[1], "prix_livre": prix[2], "couverture": "couv-mer"})
        assert r.status_code == 201, r.get_json()
        slug = r.get_json()["livre"]["id"]
        for i in range(1, pages + 1):
            self.post(f"/api/studio/livres/{slug}/pages", {"contenu": f"Texte secret de la page {i}.\nDeuxième paragraphe."})
        self.put(f"/api/studio/livres/{slug}/chapitres", {"chapitres": [{"titre": "Un", "page_de": 1, "page_a": 2}, {"titre": "Deux", "page_de": 3, "page_a": pages}]})
        if acces != "free":
            gratuites = [n for n in range(1, pages + 1) if n not in payantes]
            if gratuites:
                assert self.post(f"/api/studio/livres/{slug}/pages/lot", {"pages": gratuites, "action": "gratuit"}).status_code == 200
            if payantes:
                assert self.post(f"/api/studio/livres/{slug}/pages/lot", {"pages": list(payantes), "action": "payant"}).status_code == 200
        if publier:
            assert self.post(f"/api/studio/livres/{slug}/pages/lot", {"pages": list(publier), "action": "publier"}).status_code == 200
        return slug


def confirmer_paiement(pid):
    import argent
    cx = db.connecter(globale=True)        # comme l'administration ou un webhook
    try:
        ok = argent.confirmer(cx, pid, "test")
        cx.valider()
        return ok
    finally:
        cx.fermer()
