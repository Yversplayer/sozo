"""Poids et cache (test de charge du 16/10/2026) : ce que la personne paie
sur son forfait. Le catalogue (231 Ko) et les fichiers de l'application
partaient non compressés, et étaient revérifiés à chaque page."""
import gzip

from tests.aide import Personne, TestBase


class Poids(TestBase):
    def test_fichier_versionne_compresse_et_garde_un_an(self):
        c = self.app.test_client()
        r = c.get("/app/app.css?v=99", headers={"Accept-Encoding": "gzip"})
        self.assertEqual(r.headers.get("Content-Encoding"), "gzip")
        self.assertIn("immutable", r.headers["Cache-Control"])
        brut = c.get("/app/app.css?v=99").get_data()              # sans gzip demandé : en clair
        self.assertEqual(gzip.decompress(r.get_data()), brut)
        self.assertLess(len(r.get_data()), len(brut) / 3)

    def test_page_html_toujours_reverifiee(self):
        r = self.app.test_client().get("/app/decouvrir.html", headers={"Accept-Encoding": "gzip"})
        self.assertEqual(r.headers["Cache-Control"], "no-cache")

    def test_fichier_non_versionne_reverifie_et_304(self):
        c = self.app.test_client()
        r = c.get("/assets/theme.js", headers={"Accept-Encoding": "gzip"})
        self.assertEqual(r.headers["Cache-Control"], "no-cache")
        etag = r.headers.get("ETag")
        self.assertTrue(etag)
        r2 = c.get("/assets/theme.js", headers={"Accept-Encoding": "gzip", "If-None-Match": etag})
        self.assertEqual(r2.status_code, 304)                      # revalidation : rien n'est retéléchargé

    def test_api_compressee_mais_jamais_en_cache(self):
        p = Personne(self.app)
        r = p.get("/api/catalogue", headers={"Accept-Encoding": "gzip"})
        self.assertEqual(r.headers["Cache-Control"], "no-store")
        if len(r.get_data()) > 0 and r.headers.get("Content-Encoding") == "gzip":
            self.assertTrue(gzip.decompress(r.get_data()).startswith(b"{"))

    def test_sans_gzip_demande_rien_ne_change(self):
        r = self.app.test_client().get("/app/app.css?v=99")
        self.assertIsNone(r.headers.get("Content-Encoding"))


class VitrineEnCache(TestBase):
    """Le cache court du catalogue ne garde que le PUBLIC : les droits, les
    brouillons et l'état des pages restent propres à chaque personne."""

    def test_droits_propres_a_chacun_meme_cache_chaud(self):
        import os
        from tests.aide import confirmer_paiement
        os.environ["SOZO_MODE_TEST"] = "1"
        auteur = Personne(self.app, "auteur")
        slug = auteur.livre(prix=(25, 75, 300))                    # 1-4 publiées (3-4 payantes), 5-6 brouillons
        a, b = Personne(self.app), Personne(self.app)
        pid = a.post("/api/paiements", {"objet": "livre", "livre": slug, "idempotency_key": "test-cle-vitrine"}).get_json()["paiement"]["id"]
        confirmer_paiement(pid)
        etat = lambda p: {x["n"]: x["etat"] for x in next(l for l in p.get("/api/catalogue").get_json()["books"] if l["id"] == slug)["pages"]}
        ea, eb = etat(a), etat(b)                                   # le second appel sert depuis le cache
        self.assertEqual((ea[3], eb[3]), ("owned", "locked"))
        self.assertNotIn(5, eb)                                     # brouillon d'autrui : absent
        self.assertIn(5, {x["n"] for x in next(l for l in auteur.get("/api/catalogue").get_json()["books"] if l["id"] == slug)["pages"]})
        self.assertNotIn(5, etat(b))                                # même juste après l'appel de l'auteur

    def test_publication_visible_tout_de_suite(self):
        auteur = Personne(self.app, "auteur")
        slug = auteur.livre()
        lecteur = Personne(self.app)
        lecteur.get("/api/catalogue")                               # cache chaud
        auteur.put(f"/api/studio/livres/{slug}/pages/5", {"contenu": "Cinq"})
        auteur.post(f"/api/studio/livres/{slug}/pages/lot", {"pages": [5], "action": "publier"})
        pages = next(l for l in lecteur.get("/api/catalogue").get_json()["books"] if l["id"] == slug)["pages"]
        self.assertIn(5, {x["n"] for x in pages})
