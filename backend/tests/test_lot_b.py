"""21/10/2026 — lot B, l'écriture : recueil, thèmes, export Word, série
d'écriture. Chaque test protège une règle : on ne rassemble, n'exporte et ne
compte que ce qui est À SOI."""
import io
import zipfile

import texte
from tests.aide import Personne, TestBase
from tests.test_argent import sql


def ecrire(p, t="Un mot.", **k):
    r = p.post("/api/ecrits", {"nature": "poeme", "texte": t, **k})
    assert r.status_code == 201, r.get_json()
    return r.get_json()["ecrit"]["id"]


class Recueil(TestBase):
    def test_un_recueil_rassemble_ses_ecrits_en_brouillons(self):
        a = Personne(self.app, "auteur")
        e1, e2 = ecrire(a, "Premier poème", titre="Aube"), ecrire(a, "Second poème")
        r = a.post("/api/studio/recueils", {"titre": "Psaumes du matin", "categorie": "Poésie", "ecrits": [e2, e1]})
        self.assertEqual(r.status_code, 201, r.get_json())
        livre = r.get_json()["livre"]
        self.assertEqual([(p["n"], p["statut"]) for p in livre["pages"]], [(1, "draft"), (2, "draft")])
        page2 = a.get(f"/api/studio/livres/{livre['id']}/pages/2").get_json()["contenu"]
        self.assertEqual(page2, "# Aube\nPremier poème")            # l'ordre choisi, le titre en tête de page
        # rien n'est paru : un lecteur ne voit pas le recueil
        self.assertNotIn(livre["id"], [b["id"] for b in Personne(self.app).get("/api/catalogue").get_json()["books"]])

    def test_on_ne_rassemble_que_ses_propres_ecrits(self):
        a, b = Personne(self.app, "auteur"), Personne(self.app, "auteur")
        mien, autre = ecrire(a, "À moi"), ecrire(b, "Texte secret de b")
        avant = sql("SELECT COUNT(*) AS n FROM books")[0]["n"]
        self.assertEqual(a.post("/api/studio/recueils", {"titre": "Vol", "categorie": "Poésie", "ecrits": [mien, autre]}).status_code, 404)
        self.assertEqual(sql("SELECT COUNT(*) AS n FROM books")[0]["n"], avant)       # rien n'a été créé
        self.assertEqual(Personne(self.app).post("/api/studio/recueils", {"titre": "X", "categorie": "Poésie", "ecrits": [autre]}).status_code, 403)


class Themes(TestBase):
    def test_themes_sur_liste_fermee_et_filtre(self):
        a = Personne(self.app)
        paix = ecrire(a, "Shalom", themes=["Paix", "Espérance"], publier=True)
        ecrire(a, "Autre", themes=["Louange"], publier=True)
        self.assertEqual(a.post("/api/ecrits", {"nature": "poeme", "texte": "x", "themes": ["Politique"]}).status_code, 400)
        self.assertEqual(a.post("/api/ecrits", {"nature": "poeme", "texte": "x", "themes": ["Paix", "Foi", "Amour", "Deuil"]}).status_code, 400)
        self.assertEqual(a.get(f"/api/ecrits/{paix}").get_json()["ecrit"]["themes"], ["Espérance", "Paix"])
        self.assertEqual([e["id"] for e in a.get("/api/ecrits?theme=Paix").get_json()["ecrits"]], [paix])
        self.assertEqual(a.get("/api/ecrits?theme=%25").status_code, 400)          # « % » n'est pas un thème


class Export(TestBase):
    def lire_docx(self, r):
        self.assertEqual(r.status_code, 200)
        self.assertIn("attachment", r.headers["Content-Disposition"])
        return zipfile.ZipFile(io.BytesIO(r.data)).read("word/document.xml").decode()

    def test_l_auteur_exporte_son_livre_et_personne_d_autre(self):
        a = Personne(self.app, "auteur")
        slug = a.livre(pages=2, publier=(1,), payantes=())
        a.put(f"/api/studio/livres/{slug}/pages/2", {"contenu": "# Titre\nUn **mot** fort."})
        xml = self.lire_docx(a.get(f"/api/studio/livres/{slug}/export.docx"))
        self.assertIn("Texte secret de la page 1.", xml)
        self.assertIn('w:val="Heading1"', xml)
        self.assertIn("<w:b/>", xml)
        # un lecteur, même d'un livre publié, n'exporte pas le livre d'un autre
        self.assertEqual(Personne(self.app).get(f"/api/studio/livres/{slug}/export.docx").status_code, 404)

    def test_mes_ecrits_seulement(self):
        a, b = Personne(self.app), Personne(self.app)
        ecrire(a, "Le mien")
        ecrire(b, "Texte secret de b", publier=True)
        xml = self.lire_docx(a.get("/api/mes-ecrits/export.docx"))
        self.assertIn("Le mien", xml)
        self.assertNotIn("Texte secret de b", xml)

    def test_un_caractere_de_controle_ne_casse_pas_le_fichier(self):
        import export_docx
        import xml.dom.minidom
        d = export_docx.document("T", None, [(None, "a\x07b <script> & c")])
        xml.dom.minidom.parseString(zipfile.ZipFile(io.BytesIO(d)).read("word/document.xml"))


class Serie(TestBase):
    def test_serie_d_ecriture(self):
        a, b = Personne(self.app), Personne(self.app)
        ecrire(a, "Aujourd'hui")
        s = a.get("/api/moi/serie").get_json()
        self.assertEqual((s["serie"], s["aujourdhui"], len(s["semaine"]), s["semaine"][-1]["ecrit"]), (1, True, 7, True))
        self.assertEqual(b.get("/api/moi/serie").get_json()["serie"], 0)        # celle de a ne compte pas pour b

    def test_texte_nu_listes(self):
        self.assertEqual(texte.nu("• un\n1. deux\n12. trois"), "un\ndeux\ntrois")
