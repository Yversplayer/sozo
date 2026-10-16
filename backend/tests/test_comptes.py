"""Comptes et sessions — chaque test protège une règle de l'étape 2."""
import os
import threading

import db
import security
from tests.aide import TestBase

MDP = "Lumiere-2026!"


class Base(TestBase):
    n = 0

    def inscrire(self, client=None, email=None, role="lecteur"):
        Base.n += 1
        email = email or f"lecteur{Base.n}@exemple.cd"
        c = client or self.app.test_client()   # vierge : sinon la session ouverte exigerait le jeton CSRF
        r = c.post("/api/comptes", json={"nom": "Nard", "email": email, "mot_de_passe": MDP, "role": role, "cgu": True},
                   environ_base={"REMOTE_ADDR": f"10.0.{Base.n // 200}.{Base.n % 200}"})
        return r, email

    def csrf(self, c):
        ck = c.get_cookie(security.COOKIE_CSRF)
        return {security.EN_TETE_CSRF: ck.value} if ck else {}

    def sql(self, q, p=()):
        cx = db.connecter()
        try:
            return cx.tous(q, p)
        finally:
            cx.fermer()


class Inscription(Base):
    def test_compte_cree_mot_de_passe_hache(self):
        r, email = self.inscrire()
        self.assertEqual(r.status_code, 201)
        u = self.sql("SELECT password_hash, role FROM users WHERE email = ?", (email,))[0]
        self.assertNotIn(MDP, u["password_hash"])
        algo, it, sel, h = u["password_hash"].split("$")
        self.assertEqual(algo, "pbkdf2_sha256")
        self.assertGreaterEqual(int(it), 200_000)

    def test_cookie_httponly_strict(self):
        r, _ = self.inscrire()
        cookies = r.headers.getlist("Set-Cookie")
        sess = [c for c in cookies if c.startswith(security.COOKIE_SESSION + "=")][0]
        self.assertIn("HttpOnly", sess)
        self.assertIn("SameSite=Strict", sess)
        csrf = [c for c in cookies if c.startswith(security.COOKIE_CSRF + "=")][0]
        self.assertNotIn("HttpOnly", csrf)          # lisible par nos pages, pour l'en-tête

    def test_seule_l_empreinte_du_jeton_est_stockee(self):
        c = self.app.test_client()
        self.inscrire(c)
        jeton = c.get_cookie(security.COOKIE_SESSION).value
        self.assertEqual(self.sql("SELECT id FROM sessions WHERE token_hash = ?", (jeton,)), [])
        self.assertEqual(len(self.sql("SELECT id FROM sessions WHERE token_hash = ?", (security.empreinte(jeton),))), 1)
        # le jeton CSRF n'est jamais l'empreinte stockée
        self.assertNotEqual(c.get_cookie(security.COOKIE_CSRF).value, security.empreinte(jeton))

    def test_role_admin_refuse(self):
        r = self.client.post("/api/comptes", json={"nom": "X", "email": "x@exemple.cd", "mot_de_passe": MDP, "role": "admin", "cgu": True})
        self.assertEqual(r.status_code, 400)

    def test_doublon_refuse(self):
        _, email = self.inscrire()
        r, _ = self.inscrire(email=email)
        self.assertEqual(r.status_code, 409)

    def test_email_capture_jamais_envoye(self):
        _, email = self.inscrire()
        m = self.sql("SELECT etat FROM envois WHERE destinataire = ?", (email,))
        self.assertEqual([x["etat"] for x in m], ["capture"])


class Connexion(Base):
    def test_meme_reponse_compte_inconnu_ou_mauvais_mdp(self):
        _, email = self.inscrire()
        r1 = self.client.post("/api/sessions", json={"email": email, "mot_de_passe": "mauvais-mot"})
        r2 = self.client.post("/api/sessions", json={"email": "personne@exemple.cd", "mot_de_passe": "mauvais-mot"})
        self.assertEqual((r1.status_code, r2.status_code), (401, 401))
        self.assertEqual(r1.get_json(), r2.get_json())

    def test_connexion_puis_moi(self):
        _, email = self.inscrire()
        c = self.app.test_client()
        self.assertEqual(c.get("/api/moi").status_code, 401)
        r = c.post("/api/sessions", json={"email": email.upper(), "mot_de_passe": MDP})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(c.get("/api/moi").get_json()["moi"]["email"], email)

    def test_limitation_par_compte(self):
        _, email = self.inscrire()
        codes = [self.app.test_client().post("/api/sessions", json={"email": email, "mot_de_passe": "faux-faux"},
                                             environ_base={"REMOTE_ADDR": f"172.16.0.{i}"}).status_code for i in range(8)]
        self.assertIn(429, codes)                              # changer d'IP ne contourne pas la limite du compte
        r = self.app.test_client().post("/api/sessions", json={"email": email, "mot_de_passe": MDP})
        self.assertEqual(r.status_code, 429)                   # même le bon mot de passe attend

    def test_ip_annoncee_ignoree_sans_secret_du_proxy(self):
        """Un attaquant qui invente CF-Connecting-IP à chaque essai ne doit pas
        repartir de zéro : sans le secret du Worker, l'en-tête est ignoré."""
        codes = []
        for i in range(25):
            r = self.app.test_client().post("/api/sessions", json={"email": f"inconnu{i}@exemple.cd", "mot_de_passe": "faux-faux"},
                                            headers={"CF-Connecting-IP": f"203.0.113.{i}"}, environ_base={"REMOTE_ADDR": "198.51.100.7"})
            codes.append(r.status_code)
        self.assertIn(429, codes)


