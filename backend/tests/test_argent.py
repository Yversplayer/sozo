"""Étape 5 — l'argent. Chaque test protège un défaut qui coûterait de l'argent réel."""
import hashlib
import hmac
import json
import os
import threading

import db
from tests.aide import Personne, TestBase, confirmer_paiement


def sql(q, p=()):
    cx = db.connecter(globale=True)        # les vérifications du test voient tout
    try:
        return cx.tous(q, p)
    finally:
        cx.fermer()


class Achats(TestBase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        os.environ["SOZO_MODE_TEST"] = "1"
        cls.auteur = Personne(cls.app, "auteur")
        cls.slug = cls.auteur.livre(prix=(25, 75, 300))

    def acheter(self, qui, cle, **crit):
        crit.setdefault("objet", "page"); crit.setdefault("livre", self.slug)
        if crit["objet"] == "page":
            crit.setdefault("n", 3)
        return qui.post("/api/paiements", dict(crit, idempotency_key="test-cle-" + cle))

    def test_le_prix_vient_du_serveur(self):
        lec = Personne(self.app)
        r = self.acheter(lec, "prix-01", montant=1, prix=0.01)
        self.assertEqual(r.get_json()["paiement"]["montant"], 25)

    def test_idempotence_par_acheteur(self):
        a, b = Personne(self.app), Personne(self.app)
        p1 = self.acheter(a, "meme-cle-123").get_json()["paiement"]["id"]
        p2 = self.acheter(a, "meme-cle-123").get_json()["paiement"]["id"]
        self.assertEqual(p1, p2)                                   # double clic : un seul achat
        p3 = self.acheter(b, "meme-cle-123").get_json()["paiement"]["id"]
        self.assertNotEqual(p1, p3)                                # la clé de A ne bloque pas B

    def test_page_gratuite_ou_propre_livre_non_vendue(self):
        lec = Personne(self.app)
        self.assertEqual(self.acheter(lec, "gratuite-1", n=1).status_code, 400)
        self.assertEqual(self.acheter(self.auteur, "mon-livre-1").status_code, 400)

    def test_livre_d_exemple_jamais_vendu(self):
        # Le catalogue d'exemple (books.demo = 1) est chargé EN LIGNE : un
        # visiteur ne doit pas pouvoir payer en vrai un livre inventé.
        slug = self.auteur.livre(titre="Exemple", prix=(25, 75, 300))
        cx = db.connecter(globale=True)
        try:
            cx.execute("UPDATE books SET demo = 1 WHERE slug = ?", (slug,))
            cx.valider()
        finally:
            cx.fermer()
        lec = Personne(self.app)
        for objet in ("page", "chapitre", "livre"):
            r = self.acheter(lec, "exemple-" + objet, objet=objet, livre=slug)
            self.assertEqual(r.status_code, 400, objet)
            self.assertIn("exemple", r.get_json()["erreur"])
        self.assertEqual(sql("SELECT COUNT(*) AS n FROM payments p JOIN books b ON b.id = p.book_id WHERE b.slug = ?", (slug,))[0]["n"], 0)

    def test_recu_et_droits_seulement_apres_confirmation(self):
        lec = Personne(self.app)
        pid = self.acheter(lec, "recu-1").get_json()["paiement"]["id"]
        r = lec.post(f"/api/paiements/{pid}/declaration", {"operateur": "M-Pesa", "reference": "MP-REC-0001"})
        self.assertEqual(r.get_json()["paiement"]["etat"], "PENDING")
        self.assertEqual(sql("SELECT id FROM receipts WHERE payment_id = ?", (pid,)), [])
        self.assertEqual(sql("SELECT id FROM entitlements WHERE payment_id = ?", (pid,)), [])
        confirmer_paiement(pid)
        self.assertEqual(len(sql("SELECT id FROM receipts WHERE payment_id = ?", (pid,))), 1)
        self.assertEqual(len(sql("SELECT id FROM entitlements WHERE payment_id = ?", (pid,))), 1)

    def test_une_reference_ne_paie_qu_un_achat(self):
        a, b = Personne(self.app), Personne(self.app)
        p1 = self.acheter(a, "ref-a").get_json()["paiement"]["id"]
        p2 = self.acheter(b, "ref-b").get_json()["paiement"]["id"]
        self.assertEqual(a.post(f"/api/paiements/{p1}/declaration", {"operateur": "Orange Money", "reference": "OM-UNIQUE-77"}).status_code, 200)
        self.assertEqual(b.post(f"/api/paiements/{p2}/declaration", {"operateur": "Orange Money", "reference": "OM-UNIQUE-77"}).status_code, 409)

    def test_confirmation_atomique_en_parallele(self):
        lec = Personne(self.app)
        pid = self.acheter(lec, "parallele-1").get_json()["paiement"]["id"]
        resultats, depart = [], threading.Barrier(8)

        def go():
            depart.wait()
            resultats.append(confirmer_paiement(pid))
        fils = [threading.Thread(target=go) for _ in range(8)]
        [f.start() for f in fils]; [f.join() for f in fils]
        self.assertEqual(len(resultats), 8, "une confirmation concurrente a planté au lieu de répondre « déjà fait »")
        self.assertEqual(resultats.count(True), 1)
        self.assertFalse(confirmer_paiement(pid))          # rejouée : refus propre, sans erreur
        self.assertEqual(len(sql("SELECT id FROM receipts WHERE payment_id = ?", (pid,))), 1)
        self.assertEqual(len(sql("SELECT id FROM ledger WHERE payment_id = ?", (pid,))), 2)

    def test_registre_somme_exacte_et_commission(self):
        lec = Personne(self.app)
        pid = self.acheter(lec, "registre-1", objet="livre").get_json()["paiement"]["id"]
        confirmer_paiement(pid)
        lignes = sql("SELECT beneficiaire, montant FROM ledger WHERE payment_id = ?", (pid,))
        self.assertEqual(sum(x["montant"] for x in lignes), 300)
        self.assertEqual({x["beneficiaire"]: x["montant"] for x in lignes}, {"auteur": 255, "plateforme": 45})

    def test_plume_reduit_la_commission(self):
        auteur = Personne(self.app, "auteur")
        slug = auteur.livre(prix=(25, 75, 1000))
        pp = auteur.post("/api/paiements", {"objet": "plume", "idempotency_key": "test-cle-plume-1"}).get_json()["paiement"]["id"]
        confirmer_paiement(pp)
        lec = Personne(self.app)
        pid = lec.post("/api/paiements", {"objet": "livre", "livre": slug, "idempotency_key": "test-cle-p-livre-plume"}).get_json()["paiement"]["id"]
        confirmer_paiement(pid)
        lignes = {x["beneficiaire"]: x["montant"] for x in sql("SELECT beneficiaire, montant FROM ledger WHERE payment_id = ?", (pid,))}
        self.assertEqual(lignes, {"auteur": 900, "plateforme": 100})

    def test_plume_reserve_aux_auteurs(self):
        self.assertEqual(Personne(self.app).post("/api/paiements", {"objet": "plume", "idempotency_key": "test-cle-plume-lecteur"}).status_code, 400)

    def test_un_droit_ne_disparait_jamais(self):
        lec = Personne(self.app)
        pid = self.acheter(lec, "eternel-1").get_json()["paiement"]["id"]
        confirmer_paiement(pid)
        # l'auteur change d'avis : page 3 devient gratuite puis le livre double ses prix
        self.auteur.patch(f"/api/studio/livres/{self.slug}", {"prix_page": 999})
        self.assertEqual(lec.get(f"/api/livres/{self.slug}/pages/3").status_code, 200)
        # refuser après confirmation est impossible
        import argent
        cx = db.connecter()
        try:
            self.assertFalse(argent.refuser(cx, pid, "test", "trop tard"))
        finally:
            cx.fermer()


class Webhook(TestBase):
    SECRET = "secret-de-test-bac-a-sable"

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        os.environ["SOZO_WEBHOOK_SECRET_BACASABLE"] = cls.SECRET
        cls.slug = Personne(cls.app, "auteur").livre()

    def envoyer(self, corps, secret=None):
        brut = json.dumps(corps).encode()
        sig = hmac.new((secret or self.SECRET).encode(), brut, hashlib.sha256).hexdigest()
        return self.app.test_client().post("/api/paiements/webhook/bacasable", data=brut,
                                           headers={"Content-Type": "application/json", "X-Sozo-Signature": sig})

    def test_signature_obligatoire(self):
        lec = Personne(self.app)
        pid = lec.post("/api/paiements", {"objet": "page", "livre": self.slug, "n": 3, "idempotency_key": "test-cle-wh-sig"}).get_json()["paiement"]["id"]
        self.assertEqual(self.envoyer({"event_id": "e1", "payment_id": pid, "statut": "success"}, secret="faux").status_code, 401)
        self.assertEqual(sql("SELECT etat FROM payments WHERE id = ?", (pid,))[0]["etat"], "CREATED")

    def test_rejeu_ne_confirme_qu_une_fois_et_echec_ne_defait_rien(self):
        lec = Personne(self.app)
        pid = lec.post("/api/paiements", {"objet": "page", "livre": self.slug, "n": 3, "idempotency_key": "test-cle-wh-rejeu"}).get_json()["paiement"]["id"]
        m = sql("SELECT montant FROM payments WHERE id = ?", (pid,))[0]["montant"]
        ok = {"payment_id": pid, "statut": "success", "montant": m, "devise": "USD"}   # le montant encaissé est exigé depuis le 16/10
        r1 = self.envoyer({"event_id": "evt-1", **ok})
        r2 = self.envoyer({"event_id": "evt-1", **ok})
        r3 = self.envoyer({"event_id": "evt-2", **ok})
        self.assertTrue(r1.get_json()["applique"])
        self.assertTrue(r2.get_json()["deja_traite"])
        self.assertFalse(r3.get_json()["applique"])
        self.assertEqual(len(sql("SELECT id FROM receipts WHERE payment_id = ?", (pid,))), 1)
        self.envoyer({"event_id": "evt-3", "payment_id": pid, "statut": "failed"})
        self.assertEqual(sql("SELECT etat FROM payments WHERE id = ?", (pid,))[0]["etat"], "CONFIRMED")

    def test_prestataire_inconnu(self):
        self.assertEqual(self.app.test_client().post("/api/paiements/webhook/inconnu", json={}).status_code, 404)


class Reversements(TestBase):
    def test_pas_plus_que_le_solde_meme_en_parallele(self):
        os.environ["SOZO_MODE_TEST"] = "1"
        auteur = Personne(self.app, "auteur")
        slug = auteur.livre(prix=(25, 75, 1000))
        lec = Personne(self.app)
        confirmer_paiement(lec.post("/api/paiements", {"objet": "livre", "livre": slug, "idempotency_key": "test-cle-rev-1"}).get_json()["paiement"]["id"])
        solde = auteur.get("/api/studio/ventes").get_json()["solde"]
        self.assertEqual(solde, 850)
        self.assertEqual(auteur.post("/api/studio/reversements", {"montant": solde + 1, "operateur": "M-Pesa", "numero": "+243810000000"}).status_code, 409)
        codes, depart = [], threading.Barrier(5)

        def go():
            depart.wait()
            codes.append(auteur.post("/api/studio/reversements", {"montant": solde, "operateur": "M-Pesa", "numero": "+243810000000"}).status_code)
        fils = [threading.Thread(target=go) for _ in range(5)]
        [f.start() for f in fils]; [f.join() for f in fils]
        self.assertEqual(codes.count(201), 1, codes)
        self.assertEqual(auteur.get("/api/studio/ventes").get_json()["solde"], 0)
