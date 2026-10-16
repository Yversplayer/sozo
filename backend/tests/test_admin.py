"""Étape 6 — l'administration, séparée et protégée par TOTP."""
import os
import re
import time

import admin
import db
import security
from tests.aide import RACINE_BACKEND, Personne, TestBase

MDP_ADMIN = "Administration-2026!"


def creer_admin(email="admin@sozo.test"):
    secret = admin.nouveau_secret_totp()
    cx = db.connecter()
    try:
        cx.execute("INSERT INTO admin_users (email, nom, password_hash, totp_secret, created_at) VALUES (?, ?, ?, ?, ?)",
                   (email, "Admin", security.hacher_mot_de_passe(MDP_ADMIN), secret, "2026-01-01T00:00:00Z"))
        cx.valider()
    finally:
        cx.fermer()
    return secret


class Totp(TestBase):
    def test_vecteur_rfc6238(self):
        # RFC 6238, annexe B : secret ASCII « 12345678901234567890 », T = 59 s → 94287082 (8 chiffres)
        secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"
        self.assertEqual(admin._code(secret, 59 // 30), "287082")
        self.assertEqual(admin.pas_valide(secret, "287082", maintenant=59), 1)
        self.assertIsNone(admin.pas_valide(secret, "000000", maintenant=59))


class Administration(TestBase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        os.environ["SOZO_MODE_TEST"] = "1"
        cls.secret = creer_admin()

    def connecter(self, code=None, ip="192.0.2.10"):
        c = self.app.test_client()
        code = code or admin._code(self.secret, int(time.time() // 30))
        r = c.post("/api/admin/sessions", json={"email": "admin@sozo.test", "mot_de_passe": MDP_ADMIN, "code": code},
                   environ_base={"REMOTE_ADDR": ip})
        return c, r

    def csrf(self, c):
        return {security.EN_TETE_CSRF: c.get_cookie(admin.COOKIE_CSRF).value}

    def test_aucune_route_ne_cree_d_administrateur(self):
        for f in os.listdir(RACINE_BACKEND):
            if f.endswith(".py"):
                with open(os.path.join(RACINE_BACKEND, f), encoding="utf-8") as h:
                    self.assertNotIn("INSERT INTO admin_users", h.read(), f)

    def test_code_totp_a_usage_unique(self):
        # On rejoue le MÊME code. Il est pris au pas courant, pas au pas
        # précédent : le hachage du mot de passe dure ~0,3 s, et un code du pas
        # « −1 » sortait parfois de la fenêtre ±1 quand la demi-minute tournait
        # entre-temps (r1 refusé : faux échec, constaté le 16/10/2026).
        pas = int(time.time() // 30)
        cx = db.connecter()
        try:
            cx.execute("UPDATE admin_users SET totp_dernier_pas = 0")
            cx.valider()
        finally:
            cx.fermer()
        code = admin._code(self.secret, pas)
        _, r1 = self.connecter(code, ip="192.0.2.21")
        _, r2 = self.connecter(code, ip="192.0.2.22")
        self.assertEqual((r1.status_code, r2.status_code), (200, 401))

    def test_mot_de_passe_sans_code_refuse(self):
        _, r = self.connecter("123456", ip="192.0.2.30")
        self.assertEqual(r.status_code, 401)

    def test_session_lecteur_n_ouvre_pas_l_administration(self):
        lec = Personne(self.app)
        self.assertEqual(lec.get("/api/admin/tableau").status_code, 401)
        self.assertEqual(lec.post("/api/admin/paiements/1/confirmer").status_code, 401)

    def test_csrf_admin_et_audit(self):
        cx = db.connecter()
        try:
            cx.execute("UPDATE admin_users SET totp_dernier_pas = 0")
            cx.valider()
        finally:
            cx.fermer()
        c, r = self.connecter(ip="192.0.2.40")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(c.get("/api/admin/tableau").status_code, 200)
        # paiement déclaré par un lecteur, confirmé par l'admin
        slug = Personne(self.app, "auteur").livre()
        lec = Personne(self.app)
        pid = lec.post("/api/paiements", {"objet": "page", "livre": slug, "n": 3, "idempotency_key": "admin-test-01"}).get_json()["paiement"]["id"]
        lec.post(f"/api/paiements/{pid}/declaration", {"operateur": "M-Pesa", "reference": "MP-ADMIN-01"})
        self.assertEqual(c.post(f"/api/admin/paiements/{pid}/confirmer", json={}).status_code, 403)       # sans jeton CSRF
        r = c.post(f"/api/admin/paiements/{pid}/confirmer", json={}, headers=self.csrf(c))
        self.assertEqual(r.status_code, 200)
        self.assertTrue(re.match(r"SZ-\d{4}-\d{6}$", r.get_json()["recu"]))
        self.assertEqual(c.post(f"/api/admin/paiements/{pid}/confirmer", json={}, headers=self.csrf(c)).status_code, 409)   # pas deux fois
        self.assertEqual(lec.get(f"/api/livres/{slug}/pages/3").status_code, 200)
        cx = db.connecter()
        try:
            self.assertTrue(cx.un("SELECT id FROM audit_log WHERE action = 'admin.paiement.confirmation' AND ressource = ?", (f"payment:{pid}",)))
        finally:
            cx.fermer()

    def test_desactivation_coupe_les_sessions(self):
        cx = db.connecter()
        try:
            cx.execute("UPDATE admin_users SET totp_dernier_pas = 0")
            cx.valider()
        finally:
            cx.fermer()
        c, _ = self.connecter(ip="192.0.2.50")
        lec = Personne(self.app)
        self.assertEqual(lec.get("/api/moi").status_code, 200)
        r = c.post(f"/api/admin/utilisateurs/{lec.id}/desactiver", json={"motif": "test"}, headers=self.csrf(c))
        self.assertEqual(r.status_code, 200)
        self.assertEqual(lec.get("/api/moi").status_code, 401)
