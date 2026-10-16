"""Le canal e-mail : comment un message quitte le serveur.

`preparer()` RANGE un e-mail dans la file `envois`, dans la transaction de
l'action qui le cause : si l'action est annulée, le message n'existe pas.
`envois.distribuer()` l'expédie APRÈS la validation, avec nouvelles
tentatives. Ce module ne décide pas QUI prévenir (notifications.py).

Modes (SOZO_EMAIL_MODE) :
  capture  défaut — rien ne part ; le message reste lisible dans la file
           (et dans /api/dev/boite en mode test). L'interface ne dit jamais
           « envoyé » pour un message capturé.
  smtp     un serveur SMTP chiffré. Pour démarrer : le Gmail du propriétaire
           avec un « mot de passe d'application » (500 messages par jour).
  brevo    l'API Brevo, quand un domaine sera vérifié (SPF/DKIM).
  fail     panne simulée : sert aux tests de reprise.

Aucun secret n'est écrit, journalisé ni renvoyé par une API.
"""
import json
import smtplib
import ssl
import urllib.error
import urllib.request
from email.message import EmailMessage
from email.utils import formataddr, formatdate, make_msgid

import config
from validation import maintenant

DELAI = 15


class Echec(Exception):
    """`temporaire` : un nouvel essai a une chance (réseau, quota) ; sinon
    (adresse refusée, configuration absente) on abandonne sans insister."""

    def __init__(self, message, temporaire=True):
        super().__init__(message)
        self.temporaire = temporaire


def adresse_utilisable(email):
    # Les comptes supprimés reçoivent une adresse technique qui n'existe pas :
    # y écrire ferait rebondir le message et abîmerait la réputation d'envoi.
    return bool(email) and "@" in email and not email.endswith(".invalid")


def preparer(cx, destinataire, sujet, texte, html=None, *, user_id=None, lien=None, sensible=False):
    """Range un e-mail dans la file. Rend l'état : 'capture' ou 'attente'."""
    if not adresse_utilisable(destinataire):
        return None
    etat = "capture" if config.email_mode() == "capture" else "attente"
    cx.execute("""INSERT INTO envois (canal, user_id, destinataire, sujet, texte, html, lien, sensible, etat, prochain_essai, created_at)
                  VALUES ('email', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
               (user_id, destinataire, sujet, texte, html, lien, 1 if sensible else 0, etat, maintenant(), maintenant()))
    return etat


def _message(dest, sujet, texte, html):
    m = EmailMessage()
    m["From"] = formataddr(("Sōzō", config.email_expediteur()))
    m["To"] = dest
    m["Reply-To"] = config.email_contact()
    m["Subject"] = sujet
    m["Date"] = formatdate(localtime=False)
    m["Message-ID"] = make_msgid(domain=config.email_expediteur().split("@")[-1])
    m.set_content(texte)
    if html:
        m.add_alternative(html, subtype="html")
    return m


def _smtp(dest, sujet, texte, html):
    c = config.smtp()
    if not c["mot_de_passe"] and c["tls"] != "aucun":
        raise Echec("SOZO_SMTP_PASSWORD absent.", temporaire=False)
    try:
        if c["tls"] == "ssl":
            s = smtplib.SMTP_SSL(c["hote"], c["port"], timeout=DELAI, context=ssl.create_default_context())
        else:
            s = smtplib.SMTP(c["hote"], c["port"], timeout=DELAI)
            if c["tls"] == "starttls":
                s.starttls(context=ssl.create_default_context())
        with s:
            if c["mot_de_passe"]:
                s.login(c["utilisateur"], c["mot_de_passe"])
            s.send_message(_message(dest, sujet, texte, html))
    except smtplib.SMTPRecipientsRefused:
        raise Echec("Adresse refusée par le serveur.", temporaire=False)
    except smtplib.SMTPAuthenticationError:
        raise Echec("Identifiants SMTP refusés.", temporaire=False)
    except (smtplib.SMTPException, OSError) as e:
        raise Echec(f"SMTP indisponible : {type(e).__name__}")


def _brevo(dest, sujet, texte, html):
    cle = config.brevo_cle()
    if not cle:
        raise Echec("SOZO_BREVO_API_KEY absente.", temporaire=False)
    corps = {"sender": {"name": "Sōzō", "email": config.email_expediteur()}, "to": [{"email": dest}],
             "replyTo": {"email": config.email_contact()}, "subject": sujet, "textContent": texte}
    if html:
        corps["htmlContent"] = html
    req = urllib.request.Request("https://api.brevo.com/v3/smtp/email", data=json.dumps(corps).encode(), method="POST",
                                 headers={"api-key": cle, "Content-Type": "application/json", "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=DELAI) as r:
            if r.status >= 300:
                raise Echec(f"Brevo {r.status}")
    except urllib.error.HTTPError as e:
        raise Echec(f"Brevo {e.code}", temporaire=e.code >= 500 or e.code == 429)
    except (urllib.error.URLError, OSError) as e:
        raise Echec(f"Brevo injoignable : {type(e).__name__}")


def expedier(dest, sujet, texte, html):
    """Expédie réellement. Lève Echec en cas de problème."""
    mode = config.email_mode()
    if mode == "fail":
        raise Echec("Panne simulée (SOZO_EMAIL_MODE=fail).")
    if mode == "smtp":
        return _smtp(dest, sujet, texte, html)
    if mode == "brevo":
        return _brevo(dest, sujet, texte, html)
    raise Echec("Mode capture : rien ne part.", temporaire=False)
