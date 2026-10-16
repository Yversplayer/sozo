"""Clés VAPID des notifications d'appareil (Web Push).

    backend_venv/bin/python backend/tools/vapid.py            # affiche les deux lignes à saisir dans l'hébergeur
    backend_venv/bin/python backend/tools/vapid.py --dev      # les range dans backend/stockage/vapid.json (poste local, mode test)

La clé PRIVÉE est un secret : elle signe chaque notification. Si elle change,
tous les appareils inscrits doivent se réinscrire (ils le font d'eux-mêmes à
la visite suivante de Mon compte).
"""
import base64
import json
import os
import sys

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec


def _b64(o):
    return base64.urlsafe_b64encode(o).rstrip(b"=").decode()


def generer():
    k = ec.generate_private_key(ec.SECP256R1())
    prive = _b64(k.private_numbers().private_value.to_bytes(32, "big"))
    public = _b64(k.public_key().public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint))
    return prive, public


if __name__ == "__main__":
    prive, public = generer()
    if "--dev" in sys.argv:
        dossier = os.path.join(os.path.dirname(__file__), "..", "stockage")
        os.makedirs(dossier, exist_ok=True)
        with open(os.path.join(dossier, "vapid.json"), "w") as f:
            json.dump({"prive": prive, "public": public}, f)
        print("Clés de développement rangées dans backend/stockage/vapid.json (jamais versionné).")
    else:
        print("SOZO_VAPID_PUBLIC=" + public)
        print("SOZO_VAPID_PRIVE=" + prive + "   # [SECRET]")
