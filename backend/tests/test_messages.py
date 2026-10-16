"""Messages sortants (16/10/2026) : file d'envoi, SMTP réel vers un serveur
local, reprises, réservation atomique, codes effacés après envoi."""
import asyncore
import email
import os
import smtpd
import threading
import time
import warnings

import config
import db
import envois
import mailer
from tests.aide import TestBase


class Boite(smtpd.SMTPServer):
    """Un vrai serveur SMTP, local : le message traverse réellement le réseau."""
    def __init__(self):
        self.carte = {}
        super().__init__(("127.0.0.1", 0), None, decode_data=False, map=self.carte)
        self.recus, self.actif = [], True

    def tourner(self):
        while self.actif:
            asyncore.loop(timeout=0.05, count=1, map=self.carte)

    def process_message(self, peer, de, pour, donnees, **kw):
        self.recus.append(email.message_from_bytes(donnees))


def lire(q, p=()):
    cx = db.connecter(globale=True)
    try:
        return cx.tous(q, p)
    finally:
        cx.fermer()


class Messages(TestBase):
    def setUp(self):
        warnings.simplefilter("ignore", DeprecationWarning)
        self.boite = Boite()
        self.fil = threading.Thread(target=self.boite.tourner, daemon=True)
        self.fil.start()
        self.env = {"SOZO_EMAIL_MODE": "smtp", "SOZO_SMTP_HOST": "localhost", "SOZO_SMTP_TLS": "aucun",
                    "SOZO_SMTP_PORT": str(self.boite.socket.getsockname()[1]), "SOZO_EMAIL_FROM": "expediteur@exemple.cd"}
        os.environ.update(self.env)

    def tearDown(self):
        for k in self.env:
            os.environ.pop(k, None)
        self.boite.actif = False
        self.fil.join(2)
        self.boite.close()

    def ranger(self, dest, sensible=False, **k):
        cx = db.connecter(globale=True)
        try:
            mailer.preparer(cx, dest, "Sujet <test>", "Texte du code 123456", "<p>html</p>", sensible=sensible, **k)
            cx.valider()
            return cx.un("SELECT MAX(id) AS m FROM envois")["m"]
        finally:
            cx.fermer()

    def attendre(self, n):
        fin = time.time() + 5
        while len(self.boite.recus) < n and time.time() < fin:
            time.sleep(0.05)

    def test_smtp_reel_avec_adresse_de_contact(self):
        i = self.ranger("lecteur@exemple.cd")
        self.assertEqual(envois.distribuer(ids=[i])["envoyes"], 1)
        self.attendre(1)
        m = self.boite.recus[0]
        self.assertEqual(m["Reply-To"], config.email_contact())
        self.assertEqual(config.email_contact(), "mudeyimusimwa@gmail.com")      # coordonnées du propriétaire
        self.assertIn("multipart/alternative", m.get_content_type())             # texte ET html
        self.assertEqual(lire("SELECT etat FROM envois WHERE id = ?", (i,))[0]["etat"], "envoye")

    def test_code_efface_apres_envoi(self):
        i = self.ranger("lecteur@exemple.cd", sensible=True)
        envois.distribuer(ids=[i])
        e = lire("SELECT texte, html FROM envois WHERE id = ?", (i,))[0]
        self.assertNotIn("123456", e["texte"]); self.assertIsNone(e["html"])

    def test_deux_expediteurs_un_seul_envoi(self):
        i = self.ranger("lecteur@exemple.cd")
        t = [threading.Thread(target=envois.distribuer, kwargs={"ids": [i]}) for _ in range(4)]
        [x.start() for x in t]; [x.join() for x in t]
        self.attendre(1); time.sleep(0.3)
        self.assertEqual(len(self.boite.recus), 1)

    def test_panne_puis_reprise_puis_abandon(self):
        os.environ["SOZO_EMAIL_MODE"] = "fail"
        i = self.ranger("lecteur@exemple.cd")
        self.assertEqual(envois.distribuer(ids=[i])["echecs"], 1)
        e = lire("SELECT etat, essais, prochain_essai FROM envois WHERE id = ?", (i,))[0]
        self.assertEqual((e["etat"], e["essais"]), ("attente", 1))
        self.assertEqual(envois.distribuer(ids=[i])["echecs"], 0)                 # pas avant l'heure du nouvel essai
        cx = db.connecter(globale=True)
        try:
            for _ in range(4):
                cx.execute("UPDATE envois SET prochain_essai = '2000-01-01T00:00:00Z' WHERE id = ?", (i,)); cx.valider()
                envois.distribuer(ids=[i])
        finally:
            cx.fermer()
        self.assertEqual(lire("SELECT etat FROM envois WHERE id = ?", (i,))[0]["etat"], "abandonne")

    def test_capture_ne_part_jamais(self):
        os.environ["SOZO_EMAIL_MODE"] = "capture"
        i = self.ranger("lecteur@exemple.cd")
        self.assertEqual(envois.distribuer(ids=[i])["envoyes"], 0)
        time.sleep(0.2)
        self.assertEqual(self.boite.recus, [])

    def test_adresse_technique_jamais_ecrite(self):
        self.assertIsNone(self.ranger("supprime-3@sozo.invalid") and None)
        self.assertEqual(lire("SELECT COUNT(*) AS n FROM envois WHERE destinataire LIKE '%.invalid'")[0]["n"], 0)

    def test_smtp_en_clair_refuse_hors_local(self):
        os.environ["SOZO_SMTP_HOST"] = "smtp.gmail.com"
        with self.assertRaises(RuntimeError):
            config.smtp()

    def test_nom_hostile_echappe_dans_le_html(self):
        import gabarits
        h, t = gabarits.page("Bonjour", ["<script>alert(1)</script>"])
        self.assertNotIn("<script>", h)
        self.assertIn("<script>", t)                                              # le texte brut reste du texte
