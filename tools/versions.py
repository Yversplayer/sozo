"""Versions des fichiers dans les pages (21/10/2026).

Les pages appellent `fichier.js?v=…` : le navigateur garde l'ancien fichier
tant que ce numéro ne change pas. Oublier de l'incrémenter, c'est livrer une
correction que personne ne voit. Ce script pose, pour chaque feuille de style
et chaque script local, une version tirée de son CONTENU : elle change
exactement quand le fichier change.

    python3 tools/versions.py
"""
import hashlib
import os
import re
import sys

RACINE = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
PAGES = [os.path.join(d, f) for d in (RACINE, os.path.join(RACINE, "app"), os.path.join(RACINE, "admin"))
         for f in os.listdir(d) if f.endswith(".html")]
LIEN = re.compile(r'((?:src|href)=")([^"?#]+\.(?:js|css))\?v=[^"]*(")')


def empreinte(chemin):
    with open(chemin, "rb") as h:
        return hashlib.sha256(h.read()).hexdigest()[:8]


def main():
    changees = 0
    for page in PAGES:
        with open(page, encoding="utf-8") as h:
            s = h.read()

        def poser(m):
            cible = os.path.normpath(os.path.join(os.path.dirname(page), m.group(2)))
            if not os.path.isfile(cible):
                return m.group(0)
            return f"{m.group(1)}{m.group(2)}?v={empreinte(cible)}{m.group(3)}"
        neuf = LIEN.sub(poser, s)
        if neuf != s:
            with open(page, "w", encoding="utf-8") as h:
                h.write(neuf)
            changees += 1
    print(f"{changees} page(s) mises à jour")


if __name__ == "__main__":
    sys.exit(main())
