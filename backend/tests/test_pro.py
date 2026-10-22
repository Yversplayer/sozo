"""22/10/2026 — « passer Pro ». Les règles qui comptent, tenues par le serveur :
un livre gratuit offert sans Plume ; vendre demande Plume ; chaque offre a son
plafond de livres et sa commission ; la Plume d'avant vaut « Plume d'or » ;
les essais offerts (IA, import) ne se renouvellent pas."""
import os

import db
import pro
from tests.aide import Personne, TestBase, _offrir_pro, confirmer_paiement
from tests.test_argent import sql


def executer(q, p=()):
    cx = db.connecter(globale=True)
    try:
        cx.execute(q, p)
        cx.valider()
    finally:
        cx.fermer()


def etat(uid):
    cx = db.connecter(globale=True)
    try:
        return pro.etat(cx, uid)
    finally:
        cx.fermer()


class Offres(TestBase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        os.environ["SOZO_MODE_TEST"] = "1"

    def test_plafond_de_livres_par_offre(self):
        a = Personne(self.app, "auteur")                      # offre « Plume » : 3 livres
        for i in range(3):
            a.livre(titre=f"Livre {i}", pages=1, publier=(), payantes=())
        r = a.post("/api/studio/livres", {"titre": "Quatrième", "categorie": "Foi", "mode": "integral", "acces": "free"})
        self.assertEqual((r.status_code, r.get_json()["code"]), (403, "pro_requis"))
        _offrir_pro(a.id, "plume_or")                         # la plus haute offre l'emporte
        self.assertEqual(a.post("/api/studio/livres", {"titre": "Quatrième", "categorie": "Foi", "mode": "integral", "acces": "free"}).status_code, 201)

    def test_vendre_demande_plume(self):
        a = Personne(self.app, "auteur", pro=False)
        slug = a.livre(acces="free", pages=2, publier=(1,), payantes=())
        r = a.patch(f"/api/studio/livres/{slug}", {"acces": "mixed", "prix_page": 25})
        self.assertEqual((r.status_code, r.get_json()["code"]), (403, "pro_requis"))
        _offrir_pro(a.id)
        self.assertEqual(a.patch(f"/api/studio/livres/{slug}", {"acces": "mixed", "prix_page": 25}).status_code, 200)

    def test_rendre_des_pages_payantes_demande_plume(self):
        a = Personne(self.app, "auteur")
        slug = a.livre(pages=2, publier=(), payantes=())       # créé avec Plume, livre mixte
        executer("UPDATE dons SET revoque_le = '2021-01-01T00:00:00Z' WHERE user_id = ?", (a.id,))   # Plume retirée
        r = a.post(f"/api/studio/livres/{slug}/pages/lot", {"pages": [2], "action": "payant"})
        self.assertEqual((r.status_code, r.get_json()["code"]), (403, "pro_requis"))

    def test_commission_selon_l_offre_et_ancienne_plume(self):
        a = Personne(self.app, "auteur", pro=False)
        self.assertEqual(etat(a.id)["commission"], 15)                         # sans Plume
        pid = a.post("/api/paiements", {"objet": "plume", "idempotency_key": "ancienne-plume"}).get_json()["paiement"]["id"]
        confirmer_paiement(pid)                                                  # sans offre : la Plume d'avant
        e = etat(a.id)
        self.assertEqual((e["offre"], e["commission"], e["livres_max"]), ("plume_or", 10, 10))
        _offrir_pro(a.id, "scriptorium")
        self.assertEqual((etat(a.id)["commission"], etat(a.id)["livres_max"]), (8, None))

    def test_renouveler_la_meme_offre_la_prolonge(self):
        a = Personne(self.app)
        for k in ("p1", "p2"):
            pid = a.post("/api/paiements", {"objet": "plume", "offre": "plume", "duree": "mois", "idempotency_key": f"renouv-{k}"}).get_json()["paiement"]["id"]
            confirmer_paiement(pid)
        s = sql("SELECT debut, fin FROM subscriptions WHERE user_id = ? ORDER BY id", (a.id,))
        self.assertEqual(s[1]["debut"], s[0]["fin"])                              # la seconde commence à la fin de la première

    def test_essais_offerts_sans_plume(self):
        lec = Personne(self.app)
        self.assertEqual(etat(lec.id)["essais"], {"ia": 2, "import": 1})
        executer("INSERT INTO ia_usages (user_id, jour, n) VALUES (?, '2026-10-01', 2)", (lec.id,))
        slug = lec.livre(acces="free", pages=1, publier=(), payantes=())
        bid = sql("SELECT id FROM books WHERE slug = ?", (slug,))[0]["id"]
        executer("INSERT INTO imports (user_id, book_id, nom_fichier, nature, taille, empreinte, pages_creees, created_at) VALUES (?, ?, 'a.docx', 'docx', 10, 'x', 1, '2026-10-01T00:00:00Z')",
                 (lec.id, bid))
        self.assertEqual(etat(lec.id)["essais"], {"ia": 0, "import": 0})
        import io
        r = lec.c.post(f"/api/studio/livres/{slug}/import", data={"fichier": (io.BytesIO(b"x"), "b.txt")}, headers=lec._h(), content_type="multipart/form-data")
        self.assertEqual((r.status_code, r.get_json()["code"]), (403, "pro_requis"))

    def test_la_vue_ne_montre_que_les_offres_du_serveur(self):
        v = Personne(self.app).get("/api/moi/pro").get_json()["pro"]
        self.assertEqual([o["id"] for o in v["offres"]], ["plume", "plume_or", "scriptorium"])
        self.assertEqual([(o["mois"], o["annee"]) for o in v["offres"]], [(2.0, 20.0), (5.0, 50.0), (15.0, 150.0)])
        self.assertFalse(v["pro"])
