"""Notifications (16/10/2026) : le bon fait, à la bonne personne, une seule
fois, par les canaux qu'elle a choisis — et jamais d'envoi vers une adresse
de service inconnue."""
import json
import os
from unittest import mock

import db
import envois
import notifications
import taches
from tests.aide import Personne, TestBase, confirmer_paiement
from tests.test_argent import sql


def ecrire(q, p=()):
    cx = db.connecter(globale=True)
    try:
        cx.execute(q, p)
        cx.valider()
    finally:
        cx.fermer()


VAPID = {"SOZO_VAPID_PRIVE": "cle-privee-de-test", "SOZO_VAPID_PUBLIC": "cle-publique-de-test"}


class Notifications(TestBase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        os.environ["SOZO_MODE_TEST"] = "1"

    def test_paiement_confirme_previent_lecteur_et_auteur_une_seule_fois(self):
        auteur = Personne(self.app, "auteur")
        slug = auteur.livre(prix=(25, 75, 300))
        lec = Personne(self.app)
        pid = lec.post("/api/paiements", {"objet": "livre", "livre": slug, "idempotency_key": "test-cle-notif-1"}).get_json()["paiement"]["id"]
        confirmer_paiement(pid)
        confirmer_paiement(pid)                                       # rejeu : rien de plus
        mien = lec.get("/api/notifications").get_json()
        self.assertEqual([n["type"] for n in mien["liste"]], ["paiement"])
        self.assertEqual(mien["non_lues"], 1)
        self.assertEqual([n["type"] for n in auteur.get("/api/notifications").get_json()["liste"]], ["vente"])
        self.assertTrue(sql("SELECT id FROM envois WHERE user_id = ? AND canal = 'email' AND sujet LIKE 'Paiement confirmé%'", (lec.id,)))

    def test_chacun_ne_voit_que_les_siennes(self):
        a, b = Personne(self.app), Personne(self.app)
        cx = db.connecter(globale=True)
        try:
            notifications.emettre(cx, a.id, "securite", "Secret de A", "corps", None, "test:a")
            cx.valider()
        finally:
            cx.fermer()
        self.assertNotIn("Secret de A", b.get("/api/notifications").get_data(as_text=True))
        nid = a.get("/api/notifications").get_json()["liste"][0]["id"]
        b.post("/api/notifications/lues", {"ids": [nid]})          # B ne peut pas marquer celle de A
        self.assertIsNone(sql("SELECT lu_le FROM notifications WHERE id = ?", (nid,))[0]["lu_le"])
        a.post("/api/notifications/lues", {"ids": [nid]})
        self.assertEqual(a.get("/api/notifications?compte=1").get_json()["non_lues"], 0)

    def test_parution_programmee_annoncee_une_fois_aux_suiveurs_seulement(self):
        auteur = Personne(self.app, "auteur")
        slug = auteur.livre()                                       # 1-4 publiées, 5-6 brouillons
        suiveur, autre = Personne(self.app), Personne(self.app)
        suiveur.post(f"/api/suivis/{slug}", {})
        auteur.post(f"/api/studio/livres/{slug}/pages/lot", {"pages": [5, 6], "action": "programmer", "date": "2099-01-01T10:00Z"})
        taches.annoncer_parutions()
        self.assertEqual(suiveur.get("/api/notifications").get_json()["liste"], [])     # pas avant l'heure
        ecrire("UPDATE pages SET publie_le = '2020-01-01T10:00:00Z' WHERE publie_le = '2099-01-01T10:00:00Z'")   # l'heure est venue
        taches.annoncer_parutions(); taches.annoncer_parutions()
        l = suiveur.get("/api/notifications").get_json()["liste"]
        self.assertEqual(len(l), 1)
        self.assertIn("pages 5 à 6", l[0]["corps"])
        self.assertEqual(autre.get("/api/notifications").get_json()["liste"], [])
        self.assertEqual([n for n in auteur.get("/api/notifications").get_json()["liste"] if n["type"] == "parution"], [])

    def test_publication_immediate_previent_sans_attendre(self):
        auteur = Personne(self.app, "auteur")
        slug = auteur.livre()
        suiveur = Personne(self.app)
        suiveur.post(f"/api/suivis/{slug}", {})
        auteur.put(f"/api/studio/livres/{slug}/pages/5", {"contenu": "Cinq"})
        auteur.post(f"/api/studio/livres/{slug}/pages/lot", {"pages": [5], "action": "publier"})
        self.assertEqual(len(suiveur.get("/api/notifications").get_json()["liste"]), 1)

    def test_preferences_coupent_l_email_mais_pas_la_securite(self):
        lec = Personne(self.app)
        prefs = {t: {"push": False, "email": False} for t in notifications.TYPES}
        r = lec.put("/api/notifications/preferences", {"preferences": prefs}).get_json()["preferences"]
        self.assertFalse(r["paiement"]["email"])
        self.assertTrue(r["securite"]["email"])                     # jamais coupée
        cx = db.connecter(globale=True)
        try:
            notifications.emettre(cx, lec.id, "paiement", "Essai", "corps", None, "test:pref")
            notifications.emettre(cx, lec.id, "securite", "Alerte", "corps", None, "test:secu")
            cx.valider()
        finally:
            cx.fermer()
        sujets = [e["sujet"] for e in sql("SELECT sujet FROM envois WHERE user_id = ? AND canal = 'email'", (lec.id,))]
        self.assertTrue(any(s.startswith("Alerte") for s in sujets))
        self.assertFalse(any(s.startswith("Essai") for s in sujets))


class Appareils(TestBase):
    def setUp(self):
        os.environ.update(VAPID)

    def tearDown(self):
        for k in VAPID:
            os.environ.pop(k, None)

    def abonner(self, p, endpoint="https://fcm.googleapis.com/fcm/send/abc123"):
        return p.post("/api/notifications/appareils", {"endpoint": endpoint, "keys": {"p256dh": "B" * 87, "auth": "a" * 22}, "libelle": "Téléphone"})

    def test_seuls_les_services_connus_sont_acceptes(self):
        p = Personne(self.app)
        for mauvais in ("http://fcm.googleapis.com/fcm/send/x", "https://169.254.169.254/latest", "https://localhost/push",
                        "https://fcm.googleapis.com.attaquant.cd/x", "https://fcm.googleapis.com:8443/x", "file:///etc/passwd"):
            self.assertEqual(self.abonner(p, mauvais).status_code, 400, mauvais)
        for bon in ("https://fcm.googleapis.com/fcm/send/x", "https://updates.push.services.mozilla.com/wpush/v2/x",
                    "https://web.push.apple.com/QGx", "https://wns2-par02p.notify.windows.com/w/?token=x"):
            self.assertEqual(self.abonner(p, bon).status_code, 201, bon)

    def test_sans_cles_vapid_on_le_dit(self):
        for k in VAPID:
            os.environ.pop(k, None)
        r = self.abonner(Personne(self.app))
        self.assertEqual((r.status_code, r.get_json()["code"]), (409, "push_inactif"))

    def test_envoi_chiffre_puis_appareil_mort_retire(self):
        p = Personne(self.app)
        self.abonner(p)
        cx = db.connecter(globale=True)
        try:
            notifications.emettre(cx, p.id, "paiement", "Payé", "Votre achat est ouvert", "/app/compte.html", "test:push")
            cx.valider()
        finally:
            cx.fermer()
        e = sql("SELECT id FROM envois WHERE user_id = ? AND canal = 'push'", (p.id,))
        self.assertEqual(len(e), 1)
        with mock.patch("pywebpush.webpush") as wp:
            self.assertEqual(envois.distribuer(ids=[e[0]["id"]])["envoyes"], 1)
            args, kw = wp.call_args
            self.assertEqual(json.loads(kw["data"])["titre"], "Payé")
            self.assertEqual(kw["vapid_claims"]["sub"], "mailto:mudeyimusimwa@gmail.com")
        # le service répond 410 : abonnement mort → appareil retiré, pas de nouvel essai
        from pywebpush import WebPushException
        cx = db.connecter(globale=True)
        try:
            notifications.emettre(cx, p.id, "paiement", "Encore", "x", None, "test:push2")
            cx.valider()
        finally:
            cx.fermer()
        e2 = sql("SELECT id FROM envois WHERE user_id = ? AND canal = 'push' AND sujet = 'Encore'", (p.id,))[0]["id"]
        mort = WebPushException("parti", response=mock.Mock(status_code=410))
        with mock.patch("pywebpush.webpush", side_effect=mort):
            self.assertEqual(envois.distribuer(ids=[e2])["abandons"], 1)
        self.assertEqual(sql("SELECT COUNT(*) AS n FROM appareils WHERE user_id = ?", (p.id,))[0]["n"], 0)

    def test_un_appareil_change_de_compte(self):
        a, b = Personne(self.app), Personne(self.app)
        self.abonner(a, "https://fcm.googleapis.com/fcm/send/partage")
        self.abonner(b, "https://fcm.googleapis.com/fcm/send/partage")
        self.assertEqual([r["user_id"] for r in sql("SELECT user_id FROM appareils WHERE endpoint LIKE '%partage'")], [b.id])


class ChiffrementReel(TestBase):
    """Pas un simulacre : de vraies clés VAPID, un « appareil » avec ses vraies
    clés ECDH, et la notification chiffrée par pywebpush est DÉCHIFFRÉE ici
    comme le ferait le navigateur. Seul l'envoi HTTP vers Google est intercepté."""

    def test_l_appareil_dechiffre_la_notification(self):
        import base64
        import http_ece
        from cryptography.hazmat.primitives import serialization
        from cryptography.hazmat.primitives.asymmetric import ec
        import sys
        sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "tools"))
        import vapid as outil
        prive, public = outil.generer()
        os.environ.update({"SOZO_VAPID_PRIVE": prive, "SOZO_VAPID_PUBLIC": public})
        try:
            b64 = lambda o: base64.urlsafe_b64encode(o).rstrip(b"=").decode()
            appareil = ec.generate_private_key(ec.SECP256R1())
            auth = os.urandom(16)
            p = Personne(self.app)
            r = p.post("/api/notifications/appareils", {"endpoint": "https://fcm.googleapis.com/fcm/send/vrai-test",
                                                         "keys": {"p256dh": b64(appareil.public_key().public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)),
                                                                  "auth": b64(auth)}})
            self.assertEqual(r.status_code, 201, r.get_json())
            cx = db.connecter(globale=True)
            try:
                notifications.emettre(cx, p.id, "paiement", "Paiement confirmé", "« Les veilleurs » : votre achat est ouvert.", "/app/livre.html?id=x", "test:chiffre")
                cx.valider()
            finally:
                cx.fermer()
            eid = sql("SELECT id FROM envois WHERE user_id = ? AND canal = 'push'", (p.id,))[0]["id"]
            with mock.patch("requests.post", return_value=mock.Mock(status_code=201, text="")) as post:
                self.assertEqual(envois.distribuer(ids=[eid])["envoyes"], 1)
            url, kw = post.call_args[0][0], post.call_args[1]
            self.assertEqual(url, "https://fcm.googleapis.com/fcm/send/vrai-test")
            self.assertIn(f"k={public}", kw["headers"]["Authorization"].replace(" ", ""))     # signé par NOTRE clé VAPID
            clair = http_ece.decrypt(kw["data"], private_key=appareil, auth_secret=auth, version="aes128gcm")
            d = json.loads(clair)
            self.assertEqual((d["titre"], d["lien"]), ("Paiement confirmé", "/app/livre.html?id=x"))
            self.assertNotIn(b"Paiement", kw["data"])                                            # en clair, rien ne transite
        finally:
            for k in VAPID:
                os.environ.pop(k, None)
