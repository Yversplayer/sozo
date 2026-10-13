"""Le socle : en-têtes, liste blanche des fichiers, fermé par défaut, erreurs muettes."""
from flask import jsonify

from tests.aide import TestBase


class EnTetes(TestBase):
    def test_csp_stricte_sur_les_pages_et_l_api(self):
        for url in ("/", "/app/decouvrir.html", "/api/sante"):
            r = self.client.get(url)
            csp = r.headers.get("Content-Security-Policy", "")
            script = [d for d in csp.split(";") if d.strip().startswith("script-src")][0]
            self.assertEqual(script.strip(), "script-src 'self'", url)      # aucun script en ligne, aucun CDN
            self.assertIn("default-src 'none'", csp)
            self.assertIn("frame-ancestors 'none'", csp)
            self.assertEqual(r.headers.get("X-Content-Type-Options"), "nosniff")
            self.assertEqual(r.headers.get("X-Frame-Options"), "DENY")
            self.assertEqual(r.headers.get("Referrer-Policy"), "no-referrer")

    def test_api_jamais_en_cache_partage(self):
        self.assertEqual(self.client.get("/api/sante").headers.get("Cache-Control"), "no-store")


class ListeBlanche(TestBase):
    def test_pages_du_site_servies(self):
        for url in ("/", "/index.html", "/app/connexion.html", "/assets/fonts/fonts.css", "/app/bible/index.json"):
            self.assertEqual(self.client.get(url).status_code, 200, url)

    def test_rien_du_serveur_ne_sort(self):
        for url in ("/backend/app.py", "/backend/config.py", "/backend/sozo.db", "/.env", "/backend/.env",
                    "/backend_venv/pyvenv.cfg", "/.git/config", "/CREDITS.md", "/app/../backend/app.py",
                    "/app/%2e%2e/backend/app.py", "/assets/../backend/db.py", "/app/.cache.html", "/requirements.txt"):
            self.assertEqual(self.client.get(url).status_code, 404, url)

    def test_dossier_hors_liste_refuse_meme_avec_une_extension_permise(self):
        """Sans ce test, la liste des DOSSIERS n'était jamais éprouvée : les
        autres adresses étaient déjà bloquées par leur extension (.py, .db).
        Un .json posé dans backend/ ne peut être arrêté QUE par elle."""
        import os
        from tests.aide import RACINE_BACKEND
        sonde = os.path.join(RACINE_BACKEND, "tests", "_sonde_publique.json")
        with open(sonde, "w") as f:
            f.write('{"secret": "ne doit pas sortir"}')
        try:
            r = self.client.get("/backend/tests/_sonde_publique.json")
            self.assertEqual(r.status_code, 404)
            self.assertNotIn(b"secret", r.data)
        finally:
            os.remove(sonde)

    def test_extension_hors_liste_refusee(self):
        self.assertEqual(self.client.get("/app/data.py").status_code, 404)


class FermeParDefaut(TestBase):
    def test_chaque_route_est_declaree(self):
        from app import routes_non_declarees
        self.assertEqual(routes_non_declarees(self.app), [])

    def test_une_route_oubliee_est_refusee(self):
        # Une route ajoutée SANS @ouverte ni @connectee : elle doit répondre 403.
        app = self.app_neuve()
        app.add_url_rule("/api/oubliee", "oubliee", lambda: jsonify(secret=42))
        r = app.test_client().get("/api/oubliee")
        self.assertEqual(r.status_code, 403)
        self.assertNotIn(b"42", r.data)

    def test_api_inconnue_404_json(self):
        r = self.client.get("/api/nexiste-pas")
        self.assertEqual(r.status_code, 404)
        self.assertEqual(r.get_json(), {"erreur": "Introuvable."})


class ErreursMuettes(TestBase):
    def test_500_sans_chemin_ni_sql(self):
        from app import ouverte

        @ouverte
        def explose():
            raise RuntimeError("SELECT * FROM users WHERE x — /Users/macbookpro/sozo/backend/db.py")
        app = self.app_neuve()
        app.add_url_rule("/api/explose", "explose", explose)
        r = app.test_client().get("/api/explose")
        self.assertEqual(r.status_code, 500)
        corps = r.get_data(as_text=True)
        for fuite in ("SELECT", "/Users", "db.py", "Traceback", "RuntimeError"):
            self.assertNotIn(fuite, corps)
        self.assertIn("reference", r.get_json())
