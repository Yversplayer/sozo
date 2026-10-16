"""Audit du 16/10/2026 — défauts constatés, chacun verrouillé par un test qui
échoue quand on retire la correction.

* une notification de paiement signée confirmait sans vérifier le montant ni
  la devise ;
* les frais du prestataire n'apparaissaient pas au registre ;
* un achat jamais payé restait ouvert indéfiniment ;
* l'analyse d'un manuscrit n'avait pas de limite de temps."""
import hashlib
import hmac
import json
import os
import time
from datetime import datetime, timedelta

import extraction
from tests.aide import Personne, TestBase
from tests.test_argent import sql


def _lent(octets):                      # cible d'extraction qui ne rend jamais la main
    time.sleep(60)


def ecrire(q, p=()):
    import db
    cx = db.connecter(globale=True)
    try:
        cx.execute(q, p)
        cx.valider()
    finally:
        cx.fermer()


class Notification(TestBase):
    SECRET = "secret-consolidation"

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        os.environ["SOZO_WEBHOOK_SECRET_BACASABLE"] = cls.SECRET
        os.environ["SOZO_MODE_TEST"] = "1"
        cls.slug = Personne(cls.app, "auteur").livre(prix=(25, 75, 300))

    def envoyer(self, corps):
        brut = json.dumps(corps).encode()
        sig = hmac.new(self.SECRET.encode(), brut, hashlib.sha256).hexdigest()
        return self.app.test_client().post("/api/paiements/webhook/bacasable", data=brut,
                                           headers={"Content-Type": "application/json", "X-Sozo-Signature": sig})

    def achat(self, cle):
        lec = Personne(self.app)
        p = lec.post("/api/paiements", {"objet": "livre", "livre": self.slug, "idempotency_key": "test-cle-" + cle}).get_json()["paiement"]
        return lec, p

    def test_montant_inferieur_n_ouvre_rien(self):
        lec, p = self.achat("montant-bas")
        r = self.envoyer({"event_id": "c-1", "payment_id": p["id"], "statut": "success", "montant": 10, "devise": "USD"})
        self.assertTrue(r.get_json()["revue"])
        self.assertEqual(sql("SELECT etat FROM payments WHERE id = ?", (p["id"],))[0]["etat"], "UNKNOWN")
        self.assertEqual(sql("SELECT COUNT(*) AS n FROM entitlements WHERE payment_id = ?", (p["id"],))[0]["n"], 0)
        self.assertEqual(lec.get(f"/api/livres/{self.slug}/pages/3").status_code, 402)

    def test_devise_differente_n_ouvre_rien(self):
        _, p = self.achat("devise")
        self.envoyer({"event_id": "c-2", "payment_id": p["id"], "statut": "success", "montant": p["montant"], "devise": "CDF"})
        self.assertEqual(sql("SELECT COUNT(*) AS n FROM entitlements WHERE payment_id = ?", (p["id"],))[0]["n"], 0)

    def test_succes_sans_montant_refuse(self):
        _, p = self.achat("sans-montant")
        self.assertEqual(self.envoyer({"event_id": "c-3", "payment_id": p["id"], "statut": "success"}).status_code, 400)
        self.assertEqual(sql("SELECT etat FROM payments WHERE id = ?", (p["id"],))[0]["etat"], "CREATED")

    def test_frais_au_registre_pris_sur_la_part_de_sozo(self):
        _, p = self.achat("frais")
        r = self.envoyer({"event_id": "c-4", "payment_id": p["id"], "statut": "success", "montant": 300, "devise": "usd", "frais": 9})
        self.assertTrue(r.get_json()["applique"])
        l = {x["beneficiaire"]: x["montant"] for x in sql("SELECT beneficiaire, montant FROM ledger WHERE payment_id = ?", (p["id"],))}
        self.assertEqual(l, {"auteur": 255, "plateforme": 36, "frais": 9})   # l'auteur garde ses 85 %
        self.assertEqual(sum(l.values()), 300)                                 # le registre se rapproche du montant payé


