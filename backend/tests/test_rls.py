"""Row Level Security : la base elle-même refuse de rendre les lignes d'autrui.
Ne s'exécute que sous PostgreSQL (SQLite n'a pas de RLS)."""
import os
import unittest

import config
import db
from tests.aide import Personne, TestBase, confirmer_paiement


@unittest.skipUnless(config.moteur() == "postgres" and os.environ.get("SOZO_PG_ROLE"), "PostgreSQL avec rôle applicatif uniquement")
class Rls(TestBase):
    def test_une_connexion_ne_voit_que_ses_lignes(self):
        os.environ["SOZO_MODE_TEST"] = "1"
        slug = Personne(self.app, "auteur").livre()
        a, b = Personne(self.app), Personne(self.app)
        pa = a.post("/api/paiements", {"objet": "page", "livre": slug, "n": 3, "idempotency_key": "rls-cle-a"}).get_json()["paiement"]["id"]
        confirmer_paiement(pa)
        import flask
        with self.app.test_request_context("/"):
            for qui, attendu in ((a, 1), (b, 0)):
                flask.g.user = {"id": qui.id}
                cx = db.connecter()
                try:
                    # AUCUN filtre user_id dans la requête : c'est la base qui filtre
                    self.assertEqual(cx.un("SELECT COUNT(*) AS n FROM payments")["n"], attendu)
                    self.assertEqual(cx.un("SELECT COUNT(*) AS n FROM entitlements")["n"], attendu)
                    self.assertEqual(cx.un("SELECT COUNT(*) AS n FROM receipts")["n"], attendu)
                finally:
                    cx.fermer()
            flask.g.user = None
            cx = db.connecter()                       # sans contexte : rien
            try:
                self.assertEqual(cx.un("SELECT COUNT(*) AS n FROM payments")["n"], 0)
            finally:
                cx.fermer()
