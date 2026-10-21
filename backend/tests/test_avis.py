"""21/10/2026 — avis sur les livres. Les règles qui comptent : on ne note
qu'un livre dont on peut lire une page, jamais le sien, une seule fois ; la
charte est exigée ; la moyenne ne compte que les avis visibles ; la
modération retire sans détruire. Sous PostgreSQL, la moyenne vue par un
visiteur compte bien les avis des AUTRES (RLS en lecture)."""
import os
import time

import admin
import db
import security
from tests.aide import Personne, TestBase
from tests.test_admin import MDP_ADMIN, creer_admin
from tests.test_argent import sql


class Avis(TestBase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        os.environ["SOZO_MODE_TEST"] = "1"
        cls.secret = creer_admin("avis@sozo.test", "moderation")

    def admin(self):
        cx = db.connecter()
        try:
            cx.execute("UPDATE admin_users SET totp_dernier_pas = 0")
            cx.valider()
        finally:
            cx.fermer()
        c = self.app.test_client()
        r = c.post("/api/admin/sessions", json={"email": "avis@sozo.test", "mot_de_passe": MDP_ADMIN,
                                                "code": admin._code(self.secret, int(time.time() // 30))})
        self.assertEqual(r.status_code, 200, r.get_json())
        return c, {security.EN_TETE_CSRF: c.get_cookie(admin.COOKIE_CSRF).value}

    def test_noter_un_livre(self):
        auteur = Personne(self.app, "auteur")
        slug = auteur.livre()                                   # pages 1-2 gratuites
        a, b, c = Personne(self.app), Personne(self.app), Personne(self.app)
        self.assertEqual(auteur.put(f"/api/livres/{slug}/avis", {"note": 5}).status_code, 403)       # pas le sien
        self.assertEqual(a.put(f"/api/livres/{slug}/avis", {"note": 6}).status_code, 400)
        self.assertEqual(a.put(f"/api/livres/{slug}/avis", {"note": 4, "texte": "Beau"}).status_code, 200)
        self.assertEqual(a.put(f"/api/livres/{slug}/avis", {"note": 2}).status_code, 200)              # remplacé, pas doublé
        b.put(f"/api/livres/{slug}/avis", {"note": 5})
        r = c.get(f"/api/livres/{slug}/avis").get_json()                                              # un tiers voit les avis des autres
        self.assertEqual((r["resume"]["nombre"], r["resume"]["moyenne"]), (2, 3.5))
        self.assertTrue(r["peut"])
        self.assertEqual(len(sql("SELECT id FROM notifications WHERE user_id = ? AND cle LIKE 'avis:%'", (auteur.id,))), 2)
        self.assertEqual(a.delete(f"/api/livres/{slug}/avis").status_code, 200)
        self.assertEqual(c.get(f"/api/livres/{slug}/avis").get_json()["resume"]["nombre"], 1)

    def test_pas_d_avis_sans_page_lisible_ni_charte(self):
        auteur = Personne(self.app, "auteur")
        slug = auteur.livre(acces="paid", payantes=(1, 2, 3, 4, 5, 6))
        a = Personne(self.app)
        self.assertFalse(a.get(f"/api/livres/{slug}/avis").get_json()["peut"])
        self.assertEqual(a.put(f"/api/livres/{slug}/avis", {"note": 1}).status_code, 403)              # rien lu
        libre = auteur.livre(titre="Libre")
        sans = Personne(self.app, charte=False)
        r = sans.put(f"/api/livres/{libre}/avis", {"note": 3})
        self.assertEqual((r.status_code, r.get_json()["code"]), (403, "charte"))
        brouillon = auteur.livre(titre="Brouillon", publier=())
        self.assertEqual(a.put(f"/api/livres/{brouillon}/avis", {"note": 3}).status_code, 404)

    def test_la_moderation_retire_sans_detruire(self):
        auteur = Personne(self.app, "auteur")
        slug = auteur.livre()
        a, c = Personne(self.app), Personne(self.app)
        aid = a.put(f"/api/livres/{slug}/avis", {"note": 1, "texte": "Insulte"}).get_json()["id"]
        adm, h = self.admin()
        self.assertEqual(a.post(f"/api/admin/avis/{aid}/retirer", {"motif": "Essai"}).status_code, 401)
        self.assertEqual(adm.post(f"/api/admin/avis/{aid}/retirer", json={"motif": "Hors charte"}, headers=h).status_code, 200)
        self.assertEqual(c.get(f"/api/livres/{slug}/avis").get_json()["resume"]["nombre"], 0)
        self.assertEqual(a.put(f"/api/livres/{slug}/avis", {"note": 5}).status_code, 409)              # pas de contournement
        self.assertEqual(a.delete(f"/api/livres/{slug}/avis").status_code, 404)                        # la preuve reste
        self.assertEqual(sql("SELECT texte FROM avis WHERE id = ?", (aid,))[0]["texte"], "Insulte")
        self.assertEqual(adm.post(f"/api/admin/avis/{aid}/retablir", json={}, headers=h).status_code, 200)
        self.assertEqual(c.get(f"/api/livres/{slug}/avis").get_json()["resume"]["nombre"], 1)
