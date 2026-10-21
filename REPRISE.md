# REPRISE — Sōzō (état au 21/10/2026)

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

000. **Refonte velours (§8) et lots A à E (§9) — POUSSÉS sur GitHub le 21/10/2026, sur le « go » du propriétaire.** Le Worker Cloudflare se redéploie seul à chaque push ; **le serveur Render, NON : Manual Deploy à faire** (dépôt public). Tant qu'il n'est pas fait, les nouvelles pages parlent à l'ancien serveur (routes manquantes). Au démarrage, Render applique le schéma **v12** (v10 écrits, v11 corbeilles et e-mail, v12 charte ; contrainte des notifications élargie ; tables `abonnements`, `versets`, `signets`) — migrations additives, testées sous PostgreSQL 16. Après le déploiement : vérifier `/api/sante`, une page, la charte, un commentaire chez quelqu'un d'autre. Restent à la décision du propriétaire : réduire le catalogue en ligne à un livre (`demo.py --un-seul --en-ligne`, item 00), et relire puis COMPLÉTER `app/charte.html`, `app/cgu.html`, `app/confidentialite.html` (passages entre crochets : éditeur, adresse, contact, âge minimum, remboursements, durées de conservation, droit applicable, prestataire d'e-mail).

00. **Refonte du 21/10/2026, « Sōzō plus modeste, calme et sérieux, tourné vers l'écriture » — PAS ENCORE POUSSÉE NI DÉPLOYÉE** (voir §8). Pour la mettre en ligne : pousser, **Manual Deploy de Render** (le serveur a changé : schéma v10, 20 routes), puis, sur le « go » du propriétaire seulement, réduire le catalogue en ligne à un livre : `backend_venv/bin/python backend/tools/demo.py --un-seul --en-ligne --projet dcbbvcvnpdllxjyefzln` (adresse collée au clavier, taper CONFIRMER ; `--remettre` annule).

0. **Refonte du 19/10/2026 (retours du propriétaire après son test), PAS ENCORE DÉPLOYÉE** — voir §7. À faire : pousser, Manual Deploy de Render (le serveur a changé : migration v8, nouvelles routes), puis faire tester par le propriétaire. Pour activer la relecture IA : `ANTHROPIC_API_KEY` sur Render (sans elle, le bouton dit honnêtement « pas encore activée »).

1. **Catalogue en ligne : décision A (18/10/2026), « des livres de religion, d'inspiration, de Dieu et de foi, dans le christianisme ».** **Chargé EN LIGNE le 19/10/2026** (Render redéployé avant, sur 05b1cab ; chargement ~7 min depuis Kinshasa). Vérifié en ligne : 14 livres / 12 auteurs au catalogue, tous `demo` ; page gratuite servie ; achat d'une page payante refusé (400 « Ce livre est un exemple : il ne se vend pas. »).
   - `backend/tools/demo_catalogue.py` écrit `demo.json` : 12 auteurs et 14 livres chrétiens INVENTÉS (méditations, prière, poésie de louange, romans, jeunesse, essai, biographie de Paul…). Les versets sont lus dans la Bible LSG 1910 intégrée, jamais recopiés à la main. Nawezi N. n'y est plus : auteur réel, il publie ses vrais livres lui-même ;
   - étiquette « Exemple » sur chaque couverture et sur la fiche (`ui.js` `cv-exemple`, `livre.js`) ; une page payante d'un livre d'exemple l'explique au lieu de proposer l'achat (`lire.js`) ;
   - **un livre d'exemple ne se vend pas** : refus du serveur (`argent._calculer`), test `test_livre_d_exemple_jamais_vendu`, vu tomber sans le correctif ;
   - `demo.py --en-ligne --projet <ref>` : adresse collée au clavier, puis taper EXEMPLE.
   Pour recommencer ailleurs : pousser, Manual Deploy de Render (le refus de vente doit être en ligne AVANT les livres), puis `demo.py --en-ligne`. La base de développement locale garde l'ancien catalogue (les comptes d'essai y ont des achats) : pour voir le nouveau, charger une base neuve (`SOZO_DB_PATH=…`).
   Tuiles vides : réglé le 19/10 — Explorer n'affiche que les catégories qui ont des livres, avec leur nombre.
