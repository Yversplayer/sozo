"""Étape 4 — le studio : versions, lots vérifiés avant écriture, import ≠ publication."""
import io
import os
import zipfile

import db
from tests.aide import Personne, TestBase, confirmer_paiement


def docx(paragraphes, saut_apres=None):
    W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'
    corps = ""
    for i, p in enumerate(paragraphes):
        corps += f"<w:p><w:r><w:t>{p}</w:t></w:r></w:p>"
        if saut_apres is not None and i == saut_apres:
            corps += '<w:p><w:r><w:br w:type="page"/></w:r></w:p>'
    b = io.BytesIO()
    with zipfile.ZipFile(b, "w") as z:
        z.writestr("[Content_Types].xml", "<Types/>")
        z.writestr("word/document.xml", f'<w:document {W}><w:body>{corps}</w:body></w:document>')
    return b.getvalue()


def epub(chapitres):
    b = io.BytesIO()
    with zipfile.ZipFile(b, "w") as z:
        z.writestr("mimetype", "application/epub+zip")
        z.writestr("META-INF/container.xml", '<container><rootfiles><rootfile full-path="OEBPS/livre.opf"/></rootfiles></container>')
        items = "".join(f'<item id="c{i}" href="c{i}.xhtml"/>' for i in range(len(chapitres)))
        spine = "".join(f'<itemref idref="c{i}"/>' for i in range(len(chapitres)))
        z.writestr("OEBPS/livre.opf", f"<package><manifest>{items}</manifest><spine>{spine}</spine></package>")
        for i, t in enumerate(chapitres):
            z.writestr(f"OEBPS/c{i}.xhtml", f"<html><head><style>p{{}}</style></head><body><h1>Chapitre {i + 1}</h1><p>{t}</p><script>alert(1)</script></body></html>")
    return b.getvalue()


def pdf(lignes):
    """Un PDF minimal, écrit à la main, avec du vrai texte."""
    flux = "BT /F1 12 Tf 72 720 Td " + " ".join(f"({l}) Tj 0 -16 Td" for l in lignes) + " ET"
    objs = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
            "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
            f"<< /Length {len(flux)} >>\nstream\n{flux}\nendstream", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"]
    out, pos = "%PDF-1.4\n", []
    for i, o in enumerate(objs, 1):
        pos.append(len(out)); out += f"{i} 0 obj\n{o}\nendobj\n"
    x = len(out)
    out += f"xref\n0 {len(objs) + 1}\n0000000000 65535 f \n" + "".join(f"{p:010d} 00000 n \n" for p in pos)
    out += f"trailer\n<< /Size {len(objs) + 1} /Root 1 0 R >>\nstartxref\n{x}\n%%EOF"
    return out.encode("latin-1")


