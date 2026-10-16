"""Sauvegarder et restaurer Sōzō (voir backend/sauvegarde.py).

    backend_venv/bin/python backend/tools/sauvegarde.py cle                       # une clé neuve (à garder HORS du serveur)
    backend_venv/bin/python backend/tools/sauvegarde.py exporter sozo-AAAA-MM-JJ.sauv
    backend_venv/bin/python backend/tools/sauvegarde.py verifier sozo-AAAA-MM-JJ.sauv
    backend_venv/bin/python backend/tools/sauvegarde.py restaurer sozo-AAAA-MM-JJ.sauv   # base cible VIDE

La clé vient de SOZO_CLE_SAUVEGARDE. La base vient des réglages habituels
(SOZO_DB_BACKEND, SOZO_DATABASE_URL, SOZO_PG_SCHEMA, SOZO_DB_PATH).
--sans-chiffrement : seulement pour une base locale de développement.
"""
import json
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import sauvegarde  # noqa: E402


def main(a):
    if not a or a[0] not in ("cle", "exporter", "verifier", "restaurer"):
        sys.exit(__doc__)
    try:
        if a[0] == "cle":
            print("SOZO_CLE_SAUVEGARDE=" + sauvegarde.nouvelle_cle() + "   # [SECRET] — à garder AUSSI hors du serveur, sinon un sinistre l'emporte avec lui")
        elif a[0] == "exporter":
            print(json.dumps(sauvegarde.exporter(a[1], sans_chiffrement="--sans-chiffrement" in a), ensure_ascii=False))
        elif a[0] == "verifier":
            d = sauvegarde.lire(a[1])
            print(json.dumps({"ok": True, "version_schema": d["version_schema"], "cree_le": d["cree_le"],
                              "lignes": {t: x["n"] for t, x in d["tables"].items()}, "fichiers": len(d["fichiers"])}, ensure_ascii=False))
        else:
            r = sauvegarde.restaurer(a[1])
            print(json.dumps(r, ensure_ascii=False))
            sys.exit(0 if r["ok"] else 1)
    except sauvegarde.Refus as e:
        sys.exit(f"REFUS : {e}")


if __name__ == "__main__":
    main(sys.argv[1:])
