#!/bin/sh
# Sōzō — prépare `dist/`, le SEUL dossier que Cloudflare publie.
#
# LISTE BLANCHE, pas liste d'exclusions : le dépôt contient backend/,
# REPRISE.md, les comptes d'essai locaux… Publier la racine en « excluant ce
# qui ne doit pas sortir » échoue le jour où quelqu'un ajoute un fichier. On
# copie exactement ce que Flask sert (backend/app.py : FICHIERS_RACINE,
# DOSSIERS_PUBLICS, EXTENSIONS) — et rien d'autre.
set -eu
cd "$(dirname "$0")/.."
rm -rf dist
mkdir -p dist
for f in index.html favicon.svg styles.css sozo.css sozo.js app.js content.js; do
  cp "$f" dist/
done
for d in app assets images illustrations admin; do
  find "$d" -type f \( -name '*.html' -o -name '*.css' -o -name '*.js' -o -name '*.json' -o -name '*.txt' \
    -o -name '*.svg' -o -name '*.jpg' -o -name '*.jpeg' -o -name '*.png' -o -name '*.webp' -o -name '*.woff2' -o -name '*.ico' \) \
    ! -path '*/.*' | while read -r f; do
      mkdir -p "dist/$(dirname "$f")"
      cp "$f" "dist/$f"
    done
done
echo "dist/ prêt : $(find dist -type f | wc -l | tr -d ' ') fichiers"
