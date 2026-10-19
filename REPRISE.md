# REPRISE — Sōzō (état au 18/10/2026)

À lire en entier avant de toucher au code. Puis lire `README.md` (lancement, tests, garanties, architecture).

## 0. En ligne depuis le 16/10/2026

| | |
|---|---|
| Site (pages + relais /api) | https://sozo.mudeyimusimwa.workers.dev — Worker Cloudflare `sozo`, build `sh cloudflare/construire.sh`, redéployé à chaque push |
| Serveur (API) | https://sozo-api.onrender.com — Render `sozo-api` (srv-db9a7kvbtjjs73av7mi0), Francfort, offre GRATUITE (0,1 CPU, veille après 15 min). Dépôt public : **Manual Deploy après chaque push backend** |
| Base | Supabase, organisation « Sozo » (gratuite), projet `sozo` (dcbbvcvnpdllxjyefzln), Francfort, Data API coupé, pooler MODE SESSION (5432) |
| Rôle | `sozo_app` NOLOGIN NOBYPASSRLS, accordé à `postgres` (qui, lui, a BYPASSRLS — vérifié). Le serveur refuse de démarrer sans lui |
| Secrets | `SOZO_DATABASE_URL` (Render, saisi par le propriétaire) ; `SOZO_SECRET_PROXY` (généré par Render, recopié en Secret dans le Worker) |

Vérifié en ligne le 16/10 : 26/26 contrôles de bout en bout (lecture protégée, brouillon, isolation des achats, CSRF, corps non-JSON, session inventée, administration, limite anti-abus) ; IP réelle du visiteur reçue par le serveur (secret partagé effectif). Comptes d'essai supprimés, livre d'essai retiré.

Ajouts du 17/10/2026 (déployés) :
- compte d'administration du propriétaire créé (`backend/tools/admin_en_ligne.py`, adresse de la base collée au clavier) ; console à `/admin/` ;
- audit de l'administration sur une copie conforme de la production (PostgreSQL + RLS + pooler transaction + gunicorn + secret du relais) : 30/30 (rôles, CSRF, TOTP à usage unique, réauthentification, audit immuable, désactivation) ;
- thème nocturne par défaut, clair au choix dans Mon compte (users.theme), plus de bouton sur la landing ni dans la barre ;
- API joignable seulement par le Worker (403 en direct, sauf /api/sante) ; livres d'un auteur supprimé retirés ;
- import : 40 Mo décompressés au plus (pic mesuré ~170 Mo au lieu de 300) ;
- notifications d'appareil ACTIVES : `SOZO_VAPID_AUTO=1` sur Render, paire générée par le serveur et gardée dans `reglages` (ne pas la supprimer : tous les téléphones devraient se réinscrire).

