# Tests de charge et de réseau lent (k6)

Ne montez pas en charge si la fumée échoue : vous mesureriez la vitesse d'une panne.

## Préparer (base JETABLE, jamais la base de développement)

```bash
# PostgreSQL 16 local + rôle applicatif sans BYPASSRLS, schéma « charge »
SOZO_DB_BACKEND=postgres SOZO_DATABASE_URL=… SOZO_PG_SCHEMA=charge SOZO_PG_ROLE=sozo_app \
  backend_venv/bin/python backend/tools/seed_charge.py --lecteurs 400 --auteurs 20 --base-url http://127.0.0.1:5085
# Serveur comme en production ; le secret de proxy donne à chaque utilisateur virtuel SA propre IP
cd backend && SOZO_…(mêmes variables) SOZO_SECRET_PROXY=charge-proxy-secret \
  ../backend_venv/bin/gunicorn -w 3 -k gthread --threads 4 -b 127.0.0.1:5085 wsgi:app
```

## Scénarios

| Script | Ce qu'il prouve |
|---|---|
| `fumee.js` | les bonnes données : page gratuite lisible, payante fermée (402) sans texte, achetée lisible avec filigrane, à venir fermée (403), catalogue sans texte, atelier d'autrui en 404 |
| `charge.js` | `-e PALIER=N` utilisateurs simultanés (90 % lecteurs, 10 % auteurs) + un flux continu de connexions |
| `paliers.sh` | balaye les paliers et dresse le tableau (`tableau.py`) |
| `navigateur.js` / `nav.sh` | un VRAI Chrome bridé (bon, 3G, 3G lente, 2G) : temps jusqu'au contenu utile et données téléchargées |

## Résultats du 16/10/2026 (MacBook 4 cœurs, serveur et générateur sur la même machine)

**Charge — 95 % des requêtes servies en moins de :**

| Utilisateurs simultanés | Avant | Après |
|---|---|---|
| 25 | 1,7 s | 0,13 s |
| 50 | 4,1 s | 0,70 s |
| 100 | 9,9 s | 3,1 s |

Débit maximal : ~22 → ~53 requêtes/s. Zéro erreur serveur, zéro fuite de contenu protégé à tous les paliers.
Au-delà de ~100 utilisateurs SIMULTANÉMENT actifs, le processeur sature (3 processus).

**2G (~200 kbit/s, 800 ms) — tourner une page en lisant :** 13 s → 3,9 s, et 232 Ko → 11 Ko de forfait.
Parcours complet (connexion, Découvrir, livre, 2 pages, puis retour) : 145 s → 49 s, 2,5 Mo → 0,8 Mo.

Corrections qui ont produit ces gains : compression gzip, cache durable des fichiers versionnés,
catalogue sans connexion par auteur, vitrine publique en cache court (15 s), photos réduites
quand le téléphone annonce une connexion lente ou l'économie de données.
