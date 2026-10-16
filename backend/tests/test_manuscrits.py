"""Conservation des manuscrits d'origine (décision du 16/10/2026) : 90 jours
après l'import, puis effacement ; tout de suite si le compte est supprimé ;
un fichier partagé par deux imports n'est effacé qu'avec le dernier."""
import io
import os

import db
import manuscrits
from tests.aide import Personne, TestBase
from tests.test_argent import sql
from tests.test_studio import docx


def vieillir(livre_slug, jours):
    cx = db.connecter(globale=True)
    try:
        cx.execute("UPDATE imports SET created_at = '2001-01-01T00:00:00Z' WHERE book_id = (SELECT id FROM books WHERE slug = ?)", (livre_slug,))
        cx.valider()
    finally:
        cx.fermer()


class Conservation(TestBase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        os.environ["SOZO_MODE_TEST"] = "1"

    def importer(self, a, octets):
        slug = a.livre(pages=0, publier=(), payantes=())
        r = a.c.post(f"/api/studio/livres/{slug}/import", data={"fichier": (io.BytesIO(octets), "m.docx")},
                     headers=a._h(), content_type="multipart/form-data")
        self.assertEqual(r.status_code, 201, r.get_json())
        e = sql("SELECT empreinte, nature FROM imports WHERE book_id = (SELECT id FROM books WHERE slug = ?)", (slug,))[0]
        return slug, os.path.join(manuscrits.DOSSIER, f"{e['empreinte']}.{e['nature']}")

    def test_efface_apres_echeance_texte_conserve(self):
        a = Personne(self.app, "auteur")
        slug, chemin = self.importer(a, docx(["Un texte inédit, à garder secret, numéro 1."]))
        self.assertTrue(os.path.isfile(chemin))
        manuscrits.purger()
        self.assertTrue(os.path.isfile(chemin))                              # pas avant 90 jours
        vieillir(slug, 91)
        manuscrits.purger()
        self.assertFalse(os.path.isfile(chemin))
        self.assertTrue(sql("SELECT efface_le FROM imports WHERE book_id = (SELECT id FROM books WHERE slug = ?)", (slug,))[0]["efface_le"])
        self.assertIn("inédit", a.get(f"/api/studio/livres/{slug}/pages/1").get_json()["contenu"])   # le texte, lui, reste

    def test_fichier_partage_garde_tant_qu_un_import_le_conserve(self):
        octets = docx(["Même fichier importé deux fois, numéro 2."])
        slug1, chemin = self.importer(Personne(self.app, "auteur"), octets)
        self.importer(Personne(self.app, "auteur"), octets)
        vieillir(slug1, 91)
        manuscrits.purger()
        self.assertTrue(os.path.isfile(chemin))                              # l'autre import est récent

    def test_suppression_du_compte_efface_tout_de_suite(self):
        a = Personne(self.app, "auteur")
        _, chemin = self.importer(a, docx(["Manuscrit d'un compte supprimé, numéro 3."]))
        self.assertEqual(a.c.delete("/api/compte", json={"mot_de_passe": "Lumiere-2026!"}, headers=a._h()).status_code, 200)
        self.assertFalse(os.path.isfile(chemin))
