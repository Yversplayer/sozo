"""Le canal « appareil » : notifications Web Push (RFC 8030, chiffrement
RFC 8291, identification VAPID RFC 8292), par la bibliothèque pywebpush.

Le contenu est chiffré pour l'appareil : le service de notification (Google,
Mozilla, Apple) le transporte sans pouvoir le lire. Un abonnement que le
service déclare mort (404/410 : application désinstallée, permission retirée)
est supprimé ; on n'insiste pas.
"""
import json

import config
import db
from mailer import Echec
from notifications import service_autorise


def expedier(e):
    v = config.vapid()
    if not (v["prive"] and v["public"]):
        raise Echec("Clés VAPID absentes.", temporaire=False)
    cx = db.connecter(globale=True)
    try:
        a = cx.un("SELECT * FROM appareils WHERE id = ?", (int(e["destinataire"]),))
    finally:
        cx.fermer()
    if not a:
        raise Echec("Appareil retiré.", temporaire=False)
    if not service_autorise(a["endpoint"]):          # garde redoublée : jamais d'envoi hors des services connus
        raise Echec("Service de notification refusé.", temporaire=False)
    from pywebpush import WebPushException, webpush
    donnees = json.dumps({"titre": e["sujet"], "corps": e["texte"], "lien": e["lien"] or "/app/decouvrir.html", "id": e["id"]})
    try:
        webpush({"endpoint": a["endpoint"], "keys": {"p256dh": a["p256dh"], "auth": a["auth"]}}, data=donnees,
                vapid_private_key=v["prive"], vapid_claims={"sub": v["contact"]}, ttl=24 * 3600, timeout=10)
    except WebPushException as err:
        code = getattr(getattr(err, "response", None), "status_code", None)
        if code in (404, 410):
            cx = db.connecter(globale=True)
            try:
                cx.execute("DELETE FROM appareils WHERE id = ?", (a["id"],))
                cx.valider()
            finally:
                cx.fermer()
            raise Echec("Abonnement expiré : appareil retiré.", temporaire=False)
        raise Echec(f"Service de notification : {code or 'injoignable'}", temporaire=code is None or code >= 500 or code == 429)
    except Exception as err:                           # noqa: BLE001 — réseau, délai
        raise Echec(f"Notification non remise : {type(err).__name__}")
    cx = db.connecter(globale=True)
    try:
        cx.execute("UPDATE appareils SET dernier_succes = ? WHERE id = ?", (e["created_at"], a["id"]))
        cx.valider()
    finally:
        cx.fermer()