class Expiration(TestBase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        os.environ["SOZO_MODE_TEST"] = "1"
        os.environ["SOZO_WEBHOOK_SECRET_BACASABLE"] = Notification.SECRET
        cls.slug = Personne(cls.app, "auteur").livre(prix=(25, 75, 300))

    def vieux_achat(self, cle):
        lec = Personne(self.app)
        p = lec.post("/api/paiements", {"objet": "livre", "livre": self.slug, "idempotency_key": "test-cle-" + cle}).get_json()["paiement"]
        il_y_a = (datetime.utcnow() - timedelta(hours=49)).strftime("%Y-%m-%dT%H:%M:%SZ")
        ecrire("UPDATE payments SET created_at = ? WHERE id = ?", (il_y_a, p["id"]))
        return lec, p

    def test_achat_de_49h_ne_se_declare_plus(self):
        lec, p = self.vieux_achat("expire")
        r = lec.post(f"/api/paiements/{p['id']}/declaration", {"operateur": "M-Pesa", "reference": "EXPIRE0001"})
        self.assertEqual((r.status_code, r.get_json().get("code")), (409, "expire"))
        self.assertEqual(sql("SELECT etat FROM payments WHERE id = ?", (p["id"],))[0]["etat"], "EXPIRED")

    def test_achat_recent_se_declare(self):
        lec = Personne(self.app)
        p = lec.post("/api/paiements", {"objet": "livre", "livre": self.slug, "idempotency_key": "test-cle-recent"}).get_json()["paiement"]
        self.assertEqual(lec.post(f"/api/paiements/{p['id']}/declaration", {"operateur": "M-Pesa", "reference": "RECENT0001"}).status_code, 200)

    def test_argent_recu_apres_expiration_part_en_revue(self):
        lec, p = self.vieux_achat("tardif")
        lec.post(f"/api/paiements/{p['id']}/declaration", {"operateur": "M-Pesa", "reference": "TARDIF0001"})   # l'expire
        r = Notification.envoyer(self, {"event_id": "t-1", "payment_id": p["id"], "statut": "success", "montant": 300, "devise": "USD"})
        self.assertTrue(r.get_json()["revue"])
        self.assertEqual(sql("SELECT etat FROM payments WHERE id = ?", (p["id"],))[0]["etat"], "UNKNOWN")   # ni perdu, ni ouvert
        self.assertEqual(sql("SELECT COUNT(*) AS n FROM entitlements WHERE payment_id = ?", (p["id"],))[0]["n"], 0)

    SECRET = Notification.SECRET


class ImportBorne(TestBase):
    def test_analyse_trop_longue_arretee(self):
        t = time.time()
        with self.assertRaises(extraction.Refus) as e:
            extraction.extraire_borne(b"%PDF-", delai=2, cible=_lent)
        self.assertIn("trop de temps", str(e.exception))
        self.assertLess(time.time() - t, 15)

    def test_refus_du_processus_remonte(self):
        with self.assertRaises(extraction.Refus):
            extraction.extraire_borne(b"pas un manuscrit", delai=20)


class Falsification(TestBase):
    def test_le_client_ne_fixe_ni_le_prix_ni_l_etat(self):
        os.environ["SOZO_MODE_TEST"] = "1"
        slug = Personne(self.app, "auteur").livre(prix=(25, 75, 300))
        lec = Personne(self.app)
        p = lec.post("/api/paiements", {"objet": "livre", "livre": slug, "idempotency_key": "test-cle-falsif",
                                        "montant": 1, "etat": "CONFIRMED", "devise": "CDF"}).get_json()["paiement"]
        self.assertEqual((p["montant"], p["etat"], p["devise"]), (300, "CREATED", "USD"))
        self.assertEqual(lec.get(f"/api/livres/{slug}/pages/3").status_code, 402)
