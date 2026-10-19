"""19/10/2026 — personnalisation du livre, pages entières dans l'atelier,
épingles du lecteur, relecture par l'IA. Chaque test protège une règle que
l'interface ne peut pas garantir seule : le navigateur est celui de n'importe qui."""
import base64
import os
from unittest import mock

import db
import ia_correcteur
from tests.aide import Personne, TestBase, confirmer_paiement

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 64
SVG = b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'


def data_uri(octets, mime="image/png"):
    return f"data:{mime};base64," + base64.b64encode(octets).decode()


class Apparence(TestBase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.auteur = Personne(cls.app, "auteur")
        cls.slug = cls.auteur.livre(titre="Couleurs")

    def maj(self, apparence):
        return self.auteur.patch(f"/api/studio/livres/{self.slug}", {"apparence": apparence})

    def test_apparence_enregistree_et_servie_au_lecteur(self):
        a = {"couv": {"fond": "degrade", "couleur1": "#112233", "couleur2": "#aabbcc", "angle": 135, "police_titre": "didone",
                      "capitales": True, "ornement": "cadre", "sous_titre": "Un roman de foi"},
             "page": {"police": "georgia", "lettrine": "ornee", "alignement": "justifie", "interligne": 180, "separateur": "fleuron"}}
        r = self.maj(a)
        self.assertEqual(r.status_code, 200, r.get_json())
        self.assertEqual(r.get_json()["livre"]["apparence"]["couv"]["couleur2"], "#AABBCC")
        lecteur = Personne(self.app)
        livre = next(b for b in lecteur.get("/api/catalogue").get_json()["books"] if b["id"] == self.slug)
        self.assertEqual(livre["apparence"]["page"]["separateur"], "fleuron")

    def test_valeurs_hors_liste_refusees(self):
        for mauvais in (
            {"couv": {"couleur1": "url(https://exemple.com/x.png)"}},     # une « couleur » qui charge un site tiers
            {"couv": {"couleur1": "red; background:url(x)"}},
            {"couv": {"police_titre": "Comic Sans"}},
            {"couv": {"angle": 9999}},
            {"couv": {"capitales": "oui"}},
            {"couv": {"inconnu": 1}},
            {"page": {"interligne": True}},
            {"autre": {}},
            {"couv": {"sous_titre": "x" * 81}},
        ):
            r = self.maj(mauvais)
            self.assertEqual(r.status_code, 400, mauvais)
        # rien de ce qui a été refusé n'a été écrit
        cx = db.connecter(globale=True)
        try:
            brut = cx.un("SELECT apparence FROM books WHERE slug = ?", (self.slug,))["apparence"] or ""
        finally:
            cx.fermer()
        self.assertNotIn("url(", brut)
        self.assertNotIn("Comic", brut)


class Couverture(TestBase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.auteur = Personne(cls.app, "auteur")
        cls.publie = cls.auteur.livre(titre="Publié")
        cls.brouillon = cls.auteur.livre(titre="Secret", publier=())

    def envoyer(self, slug, octets, mime="image/png"):
        return self.auteur.put(f"/api/studio/livres/{slug}/couverture", {"image": data_uri(octets, mime)})

    def test_image_reconnue_par_son_contenu(self):
        self.assertEqual(self.envoyer(self.publie, PNG).status_code, 200)
        self.assertEqual(self.envoyer(self.publie, JPEG, "image/png").status_code, 200)   # le type annoncé ne compte pas
        # Un SVG (qui peut porter du script) annoncé comme PNG est refusé
        self.assertEqual(self.envoyer(self.publie, SVG, "image/png").status_code, 400)
        self.assertEqual(self.auteur.put(f"/api/studio/livres/{self.publie}/couverture", {"image": "pas une image"}).status_code, 400)
        trop = PNG + b"\x00" * (2 * 1024 * 1024)
        self.assertEqual(self.envoyer(self.publie, trop).status_code, 400)

    def test_servie_a_qui_voit_le_livre_seulement(self):
        self.assertEqual(self.envoyer(self.publie, JPEG).status_code, 200)
        self.assertEqual(self.envoyer(self.brouillon, PNG).status_code, 200)
        lecteur = Personne(self.app)
        r = lecteur.get(f"/api/livres/{self.publie}/couverture")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.mimetype, "image/jpeg")
        self.assertEqual(r.headers["X-Content-Type-Options"], "nosniff")
        # un livre encore en brouillon garde sa couverture privée
        self.assertEqual(lecteur.get(f"/api/livres/{self.brouillon}/couverture").status_code, 404)
        self.assertEqual(self.auteur.get(f"/api/livres/{self.brouillon}/couverture").status_code, 200)
        livre = next(b for b in lecteur.get("/api/catalogue").get_json()["books"] if b["id"] == self.publie)
        self.assertTrue(livre["image"])

    def test_retrait(self):
        self.envoyer(self.publie, PNG)
        self.assertEqual(self.auteur.delete(f"/api/studio/livres/{self.publie}/couverture").status_code, 200)
        self.assertEqual(self.auteur.get(f"/api/livres/{self.publie}/couverture").status_code, 404)


class PagesEntieres(TestBase):
    def test_l_auteur_lit_ses_pages_en_entier_par_lots(self):
        auteur = Personne(self.app, "auteur")
        slug = auteur.livre(pages=6, publier=())
        r = auteur.get(f"/api/studio/livres/{slug}/textes?de=1&a=6")
        self.assertEqual(r.status_code, 200)
        pages = r.get_json()["pages"]
        self.assertEqual([p["n"] for p in pages], [1, 2, 3, 4, 5, 6])
        self.assertIn("Deuxième paragraphe.", pages[0]["contenu"])
        self.assertEqual(auteur.get(f"/api/studio/livres/{slug}/textes?de=1&a=40").status_code, 400)
        self.assertEqual(auteur.get(f"/api/studio/livres/{slug}/textes?de=x&a=2").status_code, 400)


class Epingles(TestBase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        os.environ["SOZO_MODE_TEST"] = "1"
        cls.auteur = Personne(cls.app, "auteur")
        cls.slug = cls.auteur.livre()          # pages 1-2 gratuites, 3-4 payantes publiées

    def test_seul_un_passage_lu_s_epingle(self):
        lec = Personne(self.app)
        r = lec.post("/api/epingles", {"livre": self.slug, "n": 1, "extrait": "Texte secret de la page 1."})
        self.assertEqual(r.status_code, 201, r.get_json())
        # un passage absent de la page
        self.assertEqual(lec.post("/api/epingles", {"livre": self.slug, "n": 1, "extrait": "Un texte inventé"}).status_code, 400)
        # une page payante non achetée : on n'épingle pas ce qu'on n'a pas lu
        self.assertEqual(lec.post("/api/epingles", {"livre": self.slug, "n": 3, "extrait": "Texte secret de la page 3."}).status_code, 403)
        # une page brouillon n'existe pas pour le lecteur
        self.assertEqual(lec.post("/api/epingles", {"livre": self.slug, "n": 5, "extrait": "Texte secret de la page 5."}).status_code, 404)
        liste = lec.get(f"/api/epingles?livre={self.slug}").get_json()["epingles"]
        self.assertEqual(len(liste), 1)
        # une autre personne ne voit pas cette épingle
        self.assertEqual(Personne(self.app).get("/api/epingles").get_json()["epingles"], [])

    def test_page_achetee_devient_epinglable(self):
        lec = Personne(self.app)
        pid = lec.post("/api/paiements", {"objet": "page", "livre": self.slug, "n": 3, "idempotency_key": "epingle-p3"}).get_json()["paiement"]["id"]
        confirmer_paiement(pid)
        r = lec.post("/api/epingles", {"livre": self.slug, "n": 3, "extrait": "Texte secret de la page 3."})
        self.assertEqual(r.status_code, 201, r.get_json())
        eid = r.get_json()["epingle"]["id"]
        self.assertEqual(lec.delete(f"/api/epingles/{eid}").status_code, 200)
        self.assertEqual(lec.delete(f"/api/epingles/{eid}").status_code, 404)


class RelectureIA(TestBase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.auteur = Personne(cls.app, "auteur")
        cls.slug = cls.auteur.livre(publier=())
        cls.url = f"/api/studio/livres/{cls.slug}/pages/1/relecture"

    def tearDown(self):
        os.environ.pop("ANTHROPIC_API_KEY", None)
        os.environ.pop("SOZO_IA_PLAFOND_JOUR", None)

    def test_sans_cle_rien_ne_part(self):
        os.environ.pop("ANTHROPIC_API_KEY", None)
        with mock.patch.object(ia_correcteur, "_appeler") as appel:
            r = self.auteur.post(self.url, {"texte": "Il a manger."})
        self.assertEqual(r.status_code, 503)
        self.assertEqual(r.get_json()["code"], "ia_inactive")
        appel.assert_not_called()

    def test_seules_les_propositions_verifiables_passent(self):
        os.environ["ANTHROPIC_API_KEY"] = "cle-de-test"
        texte = "Il a manger son pain en silance. Les enfants jouent."
        propose = [
            {"extrait": "a manger", "correction": "a mangé", "type": "conjugaison", "explication": "Participe passé après avoir."},
            {"extrait": "silance", "correction": "silence", "type": "orthographe", "explication": "Orthographe."},
            {"extrait": "Les petits enfants", "correction": "Les enfants", "type": "style", "explication": "Inventé : absent du texte."},
            {"extrait": "jouent", "correction": "jouent", "type": "grammaire", "explication": "Aucun changement : pas une faute."},
            {"extrait": "Il", "correction": "Elle", "type": "inconnu", "explication": "Type hors liste."},
        ]
        with mock.patch.object(ia_correcteur, "_appeler", return_value=propose):
            r = self.auteur.post(self.url, {"texte": texte})
        self.assertEqual(r.status_code, 200, r.get_json())
        c = r.get_json()["corrections"]
        self.assertEqual([x["extrait"] for x in c], ["a manger", "silance"])
        self.assertEqual(texte[c[1]["debut"]:c[1]["fin"]], "silance")

    def test_une_panne_ne_rend_jamais_une_page_sans_faute(self):
        os.environ["ANTHROPIC_API_KEY"] = "cle-de-test"
        with mock.patch.object(ia_correcteur, "_appeler", side_effect=ia_correcteur.Indisponible("panne")):
            r = self.auteur.post(self.url, {"texte": "Un texte."})
        self.assertEqual(r.status_code, 503)
        self.assertNotIn("corrections", r.get_json())

    def test_plafond_par_jour(self):
        os.environ["ANTHROPIC_API_KEY"] = "cle-de-test"
        os.environ["SOZO_IA_PLAFOND_JOUR"] = "2"
        auteur = Personne(self.app, "auteur")
        slug = auteur.livre(publier=())
        url = f"/api/studio/livres/{slug}/pages/1/relecture"
        with mock.patch.object(ia_correcteur, "_appeler", return_value=[]) as appel:
            codes = [auteur.post(url, {"texte": "Un texte."}).status_code for _ in range(3)]
        self.assertEqual(codes, [200, 200, 429])
        self.assertEqual(appel.call_count, 2)

    def test_page_d_un_autre_auteur(self):
        os.environ["ANTHROPIC_API_KEY"] = "cle-de-test"
        with mock.patch.object(ia_correcteur, "_appeler", return_value=[]) as appel:
            r = Personne(self.app, "auteur").post(self.url, {"texte": "Texte volé."})
        self.assertEqual(r.status_code, 404)
        appel.assert_not_called()