class Studio(TestBase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        os.environ["SOZO_MODE_TEST"] = "1"

    def importer(self, a, slug, octets, nom):
        return a.c.post(f"/api/studio/livres/{slug}/import", data={"fichier": (io.BytesIO(octets), nom)},
                        headers=a._h(), content_type="multipart/form-data")

    def test_lecteur_sans_studio(self):
        r = Personne(self.app).post("/api/studio/livres", {"titre": "X", "categorie": "Roman", "mode": "integral", "acces": "free"})
        self.assertEqual(r.status_code, 403)

    def test_import_docx_cree_des_brouillons_invisibles(self):
        a = Personne(self.app, "auteur")
        slug = a.livre(pages=0, publier=(), payantes=())
        r = self.importer(a, slug, docx(["Premier paragraphe secret.", "Deuxième.", "Après le saut."], saut_apres=1), "roman.docx")
        self.assertEqual(r.status_code, 201, r.get_json())
        self.assertEqual(r.get_json()["pages"], 2)                       # le saut de page est respecté
        d = a.get(f"/api/studio/livres/{slug}").get_json()["livre"]
        self.assertEqual({p["statut"] for p in d["pages"]}, {"draft"})   # importer ≠ publier
        lec = Personne(self.app)
        self.assertEqual(lec.get(f"/api/livres/{slug}/pages/1").status_code, 404)
        self.assertNotIn(slug, [b["id"] for b in lec.get("/api/catalogue").get_json()["books"]])

    def test_import_epub_sans_script(self):
        a = Personne(self.app, "auteur")
        slug = a.livre(pages=0, publier=(), payantes=())
        r = self.importer(a, slug, epub(["Il était une fois.", "La suite."]), "livre.epub")
        self.assertEqual(r.get_json()["pages"], 2)
        t = a.get(f"/api/studio/livres/{slug}/pages/1").get_json()["contenu"]
        self.assertIn("Il était une fois", t)
        self.assertNotIn("alert", t)

    def test_import_pdf(self):
        a = Personne(self.app, "auteur")
        slug = a.livre(pages=0, publier=(), payantes=())
        r = self.importer(a, slug, pdf(["Une page de PDF", "en deux lignes"]), "m.pdf")
        self.assertEqual(r.status_code, 201, r.get_json())
        self.assertIn("Une page de PDF", a.get(f"/api/studio/livres/{slug}/pages/1").get_json()["contenu"])

    def test_faux_pdf_et_bombe_zip_refuses(self):
        a = Personne(self.app, "auteur")
        slug = a.livre(pages=0, publier=(), payantes=())
        self.assertEqual(self.importer(a, slug, b"\x89PNG\r\n\x1a\n" + b"0" * 100, "image.pdf").status_code, 422)
        b = io.BytesIO()
        with zipfile.ZipFile(b, "w", zipfile.ZIP_DEFLATED) as z:
            z.writestr("word/document.xml", "<a>" + "0" * (90 * 1024 * 1024) + "</a>")
        self.assertLess(len(b.getvalue()), 1_000_000)                   # 90 Mo qui tiennent dans moins de 1 Mo
        r = self.importer(a, slug, b.getvalue(), "bombe.docx")
        self.assertEqual(r.status_code, 422)
        self.assertIn("décompressé", r.get_json()["erreur"])       # arrêtée par la limite, pas par hasard

    def test_le_manuscrit_n_est_jamais_servi(self):
        a = Personne(self.app, "auteur")
        slug = a.livre(pages=0, publier=(), payantes=())
        self.importer(a, slug, docx(["Texte."]), "r.docx")
        for url in ("/backend/stockage/manuscrits/", "/api/studio/livres/%s/manuscrit" % slug):
            self.assertIn(self.app.test_client().get(url).status_code, (404, 401))

    def test_versions_et_page_publiee_verrouillee_sans_plume(self):
        a = Personne(self.app, "auteur")
        slug = a.livre()
        self.assertEqual(a.put(f"/api/studio/livres/{slug}/pages/5", {"contenu": "Brouillon v2"}).get_json()["version"], 2)
        r = a.put(f"/api/studio/livres/{slug}/pages/1", {"contenu": "Correction"})
        self.assertEqual((r.status_code, r.get_json()["code"]), (403, "plume_requis"))
        pid = a.post("/api/paiements", {"objet": "plume", "idempotency_key": "plume-studio-1"}).get_json()["paiement"]["id"]
        confirmer_paiement(pid)
        self.assertEqual(a.put(f"/api/studio/livres/{slug}/pages/1", {"contenu": "Correction"}).status_code, 200)
        cx = db.connecter()
        try:
            v = cx.tous("""SELECT version, is_current, remplacee_le FROM page_versions pv JOIN pages p ON p.id = pv.page_id
                           JOIN books b ON b.id = p.book_id WHERE b.slug = ? AND p.n = 1 ORDER BY version""", (slug,))
        finally:
            cx.fermer()
        self.assertEqual([(x["version"], x["is_current"]) for x in v], [(1, 0), (2, 1)])   # l'ancienne reste
        self.assertIsNotNone(v[0]["remplacee_le"])

    def test_lot_tout_ou_rien(self):
        a = Personne(self.app, "auteur")
        slug = a.livre()                                         # 1-4 publiées, 5-6 brouillons
        r = a.post(f"/api/studio/livres/{slug}/pages/lot", {"pages": [5, 1, 6], "action": "gratuit"})
        self.assertEqual(r.status_code, 409)
        d = {p["n"]: p for p in a.get(f"/api/studio/livres/{slug}").get_json()["livre"]["pages"]}
        self.assertEqual((d[5]["acces"], d[6]["acces"]), ("paid", "paid"))   # rien n'a bougé

    def test_programmation_passee_et_page_vide_refusees(self):
        a = Personne(self.app, "auteur")
        slug = a.livre()
        self.assertEqual(a.post(f"/api/studio/livres/{slug}/pages/lot", {"pages": [5], "action": "programmer", "date": "2001-01-01T10:00Z"}).status_code, 400)
        n = a.post(f"/api/studio/livres/{slug}/pages", {}).get_json()["n"]
        self.assertEqual(a.post(f"/api/studio/livres/{slug}/pages/lot", {"pages": [n], "action": "publier"}).status_code, 409)

    def test_atelier_personnalise(self):
        a = Personne(self.app, "auteur")
        r = a.put("/api/studio/atelier", {"ambiance": "nuit", "nom": "L'atelier de Nard", "citation": "Une page à la fois.", "photo": "foi-bougie"})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(a.get("/api/studio").get_json()["atelier"]["nom"], "L'atelier de Nard")
        self.assertEqual(a.put("/api/studio/atelier", {"ambiance": "nuit", "photo": "../../backend/sozo"}).status_code, 400)
