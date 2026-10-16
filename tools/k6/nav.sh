#!/bin/bash
# Un passage navigateur par profil réseau. Usage : tools/k6/nav.sh ETIQUETTE BASE "bon 3g 2g" INDEX_LECTEUR
cd "$(dirname "$0")"; ETQ=$1; BASE=$2; PROFILS=${3:-"bon 3g 3g-lente 2g"}; L=${4:-0}
for P in $PROFILS; do
  case $P in bon) L=30;; 3g) L=31;; 3g-lente) L=32;; 2g) L=33;; esac    # même lecteur, même livre, avant comme après
  K6_BROWSER_EXECUTABLE_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" K6_BROWSER_HEADLESS=true \
    k6 run -q -e BASE=$BASE -e PROFIL=$P -e ETQ=$ETQ -e LECTEUR=$L navigateur.js 2>&1 | grep -o 'RELEVE {.*}' | sed 's/^RELEVE //; s/\\"/"/g' > resultats/nav-$ETQ-$P.jsonl
done
