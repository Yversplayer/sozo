"""21/10/2026 — lot D : Bible (recherche, verset du jour, versets gardés) et
liseuse (recherche dans un livre, marque-pages). La règle qui compte : une
recherche ne lit QUE les pages que la personne a le droit de lire — une page
payante non achetée ne laisse fuir ni un mot, ni même son numéro."""
import os

from tests.aide import Personne, TestBase, confirmer_paiement


class Bible(TestBase):
    def test_recherche_dans_toute_la_bible(self):
        p = Personne(self.app)
        r = p.get("/api/bible/recherche?q=berger je ne manquerai").get_json()
        self.assertIn({"b": 19, "c": 23, "v": 1}, [{k: x[k] for k in ("b", "c", "v")} for x in r["versets"]])
        # sans accents ni majuscules : « eternel » trouve « Éternel »
        self.assertGreater(p.get("/api/bible/recherche?q=eternel").get_json()["total"], 100)
        self.assertEqual(p.get("/api/bible/recherche?q=ab").status_code, 400)

    def test_verset_du_jour_et_versets_gardes(self):
        a, b = Personne(self.app), Personne(self.app)
        j = a.get("/api/bible/jour").get_json()["verset"]
        self.assertTrue(j["t"])
        vid = a.post("/api/versets", {"b": 43, "c": 3, "v1": 16}).get_json()["id"]
        self.assertEqual(a.post("/api/versets", {"b": 43, "c": 3, "v1": 16}).get_json()["id"], vid)      # pas de doublon
        self.assertEqual(a.post("/api/versets", {"b": 43, "c": 99, "v1": 1}).status_code, 400)          # inexistant
        self.assertEqual(b.get("/api/versets").get_json()["versets"], [])
        self.assertEqual(b.delete(f"/api/versets/{vid}").status_code, 404)
        self.assertEqual(a.delete(f"/api/versets/{vid}").status_code, 200)


class Liseuse(TestBase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        os.environ["SOZO_MODE_TEST"] = "1"

    def test_la_recherche_ne_lit_que_les_pages_lisibles(self):
        auteur = Personne(self.app, "auteur")
        slug = auteur.livre()                         # pages 1-2 gratuites, 3-4 payantes publiées, 5-6 brouillons
        lecteur = Personne(self.app)
        trouve = lambda p, q: [x["n"] for x in p.get(f"/api/livres/{slug}/recherche?q={q}").get_json()["resultats"]]
        self.assertEqual(trouve(lecteur, "secret"), [1, 2])                                  # ni 3-4 (payantes), ni 5-6
        self.assertEqual(trouve(lecteur, "page 3"), [])                                      # pas même son numéro
        pid = lecteur.post("/api/paiements", {"objet": "page", "livre": slug, "n": 3, "idempotency_key": "recherche-p3"}).get_json()["paiement"]["id"]
        confirmer_paiement(pid)
        self.assertEqual(trouve(lecteur, "page 3"), [3])                                     # achetée : elle répond
        self.assertEqual(trouve(auteur, "secret"), [1, 2, 3, 4, 5, 6])                       # l'auteur lit tout

    def test_marque_pages(self):
        auteur = Personne(self.app, "auteur")
        slug = auteur.livre()
        a, b = Personne(self.app), Personne(self.app)
        sid = a.post("/api/signets", {"livre": slug, "n": 2}).get_json()["id"]
        self.assertEqual(a.post("/api/signets", {"livre": slug, "n": 3}).status_code, 403)    # payante non achetée
        self.assertEqual(a.post("/api/signets", {"livre": slug, "n": 6}).status_code, 404)    # brouillon
        self.assertEqual([s["n"] for s in a.get(f"/api/signets?livre={slug}").get_json()["signets"]], [2])
        self.assertEqual(b.get("/api/signets").get_json()["signets"], [])
        self.assertEqual(b.delete(f"/api/signets/{sid}").status_code, 404)
        self.assertEqual(a.delete(f"/api/signets/{sid}").status_code, 200)


class VersetsEnCouleur(TestBase):
    """22/10/2026 : un verset gardé porte une couleur choisie sur une liste fermée ;
    le garder de nouveau change sa couleur, sans doublon."""

    def test_couleur_sur_liste_fermee(self):
        a = Personne(self.app)
        vid = a.post("/api/versets", {"b": 19, "c": 23, "v1": 1, "couleur": "rose"}).get_json()["id"]
        self.assertEqual(a.post("/api/versets", {"b": 19, "c": 23, "v1": 1, "couleur": "#ff0000"}).status_code, 400)
        self.assertEqual(a.post("/api/versets", {"b": 19, "c": 23, "v1": 1, "couleur": "ciel"}).get_json()["id"], vid)
        l = a.get("/api/versets").get_json()["versets"]
        self.assertEqual([(x["id"], x["couleur"]) for x in l], [(vid, "ciel")])
        self.assertEqual(a.post("/api/versets", {"b": 43, "c": 3, "v1": 16}).status_code, 201)
        self.assertIn("or", [x["couleur"] for x in a.get("/api/versets").get_json()["versets"]])
