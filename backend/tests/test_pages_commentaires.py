"""22/10/2026 — commenter une page de livre (à la manière d'un webtoon). Les
règles qui comptent : seulement sur une page que l'on peut LIRE (une page
payante non achetée ne laisse rien voir), charte exigée, l'auteur du livre est
prévenu, un commentaire se retire par son auteur ou par celui du livre."""
import os

from tests.aide import Personne, TestBase, confirmer_paiement
from tests.test_argent import sql


class CommentairesDePages(TestBase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        os.environ["SOZO_MODE_TEST"] = "1"

    def test_seulement_sur_une_page_lisible(self):
        auteur = Personne(self.app, "auteur")
        slug = auteur.livre()                         # 1-2 gratuites, 3-4 payantes, 5-6 brouillons
        lec = Personne(self.app)
        url = lambda n: f"/api/livres/{slug}/pages/{n}/commentaires"
        self.assertEqual(lec.post(url(1), {"texte": "Très beau"}).status_code, 201)
        self.assertEqual(lec.post(url(3), {"texte": "Je n’ai pas lu"}).status_code, 403)          # payante, non achetée
        self.assertEqual(lec.get(url(3)).status_code, 403)                                        # rien ne se voit
        self.assertEqual(lec.post(url(5), {"texte": "Brouillon"}).status_code, 404)
        pid = lec.post("/api/paiements", {"objet": "page", "livre": slug, "n": 3, "idempotency_key": "coms-page-3"}).get_json()["paiement"]["id"]
        confirmer_paiement(pid)
        self.assertEqual(lec.post(url(3), {"texte": "Maintenant lue"}).status_code, 201)
        self.assertEqual([c["texte"] for c in auteur.get(url(1)).get_json()["commentaires"]], ["Très beau"])
        self.assertEqual(len(sql("SELECT id FROM notifications WHERE user_id = ? AND cle LIKE 'page-commentaire:%'", (auteur.id,))), 2)

    def test_charte_et_retrait(self):
        auteur = Personne(self.app, "auteur")
        slug = auteur.livre()
        sans = Personne(self.app, charte=False)
        r = sans.post(f"/api/livres/{slug}/pages/1/commentaires", {"texte": "Salut"})
        self.assertEqual((r.status_code, r.get_json()["code"]), (403, "charte"))
        a, b = Personne(self.app), Personne(self.app)
        cid = a.post(f"/api/livres/{slug}/pages/1/commentaires", {"texte": "Mien"}).get_json()["commentaire"]["id"]
        self.assertEqual(b.delete(f"/api/pages-commentaires/{cid}").status_code, 404)              # pas le sien
        self.assertEqual(auteur.delete(f"/api/pages-commentaires/{cid}").status_code, 200)         # l'auteur du livre peut
        self.assertEqual(a.get(f"/api/livres/{slug}/pages/1/commentaires").get_json()["commentaires"], [])
        self.assertEqual(sql("SELECT retire_par FROM pages_commentaires WHERE id = ?", (cid,))[0]["retire_par"], "auteur")