2. **Paiements (19/10/2026)** : les DEUX, dans l'ordre. (a) **Fait** : l'administration « Cadeaux » offre un livre entier ou Plume (table `dons`, rôle finance + code frais, motif, audit, notification, retirable ; aucun argent : ni paiement, ni reçu, ni revenu pour l'auteur ; tests `test_dons.py`, vus tomber). (b) **Reste** : quand le propriétaire donne ses numéros Mobile Money (`SOZO_PAIEMENT_NUMEROS` sur Render), les vraies ventes s'ouvrent ; il confirme chaque paiement dans l'admin.
3. Le propriétaire teste le logiciel ce week-end : traiter ses retours en priorité.

## 9. Lots A à E du 21/10/2026 — compléter le logiciel (liste approuvée par le propriétaire)

Le propriétaire : « la suppression d'une page, tu n'avais prévu que la création ». Liste détaillée approuvée (« Go pour tous les lots, dans l'ordre »), points à décider tranchés selon les recommandations. Commits `7b3a83e` à lot E. Suites : **235 tests, verts sous SQLite (9 réservés à PostgreSQL sautés) ET sous PostgreSQL 16**. Chaque garde-fou des lots a été vu tomber une fois neutralisé (A 20/20, B 7/7, C 9/9, D 5/5, E 10/10, correctifs RLS 9/9 sous PostgreSQL). Pas fait, par choix : dictée vocale, avis sur les livres.
- **Leçon (21/10) — la suite PostgreSQL a trouvé ce que SQLite ne pouvait pas voir** (elle n'avait pas tourné depuis la refonte) : sous RLS, la connexion d'une personne n'écrit et ne lit que SES lignes. (1) Commenter, répondre, aimer, suivre quelqu'un rendait **500** : la notification de l'AUTRE était écrite dans la transaction de celui qui agit → `notifications.emettre_chez_autrui` (connexion globale, après validation du fait). (2) La garde « un écrit signalé ne s'efface pas » ne voyait pas les signalements des autres : **l'effacement passait** → `studio._signale` (lecture globale, oui/non) ; même chose pour `_sans_lecteur` (droits et cadeaux des lecteurs). (3) Le profil affichait 0 ou 1 abonné → `communaute.nb_abonnes`. (4) Effacer un livre ou un compte laissait les lignes des autres (suivis, j'aime, abonnés). **Règle : tout code qui lit ou écrit chez un AUTRE compte passe par `db.connecter(globale=True)`, explicitement, et la suite PostgreSQL tourne avant chaque commit serveur.** Nouvelle garde au passage : un livre visé par un signalement ouvert ne s'efface pas (comme un écrit).
- **A — le cycle complet de chaque objet** (`studio.py`, `ecrits.py`, `comptes.py`, `catalogue.py`, `notifications.py`) : livre retiré du catalogue par son auteur (`cache_le`, ses lecteurs gardent leurs pages) ou mis à la corbeille (jamais publié), restauré, effacé ; pages insérées, dupliquées, coupées, fusionnées (seulement les brouillons après la dernière page sortie), version ancienne rétablie, effacement définitif depuis la corbeille ; écrits programmés, effacés pour de bon (refusé si un signalement est ouvert) ; réponses aux commentaires, correction pendant 15 min ; note sur une épingle ; signaler un livre ; changer d'adresse e-mail (code envoyé à la NOUVELLE adresse, l'ancienne prévenue, autres sessions fermées), appareils connectés, export « Mes données » ; supprimer une notification ; reçu imprimable (`recu.html`).
- **B — écrire mieux** : recueil (plusieurs écrits → un livre en brouillons), carte image à partager (canvas 1080 × 1350), 12 thèmes sur liste fermée, listes à puces et numérotées dans la Plume, série d'écriture, export Word (`export_docx.py`, écrit à la main, sans dépendance) et « Imprimer ou PDF » (`imprimer.html`).
- **C — la communauté** (`communaute.py`) : suivre un auteur, profils pour tous (un profil n'existe que pour qui a publié, ou pour soi-même : sinon on énumérait noms et villes), notifications sociales (commentaire, réponse, j'aime regroupés par jour, nouvel écrit d'un auteur suivi, une seule fois), fil « Abonnements », recherche globale (écrits et auteurs). Deux types de notification ajoutés (`communaute`, `abonnements`) : contrainte remplacée sous PostgreSQL, table reconstruite sous SQLite (`db._types_de_notification`, testé sans perte).
- **D — lire** (`lecture_plus.py`) : recherche dans toute la Bible (côté serveur), verset du jour, versets gardés ; recherche dans un livre (SEULEMENT les pages lisibles : une page payante non achetée ne laisse fuir ni un mot ni son numéro), marque-pages (page lisible seulement), lecture à voix haute (voix française de l'appareil). **Application installable** (icônes PNG, `manifest.json`) et **lecture hors ligne** (`sw.js`) : les données personnelles ne sont gardées que pour le compte qui les a lues (`sozo-u<id>`), servies seulement sans réseau, retirées sur 401/402/403/404, vidées à la déconnexion.
- **E — modérer et encadrer** : **charte de la communauté** (`charte.py`, `app/charte.html`) acceptée avant le premier écrit public ou le premier commentaire, tenue par le SERVEUR (403 `code: charte` ; l'écran montre la charte puis rejoue la demande), versionnée (`charte.VERSION` : la changer fait accepter de nouveau) ; **modération directe** (onglet « Communauté » de la console : écrits et commentaires récents, retirer avec motif, rétablir — seulement ce que la modération a retiré, jamais un commentaire retiré par son auteur) ; **tableau** : écrits en ligne, commentaires, abonnements, charte acceptée, écrits retirés ; **textes en projet** `cgu.html` et `confidentialite.html` (publics, sans compte, décrivent ce que le logiciel fait réellement ; bandeau « Projet à valider »), liés depuis l'inscription, le pied de l'application et la landing.

## 8. Refonte du 21/10/2026 — ce qui a changé (image envoyée par le propriétaire)

Commits `b19060e` (serveur) puis la refonte des écrans. Suites : 188 tests SQLite (+16), 188 PostgreSQL, verts.
- **Identité « velours »** (`app/velours.css`, chargé en dernier par chaque écran, préfixe `vl-`) : papier ivoire, bordeaux, or, titres en serif, mode sombre bordeaux presque noir. **Plus aucune photo** dans le logiciel ni sur la landing : couvertures typographiques sur velours (`ui.js` `cover`, l'ancien fond « photo » devient un dégradé), monogrammes à la place des portraits, velours derrière la fiche d'un livre, la connexion, la page d'un auteur. Les dossiers `images/` restent dans le dépôt mais ne sont plus appelés par le logiciel.
- **Navigation** : téléphone = Accueil · Explorer · la plume (Écrire) · Bibliothèque · Profil ; ordinateur = Écrire (Écrire, Mes écrits, Mes livres, Importer) puis Lire.
- **Accueil** (`decouvrir.js`) sur le modèle de l'image : « Bonjour », recherche, la plume (pensée, poème, prière, récit, conte, un livre), à la une sur velours, nouveautés, écrits du jour.
- **Écrits** : `ecrits.html` (mes écrits façon Notes : brouillons, publiés, corbeille ; et la plume pour écrire), `ecrit.html` (lire, j'aimer, garder, partager, commenter, signaler), `ecrits-ui.js` (la carte et ses gestes, partagée). Explorer a une vue « Écrits », la bibliothèque un onglet « Écrits gardés », l'administration une section « Écrits et commentaires » dans Signalements. Serveur : `ecrits.py` (enregistrement sur 3 s de calme, pas de versions).
- **La Plume, le mini-Word** (`app/plume.js` + `plume-editeur.css`, préfixe `pl-`) : feuilles éditables, gras, italique, titre, sous-titre, citation, séparateur, insérer un verset (Bible intégrée), caractères spéciaux, police et alignement (réglage DU LIVRE, vu par le lecteur), taille d'affichage, rechercher / remplacer dans toutes les pages, inspiration (idée + verset), objectif de mots, machine à écrire, concentration, papiers (ivoire, blanc, sépia, nuit), casse, plein écran. Annuler = celui du navigateur (tout passe par `execCommand`). Les fautes sont soulignées par l'API Highlight de CSS, sans toucher au texte ; un clic sur un mot souligné ouvre sa remarque.
- **Écrire un livre** (`ecrire.js` réécrit) : toutes les pages défilent de haut en bas et se modifient sur place (chargées par lots de 24) ; chaque page garde ses garde-fous (version attendue, copie de secours, Plume, correcteur et IA page par page). Ajouter une page ; **mettre à la corbeille** (brouillons de fin de livre) avec « Annuler » qui remet la page à SA place ; corbeille aussi dans l'atelier (bouton « Corbeille » des pages).
- **Genres** : Poésie, Foi, Prière, Méditation, Louange, Témoignage, Spiritualité, Recueil, Récit, Conte (un livre d'avant garde son ancien genre tant qu'il n'en change pas).
- **Un seul livre** : `demo.py` ne charge plus que « Psaumes de la terre rouge » ; `--un-seul` retire les autres livres d'exemple (rien n'est effacé, les livres des vrais auteurs ne sont jamais touchés), `--remettre` annule. Fait sur la base LOCALE le 21/10 ; **pas en ligne** (attend le go).
- **Liseuse** : la concentration éclaire le premier paragraphe dès le haut de la page, puis suit une ligne de lecture au tiers de l'écran ; un toucher ou ↑ / ↓ choisit le paragraphe.
- **Landing** : toujours rouge ; plus de photo (le pan qui s'ouvrait entre les mots est du velours ; les cartes portent un verset LSG vérifié dans la Bible intégrée ; les catégories sont des tuiles) ; accroche « Écrivez votre foi, mot après mot. » ; plus de roman, polar ni manga. La devise du propriétaire est inchangée.
- **Versions des fichiers** : `python3 tools/versions.py` pose dans chaque page une version tirée du CONTENU de chaque .js / .css (plus de ?v=N à incrémenter à la main).

## 7. Refonte du 19/10/2026 — ce qui a changé (retours du propriétaire)

Commits `563625a` (serveur) puis la refonte des écrans. Suites : 168 tests SQLite (+13), PostgreSQL vert.
- **Couleurs** (`app/app.css` `:root`, `atelier.css`, `plume.css`) : `--forest` neutre, nocturne `#121011`, bordeaux en accent (`--wine`).
- **Navigation** (`ui.js` `shell`) : barre latérale à gauche sur ordinateur (icônes, dépliée au survol, au clavier ou épinglée par le bouton menu ; `aria-expanded` exact ; mouvement réduit = sans animation) ; barre du bas à 5 onglets sur téléphone, « Écrire » doré au centre. Sections : Écrire (atelier, nouveau livre, écrire une page, importer) puis Lire (accueil, Explorer, bibliothèque, Bible). Raccourcis : `studio.html?action=nouveau|ecrire|importer|couverture|mise|publier`.
- **Se repérer** : inscription → auteur par défaut → `studio.html?bienvenue=1` (3 gestes) ; lecteur → `decouvrir.html?bienvenue=1`. Visite guidée (`SOZO.visite`, 4 bulles sur le vrai menu, rejouable). Accueil refait (`decouvrir.js`) : salutation, portes Écrire/Lire, « Premiers pas » cochés d'après les VRAIES données, vos livres, reprendre la lecture, à la une, nouveautés, paraît bientôt. Catalogue déplacé dans **Explorer** (`explorer.html`). « Mes suivis » → **Ma bibliothèque** (onglets En cours / Épingles / Notifications).
- **Personnalisation du livre** (`studio.js` `dessinerCouverture`, `miseEnPage`) : modèles + fond (photo, image ENVOYÉE, couleur, dégradé), cadrage, zoom, voile, police, taille, épaisseur, capitales, italique, espacement, alignement, position, couleurs, sous-titre, ornements, « image seule ». Mise en page intérieure : police, interligne, alignement, lettrine, séparateur (« *** »), titre de chapitre, accent. Serveur : `books.apparence` (JSON reconstruit clé par clé, couleurs `#RRGGBB` seulement), table `couvertures` (en base : le disque Render est effacé), image reconnue par sa SIGNATURE (JPEG/PNG/WebP, jamais SVG), servie par `/api/livres/<slug>/couverture` à qui peut voir le livre. L'image est réduite sur l'appareil (1 200 × 1 800, JPEG) avant l'envoi.
- **Atelier** : bande « Que voulez-vous faire ? » ; Pages en **pages entières** par défaut (`/api/studio/livres/<slug>/textes`, 24 par appel, chargées en descendant), tableau toujours disponible.
- **Liseuse** (`lire.js`) : défilement page à page (et glisser du doigt), « Glisser ⇆ » (une page par écran), « Continu ⇅ » (comme un document) ; mode concentration (touche F, paragraphe lu éclairé) ; épingles (sélection → « Épingler » ; `/api/epingles`, un extrait n'est accepté que s'il figure dans une page LISIBLE, 300 signes sur une page achetée) ; page payante = page floutée de MOTS DE REMPLISSAGE + cadenas (le vrai texte n'est jamais envoyé) ; mise en page de l'auteur (désactivable par le lecteur).
- **Correcteur** (`app/langue/correcteur.js`) : mesuré sur 40 pages justes des livres d'exemple, **224 fausses remarques → 4** (répétitions de style). Apostrophes droites et espaces fines : harmonisées sans être signalées (bouton « Harmoniser la typographie ») ; « ne » explétif, « ni… ne », « aucun… ne », « ne savent » ; majuscule après un point seulement ; noms propres et 3 523 noms bibliques (`noms-bibliques.txt`, tirés de la Bible intégrée) ; répétition = 3 fois en 50 mots.
- **Relecture par l'IA** (`backend/ia_correcteur.py`, bouton dans l'éditeur) : Claude (`claude-opus-5-5` par défaut, `SOZO_IA_MODELE` pour changer), à la demande de l'auteur et après son accord (le texte part chez Anthropic). Chaque proposition est vérifiée dans le texte par le serveur ; rien ne change sans un clic « Appliquer ». Plafond `SOZO_IA_PLAFOND_JOUR` (40). **Inactive sans `ANTHROPIC_API_KEY`** — coût estimé ~0,02 $ par page relue.
- **Landing** : boutons mis en avant (or ; « Ouvrir le studio » en bordeaux), rien d'autre.

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
- **La landing (`index.html`, `styles.css`, `sozo.css`, `sozo.js`, `content.js`, `app.js`) est FIGÉE**, sauf sur demande expresse du propriétaire : boutons (19/10), toujours rouge (19/10), plus de photo et textes tournés vers l'écriture (21/10, §8).
- **Une fois connecté (21/10, image du propriétaire)** : papier ivoire, bordeaux, or, plume, velours pour ce qui compte ; aucune photo. Sōzō est « plus modeste, calme et sérieux », tourné vers l'écriture (écrits courts ET livres).
- **On développe d'abord pour les AUTEURS (19/10)** : « Écrire » vient en premier partout (menu, barre du bas au centre, inscription), l'outillage auteur à un ou deux clics.
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
**Tests** : 235 sur SQLite (9 réservés à PostgreSQL y sont sautés) et 235 sur PostgreSQL 16 (RLS active), tous verts au 21/10/2026 après le lot E. Chaque garde-fou a été vu tomber quand on retire le code qui le porte.
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
- **Pour le bas de page et la mise en ligne, il manque les informations du propriétaire** : éditeur légal (nom, adresse, RCCM), numéros Mobile Money par opérateur, nom de domaine, réseaux sociaux, e-mail de l'administrateur. Les textes (charte, CGU, confidentialité) existent en PROJET depuis le 21/10 : ils n'ont pas de valeur juridique tant que le propriétaire ne les a pas validés et complétés.

## 5. Environnement local
- **Aperçu** : entrée « sozo » dans `/Users/macbookpro/klassio-saas/.claude/launch.json`, sur le port 4385, avec `SOZO_MODE_TEST=1`. **Relancer le serveur après toute modification du code Python** : il ne se recharge pas tout seul.
- **Comptes d'essai locaux** (lecteur, auteur, admin avec son secret TOTP) : `backend/stockage/comptes-essai.json`. Clés VAPID de développement : `backend/stockage/vapid.json` (lues seulement avec `SOZO_VAPID_DEV=1`). Ce dossier est ignoré par git ; ne jamais recopier ces valeurs ailleurs.
- **Base de développement** : `backend/sozo.db`, avec les données de démonstration de `backend/tools/demo.py`.
- **Cache du navigateur** : après toute modification d'un .js ou d'un .css, lancer `python3 tools/versions.py` (version tirée du contenu, posée dans chaque page). Une nouvelle page doit appeler ses fichiers avec `?v=0` pour que le script la prenne en charge.

## 6. Règles de travail
- **Ne jamais affaiblir ni supprimer un test.** Tout nouveau garde-fou doit être vu échouer quand on retire son code, puis restauré.
- **Les deux suites doivent être vertes avant de rendre la main.**
- **Migrations additives uniquement** (`db._migrer`, `VERSION_SCHEMA = 12`). Pour toute table qui contient des données d'un utilisateur, ajouter sa règle dans `db.RLS`.
- **Aucun faux succès à l'écran** : l'interface ne change qu'après la réponse du serveur. Tout texte venant de la base passe par `S.esc()`.
- **Commits successifs**, avec une ligne `Co-Authored-By` en fin de message. Ne pousser que si le propriétaire le demande et une fois le dépôt créé. Vérifier l'absence de secrets avant.
- **Fin de chaque rapport** : 🔴 BLOQUANTS / 🟠 NON-BLOQUANTS / 🟢 BACKLOG / 🚦 DÉCISION.
