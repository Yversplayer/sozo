"""Étape 6 — l'administration, séparée et protégée par TOTP."""
import os
import re
import time

import admin
import db
import security
from tests.aide import RACINE_BACKEND, Personne, TestBase
from tests.test_argent import sql

MDP_ADMIN = "Administration-2026!"


def creer_admin(email="admin@sozo.test", roles="finance,moderation"):
    secret = admin.nouveau_secret_totp()
    cx = db.connecter()
    try:
        cx.execute("INSERT INTO admin_users (email, nom, password_hash, totp_secret, roles, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                   (email, "Admin", security.hacher_mot_de_passe(MDP_ADMIN), secret, roles, "2026-01-01T00:00:00Z"))
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

    def reauth(self, c):
        """Code frais : le pas déjà consommé à la connexion est remis à zéro
        (en vrai, l'administrateur attend le code suivant)."""
        cx = db.connecter()
        try:
            cx.execute("UPDATE admin_users SET totp_dernier_pas = 0")
            cx.valider()
        finally:
            cx.fermer()
        r = c.post("/api/admin/reauth", json={"code": admin._code(self.secret, int(time.time() // 30))}, headers=self.csrf(c))
        self.assertEqual(r.status_code, 200, r.get_json())

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
        # désactiver exige un code frais depuis le 16/10/2026
        r = c.post(f"/api/admin/utilisateurs/{lec.id}/desactiver", json={"motif": "test"}, headers=self.csrf(c))
        self.assertEqual((r.status_code, r.get_json()["code"]), (403, "reauth"))
        self.assertEqual(lec.get("/api/moi").status_code, 200)
        self.reauth(c)
        r = c.post(f"/api/admin/utilisateurs/{lec.id}/desactiver", json={"motif": "test"}, headers=self.csrf(c))
        self.assertEqual(r.status_code, 200)
        self.assertEqual(lec.get("/api/moi").status_code, 401)


class Consolidation(TestBase):
    """Audit du 16/10/2026 : rôles, réauthentification, remboursements, simulateur."""
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        os.environ["SOZO_MODE_TEST"] = "1"
        cls.secret = creer_admin("finance@sozo.test", "finance")
        cls.secret_lecture = creer_admin("lecture@sozo.test", "lecture")
        cls.slug = Personne(cls.app, "auteur").livre(prix=(25, 75, 300))

    def connecter(self, email, secret):
        cx = db.connecter()
        try:
            cx.execute("UPDATE admin_users SET totp_dernier_pas = 0")
            cx.valider()
        finally:
            cx.fermer()
        c = self.app.test_client()
        r = c.post("/api/admin/sessions", json={"email": email, "mot_de_passe": MDP_ADMIN, "code": admin._code(secret, int(time.time() // 30))},
                   environ_base={"REMOTE_ADDR": "192.0.2.80"})
        self.assertEqual(r.status_code, 200)
        return c

    csrf = Administration.csrf

    def reauth(self, c):
        Administration.reauth(self, c)

    def achat_confirme(self, cle):
        lec = Personne(self.app)
        pid = lec.post("/api/paiements", {"objet": "livre", "livre": self.slug, "idempotency_key": "test-cle-" + cle}).get_json()["paiement"]["id"]
        self.assertTrue(lec.post(f"/api/paiements/{pid}/simulation", {"issue": "success"}).get_json()["applique"])
        return lec, pid

    def test_role_lecture_ne_confirme_rien(self):
        lec = Personne(self.app)
        pid = lec.post("/api/paiements", {"objet": "livre", "livre": self.slug, "idempotency_key": "test-cle-role"}).get_json()["paiement"]["id"]
        c = self.connecter("lecture@sozo.test", self.secret_lecture)
        r = c.post(f"/api/admin/paiements/{pid}/confirmer", json={}, headers=self.csrf(c))
        self.assertEqual((r.status_code, r.get_json().get("code")), (403, "role"), r.get_json())
        self.assertEqual(lec.get(f"/api/livres/{self.slug}/pages/3").status_code, 402)
        self.assertEqual(c.get("/api/admin/paiements?etat=TOUS").status_code, 200)   # mais il voit

    def test_remboursement_retire_l_acces_et_corrige_le_registre(self):
        lec, pid = self.achat_confirme("remb")
        self.assertEqual(lec.get(f"/api/livres/{self.slug}/pages/3").status_code, 200)
        c = self.connecter("finance@sozo.test", self.secret)
        r = c.post(f"/api/admin/paiements/{pid}/rembourser", json={"motif": "Litige"}, headers=self.csrf(c))
        self.assertEqual((r.status_code, r.get_json()["code"]), (403, "reauth"))   # pas sans code frais
        self.reauth(c)
        self.assertEqual(c.post(f"/api/admin/paiements/{pid}/rembourser", json={"motif": "Litige"}, headers=self.csrf(c)).status_code, 200)
        self.assertEqual(c.post(f"/api/admin/paiements/{pid}/rembourser", json={"motif": "Encore"}, headers=self.csrf(c)).status_code, 409)
        self.assertEqual(lec.get(f"/api/livres/{self.slug}/pages/3").status_code, 402)          # le droit est retiré
        lignes = sql("SELECT beneficiaire, montant FROM ledger WHERE payment_id = ?", (pid,))
        self.assertEqual(sum(x["montant"] for x in lignes), 0)                                   # tout est annulé…
        self.assertEqual(len(lignes), 4)                                                         # …par des lignes AJOUTÉES
        self.assertEqual(sql("SELECT etat FROM payments WHERE id = ?", (pid,))[0]["etat"], "CONFIRMED")   # l'histoire reste vraie

    def test_simulateur_doublon_et_montant_faux(self):
        lec = Personne(self.app)
        pid = lec.post("/api/paiements", {"objet": "livre", "livre": self.slug, "idempotency_key": "test-cle-sim-d"}).get_json()["paiement"]["id"]
        r = lec.post(f"/api/paiements/{pid}/simulation", {"issue": "doublon"}).get_json()
        self.assertTrue(r["premier"]["applique"]); self.assertTrue(r["second"]["deja_traite"])
        self.assertEqual(len(sql("SELECT id FROM ledger WHERE payment_id = ? AND beneficiaire = 'auteur'", (pid,))), 1)
        lec2 = Personne(self.app)
        pid2 = lec2.post("/api/paiements", {"objet": "livre", "livre": self.slug, "idempotency_key": "test-cle-sim-m"}).get_json()["paiement"]["id"]
        self.assertTrue(lec2.post(f"/api/paiements/{pid2}/simulation", {"issue": "montant_faux"}).get_json()["revue"])
        self.assertEqual(lec2.get(f"/api/livres/{self.slug}/pages/3").status_code, 402)

    def test_simulateur_absent_hors_mode_test(self):
        lec = Personne(self.app)
        pid = lec.post("/api/paiements", {"objet": "livre", "livre": self.slug, "idempotency_key": "test-cle-sim-prod"}).get_json()["paiement"]["id"]
        os.environ["SOZO_MODE_TEST"] = "0"
        try:
            self.assertEqual(lec.post(f"/api/paiements/{pid}/simulation", {"issue": "success"}).status_code, 404)
        finally:
            os.environ["SOZO_MODE_TEST"] = "1"
        self.assertEqual(sql("SELECT etat FROM payments WHERE id = ?", (pid,))[0]["etat"], "CREATED")

    def test_une_vente_remboursee_ne_compte_plus(self):
        """Défaut constaté le 16/10/2026 : « Ventes confirmées : 2 » pour une
        seule vente remboursée (la requête comptait les LIGNES du registre, et
        un remboursement en ajoute une, correctrice)."""
        auteur = Personne(self.app, "auteur")
        slug = auteur.livre(prix=(25, 75, 300))
        ancien, self.slug = self.slug, slug
        lec, pid = self.achat_confirme("ventes-a")
        self.achat_confirme("ventes-b")
        v = {x["slug"]: x for x in auteur.get("/api/studio/ventes").get_json()["livres"]}[slug]
        self.assertEqual((v["ventes"], v["net"]), (2, 510))
        c = self.connecter("finance@sozo.test", self.secret)
        self.reauth(c)
        self.assertEqual(c.post(f"/api/admin/paiements/{pid}/rembourser", json={"motif": "Litige"}, headers=self.csrf(c)).status_code, 200)
        v = {x["slug"]: x for x in auteur.get("/api/studio/ventes").get_json()["livres"]}[slug]
        self.assertEqual((v["ventes"], v["net"], v["remboursees"]), (1, 255, 1))
        self.slug = ancien
