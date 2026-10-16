"""Isolation derrière un pooler en MODE TRANSACTION (Supavisor, port 6543).

Défaut reproduit le 16/10/2026 : le rôle et `app.user_id` étaient posés pour la
SESSION ; le pooler envoyait les requêtes sur une autre connexion serveur,
réglée pour quelqu'un d'autre. Résultat : 12 transactions sur 12 avec une
identité fausse, une lectrice privée de la page qu'elle avait payée (402), ses
reçus disparus, la RLS sans effet. Ces tests tournent derrière un vrai pooler
de test (tools/pooler_test.py), deux connexions serveur pour 4 personnes.
Ne s'exécute que sous PostgreSQL local (pg_tests.py)."""
import os
import socket
import subprocess
import sys
import unittest

import config
import db
from tests.aide import Personne, TestBase, confirmer_paiement

RACINE = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


def _socket_pg():
    url = config.url_postgres() if config.moteur() == "postgres" else ""
    return url.split("host=")[1].split("&")[0] if "host=/" in url else None


@unittest.skipUnless(config.moteur() == "postgres" and os.environ.get("SOZO_PG_ROLE") and _socket_pg(),
                     "PostgreSQL local (socket) avec rôle applicatif uniquement")
class DerriereLePooler(TestBase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        os.environ["SOZO_MODE_TEST"] = "1"
        cls.direct = config.url_postgres()
        s = socket.socket()
        s.bind(("127.0.0.1", 0))
        port = s.getsockname()[1]
        s.close()
        cls.pooler = subprocess.Popen([sys.executable, os.path.join(RACINE, "tools", "pooler_test.py"), _socket_pg(), str(port), "2",
                                       config.schema_postgres()], stdout=subprocess.PIPE, text=True, env=dict(os.environ, POOL_MODE="transaction"))
        assert cls.pooler.stdout.readline().strip() == "pret"
        cls.url_pooler = f"postgresql://postgres@127.0.0.1:{port}/postgres"
        # Données posées en direct ; seules les lectures passent par le pooler.
        cls.a, cls.b, cls.x = Personne(cls.app, nom="Lectrice A"), Personne(cls.app, nom="Lecteur B"), Personne(cls.app, "auteur", nom="Autrice X")
        cls.slug = cls.x.livre("Livre X", publier=(1, 2, 3, 4))
        r = cls.a.post("/api/paiements", {"objet": "page", "livre": cls.slug, "n": 3, "idempotency_key": "pooler-cle-a"})
        cls.pid = r.get_json()["paiement"]["id"]
        assert confirmer_paiement(cls.pid)

    @classmethod
    def tearDownClass(cls):
        cls.pooler.terminate()
        cls.pooler.wait()
        os.environ["SOZO_DATABASE_URL"] = cls.direct
        super().tearDownClass()

    def setUp(self):
        super().setUp()
        os.environ["SOZO_DATABASE_URL"] = self.url_pooler

    def tearDown(self):
        os.environ["SOZO_DATABASE_URL"] = self.direct

    def test_chaque_transaction_porte_sa_propre_identite(self):
        import flask
        with self.app.test_request_context("/"):
            for i in range(12):
                qui = [None, self.a, self.b, self.x][i % 4]
                flask.g.user = {"id": qui.id} if qui else None
                cx = db.connecter(globale=qui is None)
                try:
                    for _ in range(2):          # et encore après une validation
                        r = cx.un("""SELECT current_user AS role, current_setting('app.user_id', true) AS uid,
                                            current_setting('app.global', true) AS glob""")
                        self.assertEqual((r["role"], r["uid"] or "", r["glob"] or ""),
                                         (os.environ["SOZO_PG_ROLE"], str(qui.id) if qui else "", "1" if qui is None else ""))
                        cx.valider()
                finally:
                    cx.fermer()

    def test_la_rls_seule_ne_montre_rien_d_autrui(self):
        import flask
        with self.app.test_request_context("/"):
            for _ in range(4):
                flask.g.user = None
                cg = db.connecter(globale=True)
                cg.un("SELECT 1")
                cg.valider()
                cg.fermer()
                flask.g.user = {"id": self.b.id}
                cx = db.connecter()
                try:
                    self.assertEqual(cx.un("SELECT COUNT(*) AS n FROM payments")["n"], 0)   # aucun filtre : la base filtre
                finally:
                    cx.fermer()

    def test_les_droits_payes_restent_aux_bons_lecteurs(self):
        for _ in range(4):
            r = self.a.get(f"/api/livres/{self.slug}/pages/3")
            self.assertEqual(r.status_code, 200, r.get_json())
            self.assertIn("Texte secret de la page 3", r.get_json()["contenu"])
            self.assertEqual(self.a.get(f"/api/paiements/{self.pid}").status_code, 200)
            self.assertEqual(len(self.a.get("/api/compte").get_json()["achats"]), 1)
            self.assertEqual(self.b.get(f"/api/livres/{self.slug}/pages/3").status_code, 402)
            self.assertEqual(self.b.get(f"/api/paiements/{self.pid}").status_code, 404)
            self.assertEqual(self.a.get(f"/api/livres/{self.slug}/pages/5").status_code, 404)      # brouillon
            self.assertEqual(self.x.get("/api/studio/ventes").get_json()["livres"][0]["ventes"], 1)

    def test_requetes_repetees_sans_erreur_de_requete_preparee(self):
        for _ in range(8):                      # psycopg préparait au 5e passage
            self.assertEqual(self.a.get(f"/api/studio/livres/{self.slug}").status_code, 404)
            self.assertEqual(self.x.get(f"/api/studio/livres/{self.slug}").status_code, 200)


@unittest.skipUnless(config.moteur() == "postgres", "PostgreSQL uniquement")
class RoleAuDemarrage(unittest.TestCase):
    def test_base_distante_sans_role_applicatif_refusee(self):
        from unittest import mock
        with mock.patch.object(config, "base_distante", return_value=True), mock.patch.dict(os.environ, {"SOZO_PG_ROLE": ""}):
            with self.assertRaises(RuntimeError):
                db.verifier_role(None)

    def test_base_distante_avec_role_qui_contourne_la_rls_refusee(self):
        from unittest import mock

        class Cx:
            def un(self, *a):
                return {"rolsuper": False, "rolbypassrls": True}
        with mock.patch.object(config, "base_distante", return_value=True), mock.patch.dict(os.environ, {"SOZO_PG_ROLE": "sozo_app"}):
            with self.assertRaises(RuntimeError):
                db.verifier_role(Cx())
