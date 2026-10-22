"""22/10/2026 — les images reviennent. Un écrit peut porter une photo de la
bibliothèque de Sōzō, choisie sur une liste FERMÉE lue sur le disque : jamais
un chemin, jamais une adresse, jamais une image d'ailleurs."""
from tests.aide import Personne, TestBase


class PhotosDesEcrits(TestBase):
    def test_une_photo_de_la_bibliotheque_seulement(self):
        a = Personne(self.app)
        ok = a.post("/api/ecrits", {"nature": "poeme", "texte": "Un poème", "apparence": {"image": "foi-soleil-mer", "fond": "nuit"}})
        self.assertEqual(ok.status_code, 201, ok.get_json())
        self.assertEqual(ok.get_json()["ecrit"]["apparence"]["image"], "foi-soleil-mer")
        for mauvaise in ("../backend/sozo", "https://exemple.cd/x.jpg", "foi-soleil-mer-480", "inconnue", ""):
            r = a.post("/api/ecrits", {"nature": "poeme", "texte": "Un poème", "apparence": {"image": mauvaise}})
            self.assertEqual(r.status_code, 400, mauvaise)