class Csrf(Base):
    def test_mutation_sans_jeton_refusee_et_auditee(self):
        c = self.app.test_client()
        self.inscrire(c)
        r = c.post("/api/moi/mot-de-passe", json={"ancien": MDP, "nouveau": "Nouveau-2026!"})
        self.assertEqual(r.status_code, 403)
        r = c.post("/api/moi/mot-de-passe", json={"ancien": MDP, "nouveau": "Nouveau-2026!"}, headers={security.EN_TETE_CSRF: "faux"})
        self.assertEqual(r.status_code, 403)
        self.assertTrue(self.sql("SELECT id FROM audit_log WHERE action = 'csrf.refus'"))
        r = c.post("/api/moi/mot-de-passe", json={"ancien": MDP, "nouveau": "Nouveau-2026!"}, headers=self.csrf(c))
        self.assertEqual(r.status_code, 200)

    def test_corps_non_json_refuse(self):
        c = self.app.test_client()
        self.inscrire(c)
        r = c.post("/api/moi/mot-de-passe", data="ancien=x&nouveau=y", headers={**self.csrf(c), "Content-Type": "application/x-www-form-urlencoded"})
        self.assertEqual(r.status_code, 415)


class Sessions(Base):
    def test_deconnexion_revoque(self):
        c = self.app.test_client()
        self.inscrire(c)
        jeton = c.get_cookie(security.COOKIE_SESSION).value
        self.assertEqual(c.delete("/api/sessions/courante", headers=self.csrf(c)).status_code, 200)
        c2 = self.app.test_client()
        c2.set_cookie(security.COOKIE_SESSION, jeton)        # le jeton volé ne sert plus
        self.assertEqual(c2.get("/api/moi").status_code, 401)

    def test_changement_de_mdp_revoque_les_autres_sessions(self):
        c1 = self.app.test_client()
        _, email = self.inscrire(c1)
        c2 = self.app.test_client()
        c2.post("/api/sessions", json={"email": email, "mot_de_passe": MDP})
        self.assertEqual(c2.get("/api/moi").status_code, 200)
        c1.post("/api/moi/mot-de-passe", json={"ancien": MDP, "nouveau": "Nouveau-2026!"}, headers=self.csrf(c1))
        self.assertEqual(c2.get("/api/moi").status_code, 401)  # l'autre appareil est déconnecté
        self.assertEqual(c1.get("/api/moi").status_code, 200)  # celui qui change reste connecté

    def test_session_expiree_refusee(self):
        c = self.app.test_client()
        self.inscrire(c)
        jeton = c.get_cookie(security.COOKIE_SESSION).value
        cx = db.connecter()
        try:
            cx.execute("UPDATE sessions SET expires_at = ? WHERE token_hash = ?", ("2000-01-01T00:00:00Z", security.empreinte(jeton)))
            cx.valider()
        finally:
            cx.fermer()
        self.assertEqual(c.get("/api/moi").status_code, 401)


class Reinitialisation(Base):
    def _jeton(self, email):
        cx = db.connecter()
        try:
            u = cx.un("SELECT id FROM users WHERE email = ?", (email,))
            j = security.creer_jeton_usage_unique(cx, u["id"], "reinitialisation", __import__("datetime").timedelta(hours=1))
            cx.valider()
            return j
        finally:
            cx.fermer()

    def test_meme_reponse_compte_existant_ou_non(self):
        _, email = self.inscrire()
        r1 = self.client.post("/api/comptes/reinitialisation", json={"email": email}, environ_base={"REMOTE_ADDR": "10.9.0.1"})
        r2 = self.client.post("/api/comptes/reinitialisation", json={"email": "absent@exemple.cd"}, environ_base={"REMOTE_ADDR": "10.9.0.2"})
        self.assertEqual((r1.status_code, r1.get_json()), (r2.status_code, r2.get_json()))

    def test_jeton_a_usage_unique_et_stocke_en_empreinte(self):
        _, email = self.inscrire()
        j = self._jeton(email)
        self.assertEqual(self.sql("SELECT id FROM jetons WHERE token_hash = ?", (j,)), [])
        r1 = self.client.post("/api/comptes/reinitialisation/confirmer", json={"jeton": j, "nouveau": "Encore-2026!"})
        r2 = self.client.post("/api/comptes/reinitialisation/confirmer", json={"jeton": j, "nouveau": "Autre-2026!!"})
        self.assertEqual((r1.status_code, r2.status_code), (200, 400))
        ok = self.app.test_client().post("/api/sessions", json={"email": email, "mot_de_passe": "Encore-2026!"})
        self.assertEqual(ok.status_code, 200)

    def test_consommation_atomique_en_parallele(self):
        """Klassio : une invitation consommée deux fois en parallèle. Ici, dix
        requêtes simultanées sur le même jeton : une seule réussit."""
        _, email = self.inscrire()
        j = self._jeton(email)
        codes, depart = [], threading.Barrier(10)

        def essai():
            depart.wait()
            r = self.app.test_client().post("/api/comptes/reinitialisation/confirmer", json={"jeton": j, "nouveau": "Parallele-2026!"})
            codes.append(r.status_code)
        fils = [threading.Thread(target=essai) for _ in range(10)]
        [f.start() for f in fils]
        [f.join() for f in fils]
        self.assertEqual(codes.count(200), 1, codes)

    def test_boite_de_test_absente_hors_mode_test(self):
        os.environ.pop("SOZO_MODE_TEST", None)
        self.assertEqual(self.client.get("/api/dev/boite").status_code, 404)
