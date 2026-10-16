#!/bin/bash
# Balaye les paliers et dresse le tableau. Usage : tools/k6/paliers.sh "25 50 100 200 300 400" 60s etiquette
cd "$(dirname "$0")"
PALIERS=${1:-"25 50 100 200 300 400"}; DUREE=${2:-60s}; ETQ=${3:-base}
mkdir -p resultats
for P in $PALIERS; do
  echo "== palier $P ($DUREE)"
  ( while true; do ps -A -o %cpu,command | grep -E "gunicorn.*wsgi:app" | grep -v grep | awk '{s+=$1} END {print s}'; sleep 2; done ) > resultats/cpu-$ETQ-$P.txt &
  ECH=$!
  k6 run --quiet -e PALIER=$P -e DUREE=$DUREE -e DECALAGE=$(( (P * 7 + RANDOM) % 400 )) --summary-export resultats/$ETQ-$P.json charge.js > resultats/$ETQ-$P.log 2>&1
  kill $ECH 2>/dev/null
  sleep 5
done
python3 tableau.py $ETQ $PALIERS
