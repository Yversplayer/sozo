# REPRISE — Sōzō (état au 16/10/2026)

À lire en entier avant de toucher au code. Puis lire `README.md` (lancement, tests, garanties, architecture).

## 1. Le projet
- **Sōzō** : plateforme de lecture et de publication page par page, pour un ami du propriétaire (l'auteur Nawezi N., « Nard »). Les livres sont gratuits, payants ou mixtes, avec parutions programmées, Bible intégrée (LSG 1910), correcteur du français, atelier d'auteur, paiement Mobile Money et administration.
- **Propriétaire** : il vit à Kinshasa et parle français. Il juge le résultat et veut un logiciel complet et solide. Il dit « go go go » pour avancer.
- **Dossier** : `/Users/macbookpro/sozo`. Git branche `main`, remote `git@github.com:Yversplayer/sozo.git`. **Le dépôt GitHub n'existe pas encore** : le propriétaire doit le créer (public, vide), puis on pousse. Rien n'a jamais été poussé.
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
**Tests** : 100 sur SQLite et 100 sur PostgreSQL (RLS active), tous verts. Chaque garde-fou a été vu tomber quand on retire le code qui le porte.
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
  - aperçu lecteur ; page publiée en lecture seule sans Plume ;
  - correcteur dans un Web Worker (`app/langue/`).
- **Argent** (`backend/argent.py`) :
  - le lecteur paie par Mobile Money, déclare sa référence, et un administrateur confirme ;
  - prix calculé par le serveur ; idempotence ; confirmation atomique (droit + reçu `SZ-AAAA-NNNNNN` + registre) ;
  - une référence ne paie qu'un achat ; expiration à 48 h ;
  - notification de prestataire signée, avec montant et devise vérifiés ;
  - frais au registre ; remboursement par lignes correctrices.
- **Prestataires** (`backend/prestataires.py`) : le contrat des futurs agrégateurs, plus un **simulateur réservé au mode test** (`POST /api/paiements/<id>/simulation`).
- **Administration** (`admin/`) :
  - comptes séparés, créés uniquement en ligne de commande ;
  - mot de passe + TOTP à usage unique ; rôles ; code frais (moins de 10 min) pour rembourser, verser de l'argent ou désactiver un compte ;
  - paiements, reversements, livres, signalements, utilisateurs, journal d'audit inaltérable.
  - Commandes : `backend/tools/admin.py creer|roles|reinitialiser-totp|desactiver`.

## 4. Ce qui n'est PAS fait — ne jamais le présenter comme fait
- **Aucun agrégateur Mobile Money réel.** Plume n'est pas un abonnement récurrent.
- **Les e-mails ne partent pas** (mode capture).
- **Jamais déployé.** Aucune sauvegarde n'a été restaurée.
- Pas de réorganisation des pages : les droits d'achat sont liés aux numéros de page.
- **Pour le bas de page et la mise en ligne, il manque les informations du propriétaire** : e-mail de contact, éditeur légal (nom, adresse, RCCM), numéros Mobile Money par opérateur, nom de domaine, réseaux sociaux, textes légaux (CGU, confidentialité), e-mail de l'administrateur.

## 5. Environnement local
- **Aperçu** : entrée « sozo » dans `/Users/macbookpro/klassio-saas/.claude/launch.json`, sur le port 4385, avec `SOZO_MODE_TEST=1`. **Relancer le serveur après toute modification du code Python** : il ne se recharge pas tout seul.
- **Comptes d'essai locaux** (lecteur, auteur, admin avec son secret TOTP) : `backend/stockage/comptes-essai.json`. Ce dossier est ignoré par git ; ne jamais recopier ces valeurs ailleurs.
- **Base de développement** : `backend/sozo.db`, avec les données de démonstration de `backend/tools/demo.py`.
- **Cache du navigateur** : les pages appellent `fichier.js?v=N`. Si tu modifies un fichier, **incrémente le numéro de version dans les pages qui l'appellent**.

## 6. Règles de travail
- **Ne jamais affaiblir ni supprimer un test.** Tout nouveau garde-fou doit être vu échouer quand on retire son code, puis restauré.
- **Les deux suites doivent être vertes avant de rendre la main.**
- **Migrations additives uniquement** (`db._migrer`, `VERSION_SCHEMA = 4`). Pour toute table qui contient des données d'un utilisateur, ajouter sa règle dans `db.RLS`.
- **Aucun faux succès à l'écran** : l'interface ne change qu'après la réponse du serveur. Tout texte venant de la base passe par `S.esc()`.
- **Commits successifs**, avec une ligne `Co-Authored-By` en fin de message. Ne pousser que si le propriétaire le demande et une fois le dépôt créé. Vérifier l'absence de secrets avant.
- **Fin de chaque rapport** : 🔴 BLOQUANTS / 🟠 NON-BLOQUANTS / 🟢 BACKLOG / 🚦 DÉCISION.
