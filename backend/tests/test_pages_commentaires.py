"""22/10/2026 — commenter une page de livre (à la manière d'un webtoon). Les
règles qui comptent : seulement sur une page que l'on peut LIRE (une page
payante non achetée ne laisse rien voir), charte exigée, l'auteur du livre est
prévenu, un commentaire se retire par son auteur ou par celui du livre."""
import os

import db
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


class MesCommentaires(TestBase):
    """03/11/2026 — l'onglet « Commentaires » du profil : les mots de la
    personne, à elle seule ; jamais ceux d'un autre, jamais ceux retirés."""
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        os.environ["SOZO_MODE_TEST"] = "1"

    def test_les_siens_seulement(self):
        auteur = Personne(self.app, "auteur")
        slug = auteur.livre()
        moi, autre = Personne(self.app), Personne(self.app)
        eid = auteur.post("/api/ecrits", {"nature": "pensee", "texte": "Une pensée", "publier": True}).get_json()["ecrit"]["id"]
        self.assertEqual(moi.post(f"/api/ecrits/{eid}/commentaires", {"texte": "Amen"}).status_code, 201)
        self.assertEqual(moi.post(f"/api/livres/{slug}/pages/1/commentaires", {"texte": "Belle fin de chapitre"}).status_code, 201)
        self.assertEqual(autre.post(f"/api/livres/{slug}/pages/1/commentaires", {"texte": "Pas à moi"}).status_code, 201)
        retire = moi.post(f"/api/livres/{slug}/pages/2/commentaires", {"texte": "Retiré"}).get_json()["commentaire"]["id"]
        self.assertEqual(moi.delete(f"/api/pages-commentaires/{retire}").status_code, 200)
        l = moi.get("/api/moi/commentaires").get_json()["commentaires"]
        self.assertEqual(sorted(c["texte"] for c in l), ["Amen", "Belle fin de chapitre"])
        page = next(c for c in l if c.get("page"))
        self.assertEqual((page["page"], page["lien"]), (1, f"lire.html?id={slug}&p=1"))
        self.assertEqual([c["texte"] for c in autre.get("/api/moi/commentaires").get_json()["commentaires"]], ["Pas à moi"])
        self.assertEqual(self.app.test_client().get("/api/moi/commentaires").status_code, 401)

    def test_ecrit_retire_ne_s_affiche_plus(self):
        auteur, moi = Personne(self.app, "auteur"), Personne(self.app)
        eid = auteur.post("/api/ecrits", {"nature": "pensee", "texte": "Bientôt retiré", "publier": True}).get_json()["ecrit"]["id"]
        moi.post(f"/api/ecrits/{eid}/commentaires", {"texte": "Merci"})
        cx = db.connecter(globale=True)
        try:
            cx.execute("UPDATE ecrits SET retire_le = '2026-11-01T00:00:00Z' WHERE id = ?", (eid,))
            cx.valider()
        finally:
            cx.fermer()
        self.assertEqual(moi.get("/api/moi/commentaires").get_json()["commentaires"], [])


class ProfilLecteur(TestBase):
    """03/11/2026 — le profil dit « Lu il y a 15 jours » (la date vient du
    serveur) ; un écrit d'auteur inventé se dit « Exemple », un vrai jamais."""
    def test_date_de_derniere_lecture(self):
        auteur = Personne(self.app, "auteur")
        slug = auteur.livre()
        lec = Personne(self.app)
        self.assertEqual(lec.put("/api/moi/progression", {"livre": slug, "n": 2}).status_code, 200)
        r = lec.get("/api/catalogue").get_json()["reader"]
        self.assertEqual(r["progress"][slug], 2)
        self.assertRegex(r["lu_le"][slug], r"^20\d\d-\d\d-\d\dT")

    def test_ecrit_d_exemple_marque(self):
        vrai, invente, lec = Personne(self.app), Personne(self.app), Personne(self.app)
        cx = db.connecter(globale=True)
        try:
            cx.execute("UPDATE users SET demo = 1 WHERE id = ?", (invente.id,))
            cx.valider()
        finally:
            cx.fermer()
        a = vrai.post("/api/ecrits", {"nature": "pensee", "texte": "Vraie pensée", "publier": True}).get_json()["ecrit"]["id"]
        b = invente.post("/api/ecrits", {"nature": "pensee", "texte": "Pensée d'exemple", "publier": True}).get_json()["ecrit"]["id"]
        fil = {e["id"]: e for e in lec.get("/api/ecrits").get_json()["ecrits"]}
        self.assertFalse(fil[a]["exemple"])
        self.assertTrue(fil[b]["exemple"])
