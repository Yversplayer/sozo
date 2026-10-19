"""19/10/2026 — cadeaux de la plateforme (offrir un livre ou Plume).
Chaque test protège une règle : un cadeau ouvre la lecture À LA PERSONNE
seulement, ne crée jamais d'argent, exige le rôle finance et un code frais,
laisse une trace, et se retire."""
import os
import time

import admin
import db
import security
from tests.aide import Personne, TestBase
from tests.test_admin import MDP_ADMIN, creer_admin
from tests.test_argent import sql


class Cadeaux(TestBase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        os.environ["SOZO_MODE_TEST"] = "1"
        cls.secrets = {"finance@sozo.test": creer_admin("finance@sozo.test", "finance"),
                       "lecture@sozo.test": creer_admin("lecture@sozo.test", "lecture")}
        cls.auteur = Personne(cls.app, "auteur")
        cls.slug = cls.auteur.livre()            # pages 3-4 payantes publiées

    def connecter(self, email):
        cx = db.connecter()
        try:
            cx.execute("UPDATE admin_users SET totp_dernier_pas = 0")
            cx.valider()
        finally:
            cx.fermer()
        c = self.app.test_client()
        r = c.post("/api/admin/sessions", json={"email": email, "mot_de_passe": MDP_ADMIN,
                                                "code": admin._code(self.secrets[email], int(time.time() // 30))})
        self.assertEqual(r.status_code, 200, r.get_json())
        return c

    def h(self, c):
        return {security.EN_TETE_CSRF: c.get_cookie(admin.COOKIE_CSRF).value}

    def reauth(self, c, email):
        cx = db.connecter()
        try:
            cx.execute("UPDATE admin_users SET totp_dernier_pas = 0")
            cx.valider()
        finally:
            cx.fermer()
        r = c.post("/api/admin/reauth", json={"code": admin._code(self.secrets[email], int(time.time() // 30))}, headers=self.h(c))
        self.assertEqual(r.status_code, 200, r.get_json())

    def test_livre_offert_se_lit_et_ne_cree_pas_d_argent(self):
        lec, autre = Personne(self.app), Personne(self.app)
        self.assertEqual(lec.get(f"/api/livres/{self.slug}/pages/3").status_code, 402)
        c = self.connecter("finance@sozo.test")
        corps = {"email": lec.email, "objet": "livre", "livre": self.slug, "motif": "Relecture du livre"}
        # sans code frais : refusé
        self.assertEqual(c.post("/api/admin/dons", json=corps, headers=self.h(c)).status_code, 403)
        self.reauth(c, "finance@sozo.test")
        r = c.post("/api/admin/dons", json=corps, headers=self.h(c))
        self.assertEqual(r.status_code, 201, r.get_json())
        did = r.get_json()["id"]
        self.assertEqual(lec.get(f"/api/livres/{self.slug}/pages/3").status_code, 200)
        self.assertEqual(lec.get(f"/api/livres/{self.slug}/pages/4").status_code, 200)
        # à la personne seulement
        self.assertEqual(autre.get(f"/api/livres/{self.slug}/pages/3").status_code, 402)
        # aucun argent : ni paiement, ni registre, ni reçu
        self.assertEqual(sql("SELECT COUNT(*) AS n FROM payments WHERE user_id = ?", (lec.id,))[0]["n"], 0)
        self.assertEqual(sql("SELECT COUNT(*) AS n FROM ledger")[0]["n"], 0)
        self.assertTrue(sql("SELECT id FROM audit_log WHERE action = 'admin.don.livre'"))
        # acheter un livre déjà offert : refusé (on ne paie pas ce qu'on a)
        self.assertEqual(lec.post("/api/paiements", {"objet": "livre", "livre": self.slug, "idempotency_key": "deja-offert"}).status_code, 400)
        # retrait
        self.assertEqual(c.post(f"/api/admin/dons/{did}/retirer", json={"motif": "Fin de relecture"}, headers=self.h(c)).status_code, 200)
        self.assertEqual(lec.get(f"/api/livres/{self.slug}/pages/3").status_code, 402)
        self.assertEqual(c.post(f"/api/admin/dons/{did}/retirer", json={"motif": "Encore"}, headers=self.h(c)).status_code, 404)

    def test_plume_offerte(self):
        auteur = Personne(self.app, "auteur")
        self.assertFalse(auteur.get("/api/studio").get_json()["plume"]["actif"])
        c = self.connecter("finance@sozo.test")
        self.reauth(c, "finance@sozo.test")
        r = c.post("/api/admin/dons", json={"email": auteur.email, "objet": "plume", "jours": 30, "motif": "Essai du propriétaire"}, headers=self.h(c))
        self.assertEqual(r.status_code, 201, r.get_json())
        self.assertTrue(auteur.get("/api/studio").get_json()["plume"]["actif"])

    def test_role_finance_obligatoire(self):
        lec = Personne(self.app)
        c = self.connecter("lecture@sozo.test")
        self.reauth(c, "lecture@sozo.test")
        r = c.post("/api/admin/dons", json={"email": lec.email, "objet": "livre", "livre": self.slug, "motif": "Essai"}, headers=self.h(c))
        self.assertEqual(r.status_code, 403)
        self.assertEqual(lec.get(f"/api/livres/{self.slug}/pages/3").status_code, 402)

    def test_un_lecteur_ne_peut_pas_s_offrir_un_livre(self):
        lec = Personne(self.app)
        r = lec.post("/api/admin/dons", {"email": lec.email, "objet": "livre", "livre": self.slug, "motif": "Moi"})
        self.assertEqual(r.status_code, 401)
        self.assertEqual(lec.get(f"/api/livres/{self.slug}/pages/3").status_code, 402)