Pas encore actif en ligne : e-mails (mot de passe d'application Gmail → `SOZO_EMAIL_MODE=smtp` + `SOZO_SMTP_PASSWORD`), sauvegardes chiffrées hors site (clé + lieu de stockage à choisir par le propriétaire), paiements (numéros Mobile Money `SOZO_PAIEMENT_NUMEROS`), nom de domaine.
Limite connue de l'offre gratuite Render : un PDF de 2 000 pages prend ~13 s sur un Mac ; sur 0,1 CPU il peut dépasser les 30 s de l'analyse et être refusé (« a pris trop de temps »).

Ajouts du 17-18/10/2026 (déployés, commit b29e2e5) :
- bandeau « VERSION D'ESSAI », mentions « fictifs » / « démonstration » retirés de l'application (demande du propriétaire) ;
- Découvrir plantait sur un catalogue VIDE (« Sōzō n'a pas pu se charger ») : corrigé, états vides partout, vérifié en ligne et sur toutes les pages ;
- serveur gratuit en veille : catalogue et /api/moi réessayés ~70 s avec « Sōzō se réveille… ».

## ⏭ Où on s'est arrêté — À FAIRE EN PREMIER

1. **Catalogue en ligne : décision A (18/10/2026), « des livres de religion, d'inspiration, de Dieu et de foi, dans le christianisme ».** **Chargé EN LIGNE le 19/10/2026** (Render redéployé avant, sur 05b1cab ; chargement ~7 min depuis Kinshasa). Vérifié en ligne : 14 livres / 12 auteurs au catalogue, tous `demo` ; page gratuite servie ; achat d'une page payante refusé (400 « Ce livre est un exemple : il ne se vend pas. »).
   - `backend/tools/demo_catalogue.py` écrit `demo.json` : 12 auteurs et 14 livres chrétiens INVENTÉS (méditations, prière, poésie de louange, romans, jeunesse, essai, biographie de Paul…). Les versets sont lus dans la Bible LSG 1910 intégrée, jamais recopiés à la main. Nawezi N. n'y est plus : auteur réel, il publie ses vrais livres lui-même ;
   - étiquette « Exemple » sur chaque couverture et sur la fiche (`ui.js` `cv-exemple`, `livre.js`) ; une page payante d'un livre d'exemple l'explique au lieu de proposer l'achat (`lire.js`) ;
   - **un livre d'exemple ne se vend pas** : refus du serveur (`argent._calculer`), test `test_livre_d_exemple_jamais_vendu`, vu tomber sans le correctif ;
   - `demo.py --en-ligne --projet <ref>` : adresse collée au clavier, puis taper EXEMPLE.
   Pour recommencer ailleurs : pousser, Manual Deploy de Render (le refus de vente doit être en ligne AVANT les livres), puis `demo.py --en-ligne`. La base de développement locale garde l'ancien catalogue (les comptes d'essai y ont des achats) : pour voir le nouveau, charger une base neuve (`SOZO_DB_PATH=…`).
   Les tuiles « Polar » et « Manga » de Découvrir resteront vides avec ce catalogue (apparence : à soumettre au propriétaire).
2. **« Accès à toutes les fonctionnalités »** : seuls les achats (pages, Plume) sont fermés, faute de numéros Mobile Money. Question posée : (1) il donne ses numéros → `SOZO_PAIEMENT_NUMEROS` sur Render, il achète puis confirme lui-même dans l'admin ; ou (2) ajouter dans l'admin « offrir Plume / offrir un livre » (avec audit).
3. Le propriétaire teste le logiciel ce week-end : traiter ses retours en priorité.

## 1. Le projet
- **Sōzō** : plateforme de lecture et de publication page par page, pour un ami du propriétaire (l'auteur Nawezi N., « Nard »). Les livres sont gratuits, payants ou mixtes, avec parutions programmées, Bible intégrée (LSG 1910), correcteur du français, atelier d'auteur, paiement Mobile Money et administration.
- **Propriétaire** : il vit à Kinshasa et parle français. Il juge le résultat et veut un logiciel complet et solide. Il dit « go go go » pour avancer.
- **Dossier** : `/Users/macbookpro/sozo`. Git branche `main`, remote `git@github.com:Yversplayer/sozo.git`. Dépôt public sur GitHub : https://github.com/Yversplayer/sozo.
- **Pile** :
  - JS natif sans compilation, CSP stricte (`script-src 'self'`), polices hébergées dans `assets/fonts` ;
  - Flask 3.1, SQLite en développement, PostgreSQL 16 en production (prévu : Supabase + Render + Cloudflare, comme Klassio) ;
  - Python 3.9, environnement `backend_venv`.
- La sécurité s'inspire de Klassio (`INSPIRATION_SECURITE_BACKEND.md` du dépôt klassio-saas).

## 2. Décisions du propriétaire (ne pas rouvrir)
- **Identité visuelle** : bordeaux #6B0F1A, blanc cassé #F8F5EB, or #D4AF37. Logo « Sōzō » en serif avec une plume dorée. Devise « Heal your heart · Grown your faith · Glow your spirit » (le « Grown » est probablement une faute de frappe : il reste tel quel, signalé). « Plus qu'une application, un chemin. »
- **La landing (`index.html`, `styles.css`, `sozo.css`, `sozo.js`, `content.js`, `app.js`) est FIGÉE.** On n'y touche pas.
- **Le recueil « Sōzō » de Nawezi N. est PERSONNEL** : jamais dans le catalogue, jamais cité.
- Il faut un compte pour entrer dans le logiciel. Les livres de la landing servent de vitrine.
- Web d'abord (SaaS), pas d'application native pour l'instant.
- Le propriétaire veut être consulté sur ce qui change l'apparence. Il a laissé « libre arbitre » pour le reste.
- **Décisions prises le 16/10, modifiables sur sa demande** :
  - un remboursement retire le droit de lecture ;
  - un achat non payé expire après 48 h ;
  - les frais du prestataire sont à la charge de Sōzō ;
  - pas de portefeuille de crédits ;
  - trois rôles d'administration (`lecture`, `finance`, `moderation`).
- Tarifs proposés, **non confirmés par le propriétaire** : commission de 15 % (10 % avec Plume), Plume à 4,99 $ pour 30 jours, reversement minimum de 1 $.

## 3. Ce qui fonctionne (testé)
**Tests** : 155 sur SQLite (7 réservés à PostgreSQL y sont sautés) et 155 sur PostgreSQL (RLS active), tous verts au 18/10/2026. Chaque garde-fou a été vu tomber quand on retire le code qui le porte.
```bash
cd /Users/macbookpro/sozo && backend_venv/bin/python -m unittest discover -s backend/tests -t backend
cd /Users/macbookpro/sozo && backend_venv/bin/python backend/tools/pg_tests.py
```

- **Comptes** :
  - inscription, connexion, mot de passe oublié ;
  - « Mon compte » (`app/compte.html`) : profil, achats et reçus, changement de mot de passe, suppression du compte ;
  - sessions en cookie HttpOnly, jeton CSRF, limitation du nombre d'essais.
- **Lecture** :
  - `acces.py` est la seule source de vérité : 402 pour une page fermée, 403 + date pour une page à venir, 404 pour un brouillon ou le livre d'un autre ;
  - filigrane nominatif et marque invisible sur les pages achetées ;
  - un balayage de toutes les routes paramétrées (`test_lecture.Balayage`) : **toute nouvelle route paramétrée doit y être ajoutée**.
- **Studio** (`app/studio.js` + `app/atelier.css`, préfixe `at-`) :
  - atelier 3D personnalisé : ambiance, photo, nom, phrase ; étagère 3D avec feuilletage ;
  - livres : pages, actions groupées, import PDF/EPUB/DOCX → brouillons, réglages, chapitres, calendrier, revenus, reversements, Plume.
- **Éditeur** (`app/ecrire.js`) :
  - enregistrement sur le serveur avec versions et copie de secours locale ;
  - détection des conflits entre onglets (`version_attendue`, réponse 409) ;
  - aperçu lecteur ; page publiée en lecture seule sans Plume ; rappel dans l'atelier quand Plume finit dans moins de 5 jours ;
  - correcteur dans un Web Worker (`app/langue/`).
- **Argent** (`backend/argent.py`) :
  - le lecteur paie par Mobile Money, déclare sa référence, et un administrateur confirme ;
  - prix calculé par le serveur ; idempotence ; confirmation atomique (droit + reçu `SZ-AAAA-NNNNNN` + registre) ;
  - une référence ne paie qu'un achat ; expiration à 48 h ;
  - notification de prestataire signée, avec montant et devise vérifiés ;
  - frais au registre ; remboursement par lignes correctrices.
- **Prestataires** (`backend/prestataires.py`) : le contrat des futurs agrégateurs, plus un **simulateur réservé au mode test** (`POST /api/paiements/<id>/simulation`).
- **E-mails** (`mailer.py`, `envois.py`, `gabarits.py`) : file transactionnelle, reprises, Gmail SMTP ou Brevo. Contact et réponse : mudeyimusimwa@gmail.com.
- **Mot de passe** : code à 6 chiffres (15 min, 5 essais, usage unique) pour l'oubli et pour le changement (avec le mot de passe actuel).
- **Notifications** : cloche, appareil (Web Push, `app/sw.js`, clés VAPID) et e-mail selon les préférences (Mon compte → Notifications). Tâches périodiques : `taches.py`, `tools/taches.py`.
- **Plume** : carte de membre dorée en 3D et comparaison animée (`app/plume.css`, `S.buy.plume`).
- **Sauvegardes** : `tools/sauvegarde.py`. Restauration exercée sur SQLite et PostgreSQL le 16/10.
- **Manuscrits d'origine** : effacés 90 jours après l'import ou à la suppression du compte (`manuscrits.py`).
- **Administration** (`admin/`) :
  - comptes séparés, créés uniquement en ligne de commande ;
  - mot de passe + TOTP à usage unique ; rôles ; code frais (moins de 10 min) pour rembourser, verser de l'argent ou désactiver un compte ;
  - paiements, reversements, livres, signalements, utilisateurs, journal d'audit inaltérable.
  - Commandes : `backend/tools/admin.py creer|roles|reinitialiser-totp|desactiver`.

## 4. Ce qui n'est PAS fait — ne jamais le présenter comme fait
- **Aucun agrégateur Mobile Money réel.** Plume n'est pas un abonnement récurrent.
- **Les e-mails sont prêts mais en mode capture** : il faut le « mot de passe d'application » Gmail du propriétaire (`SOZO_SMTP_PASSWORD`) pour qu'ils partent. SMS et WhatsApp : aucun fournisseur.
- **Déployé le 16/10/2026** (§0). La restauration a été exercée en local (SQLite et PostgreSQL), pas sur une base de production. La planification des sauvegardes et le stockage hors site restent à mettre en place.
- **Notifications d'appareil** : chiffrement vérifié par un test, mais jamais reçues sur un vrai téléphone (le navigateur intégré les bloque). À essayer sur un téléphone après le déploiement (HTTPS obligatoire).
- Réorganisation des pages limitée aux brouillons placés APRÈS la dernière page sortie (`/pages/ordre`) : les droits d'achat sont liés aux numéros, une page sortie ne bouge jamais.
- **Pour le bas de page et la mise en ligne, il manque les informations du propriétaire** : éditeur légal (nom, adresse, RCCM), numéros Mobile Money par opérateur, nom de domaine, réseaux sociaux, textes légaux (CGU, confidentialité), e-mail de l'administrateur.

## 5. Environnement local
- **Aperçu** : entrée « sozo » dans `/Users/macbookpro/klassio-saas/.claude/launch.json`, sur le port 4385, avec `SOZO_MODE_TEST=1`. **Relancer le serveur après toute modification du code Python** : il ne se recharge pas tout seul.
- **Comptes d'essai locaux** (lecteur, auteur, admin avec son secret TOTP) : `backend/stockage/comptes-essai.json`. Clés VAPID de développement : `backend/stockage/vapid.json` (lues seulement avec `SOZO_VAPID_DEV=1`). Ce dossier est ignoré par git ; ne jamais recopier ces valeurs ailleurs.
- **Base de développement** : `backend/sozo.db`, avec les données de démonstration de `backend/tools/demo.py`.
- **Cache du navigateur** : les pages appellent `fichier.js?v=N`. Si tu modifies un fichier, **incrémente le numéro de version dans les pages qui l'appellent**.

## 6. Règles de travail
- **Ne jamais affaiblir ni supprimer un test.** Tout nouveau garde-fou doit être vu échouer quand on retire son code, puis restauré.
- **Les deux suites doivent être vertes avant de rendre la main.**
- **Migrations additives uniquement** (`db._migrer`, `VERSION_SCHEMA = 5`). Pour toute table qui contient des données d'un utilisateur, ajouter sa règle dans `db.RLS`.
- **Aucun faux succès à l'écran** : l'interface ne change qu'après la réponse du serveur. Tout texte venant de la base passe par `S.esc()`.
- **Commits successifs**, avec une ligne `Co-Authored-By` en fin de message. Ne pousser que si le propriétaire le demande et une fois le dépôt créé. Vérifier l'absence de secrets avant.
- **Fin de chaque rapport** : 🔴 BLOQUANTS / 🟠 NON-BLOQUANTS / 🟢 BACKLOG / 🚦 DÉCISION.
