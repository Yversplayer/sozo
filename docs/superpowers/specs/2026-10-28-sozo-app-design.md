> **Remplacé le 30/10/2026.** La version de l'ami n'arrivera pas. L'application se construit sur le Sōzō actuel (même serveur, mêmes données), avec un écran téléphone refait d'après ses captures : voir REPRISE.md §14. Ce document ne sert plus que de mémoire des captures.

# Sōzō — l'application (conception, 28/10/2026)

## Pourquoi

Un ami du propriétaire construit de son côté une nouvelle version de Sōzō, avec une autre pile technique (captures du 28/10). Il avance lentement et a demandé au propriétaire de commencer. Les deux projets devront se **rejoindre** : on construit donc avec **ses** technologies et **son** rangement, pour que la fusion se résume à réunir deux dossiers.

Le propriétaire veut une application **légère et clean**, « telle une plume ». Elle doit reprendre :
- l'apparence et les écrans du prototype de l'ami ;
- **toutes** les fonctions qui marchent déjà dans le Sōzō en ligne (Flask, `/Users/macbookpro/sozo`).

Le dépôt de l'ami n'est pas accessible. Tout ce qui le concerne est déduit de ses captures.

## Ce qu'on voit chez l'ami (source : 7 captures du 28/10)

- **Rangement** :
  - un monorepo **pnpm + turbo** : `apps/`, `packages/`, `docker-compose.yml`, `.env.example`, `turbo.json`, `pnpm-workspace.yaml` ;
  - son plan dit : « Init monorepo pnpm/turbo », « Docker Compose : Postgres, Redis », « Tokens CSS charte (bordeaux/or) », « Shells vides : MobileShell, StudioShell », composants `NavBar`, `TabBar`, `Sheet`, « NestJS bootstrap + Prisma + /health », « CI : lint + typecheck ».
- **Barre du bas**, cinq onglets : Découvrir · Bibliothèque · **Écrire** (rond doré au centre) · Notes · Profil.
- **Découvrir** :
  - « Bonjour, Robert » avec un avatar, puis une barre de recherche ;
  - une carte « Continuer la lecture » (couverture, % terminé) ;
  - « Tendances de la semaine » (rangée de couvertures, « Tout voir ») ;
  - « Explorer par catégories » (cartes).
- **Bibliothèque « Mes favoris »** : des filtres en pastilles (Tous, Récents, Épinglés, À lire, En cours), puis des collections par thème (titre, sous-titre, couvertures, nombre de lecteurs et de livres) et un bouton « + » flottant.
- **Écrire (Studio auteur)** : un grand bouton « Nouveau livre », puis « Mes livres », en cartes avec couverture, titre, nombre de chapitres et l'état Brouillon ou Publié.
- **Éditeur** :
  - en haut : retour, sommaire, « Chapitre 1 », boutons **Import** et **Publier** ;
  - une barre d'outils : B, I, U, S, H1, H2, H3, alignements, listes, citation, lien ;
  - en bas : le nombre de mots et de caractères.
- **Liseuse** :
  - croix de fermeture, pourcentage, « Lecture partagée », « Chapitre 02 → », barre de progression dorée ;
  - le texte se lit par **chapitres**, avec des passages surlignés ;
  - des boutons ronds flottants (partager, notes, page suivante).
- **Style** : fond blanc ivoire, bordeaux et or, titres en sans-serif gras, couvertures soignées.

## Objectifs

1. Un nouveau dossier **`/Users/macbookpro/sozo-app`**, rangé comme celui de l'ami, que l'on pourra fusionner avec le sien.
2. Une application web **mobile d'abord**, installable (PWA), légère sur un Android modeste en 3G, qui reprend ses cinq onglets et ses écrans.
3. Un serveur NestJS + Prisma qui reprend, **par étapes**, les règles du Sōzō actuel.
4. Une seule navigation, une seule feuille de couleurs : la leçon du 28/10.

## Non-objectifs (pour cette première étape)

- Ne pas arrêter le Sōzō en ligne. Il continue de tourner tel quel jusqu'au jour de la bascule.
- Pas de recopie des vraies données de Supabase : la nouvelle application démarre sur une base à elle, avec des données d'exemple.
- Pas de publication sur le Play Store ni l'App Store : cela vient après, en emballant l'application web.
- Pas de nouvelle fonction qui n'existe pas déjà dans l'un des deux projets.

## Anti-objectifs (ce qui serait un échec même si « ça marche »)

- **Une application lourde** : chaque écran doit rester sous **150 Ko** transférés hors images en 3G, avec des photos WebP et le chargement différé.
- **Deux navigations sur un même appareil**, ou des effets empilés.
- **Le navigateur qui décide** des droits, des prix ou de l'accès à une page payante. Le serveur décide de tout, comme aujourd'hui.
- **Une fonction montrée qui n'existe pas** : par exemple « payé en ligne » alors que Mobile Money est seulement déclaré.
- **Un rangement qui s'éloigne de celui de l'ami** au point de rendre la fusion pénible.

## Contraintes

- Pile imposée par l'ami : **TypeScript**, **pnpm + turbo**, **NestJS + Prisma**, **PostgreSQL**, **Redis** (Docker Compose en local), **React** pour l'interface.
- Il faut installer **Node.js** (LTS) et **pnpm** sur le Mac du propriétaire : ils sont absents aujourd'hui. Docker Desktop aussi, pour Postgres et Redis.
- Mobile 375 px sans débordement, thème clair et sombre, contraste AA, `prefers-reduced-motion`.
- Les règles de sécurité payées par des bugs dans le Sōzō actuel restent vraies dans le nouveau serveur :
  - chaque compte ne voit que ses données ;
  - une page payante n'est servie qu'à qui y a droit ;
  - un lot s'applique en entier ou pas du tout ;
  - aucune écriture sur le seul critère du navigateur.

## Ce qui est décidé

- **Le propriétaire** : on construit avec les technologies de l'ami et on commence sans son dépôt, en partant des captures et de l'existant.
- **Mon choix (à corriger si besoin)** : la nouvelle application démarre **à côté**, sur sa propre base, et le Sōzō en ligne continue. Le propriétaire n'a pas encore tranché entre « remplacer » et « à côté ». Je retiens « à côté » parce que c'est ce qui ne casse rien.

## Rangement proposé (calqué sur l'ami)

```
sozo-app/
  apps/
    web/        React + TypeScript, mobile d'abord, PWA (MobileShell, StudioShell)
    api/        NestJS + Prisma (/health, puis les modules métier)
  packages/
    ui/         jetons de couleurs (bordeaux/or), NavBar, TabBar, Sheet, Cover, Button
    types/      types partagés entre web et api (Livre, Chapitre, Page, Écrit…)
  docker-compose.yml   Postgres + Redis
  .env.example
  turbo.json  pnpm-workspace.yaml  package.json  README.md
  LIAISON.md  ce qui a été déduit des captures, et comment fusionner avec le dépôt de l'ami
```

## Les écrans (cinq onglets, une seule navigation)

| Onglet | Écran | Repris du Sōzō actuel |
|---|---|---|
| Découvrir | salutation, recherche, Continuer la lecture, Tendances, catégories ; verset du jour discret | Accueil + Explorer fusionnés (conseil du 23/10) |
| Bibliothèque | pastilles Tous / Récents / Épinglés / À lire / En cours ; collections | Bibliothèque, épingles, suivis, abonnements |
| **Écrire** (centre) | Nouveau livre, Mes livres (Brouillon / Publié), écrits courts | atelier, livre offert, écrits courts, recueil |
| Notes | passages surlignés, versets gardés en couleur, épingles, mes écrits courts | épingles + versets + écrits |
| Profil | compte, Plume (3 offres, prix seulement sur demande), thème, déconnexion | Mon compte, Plume, charte |

Écrans hors onglets :
- fiche du livre, avec les avis ;
- liseuse par chapitres : pourcentage, chapitre suivant, surlignage, carte de passage à partager, un **mot à la fin du chapitre** ;
- éditeur (barre d'outils, Import, **Publier tout le livre**) ;
- Bible (lecture, versets en couleur, « Lire seulement »), ouverte depuis Découvrir et Notes ;
- notifications, sous une cloche dans Découvrir.

La **Bible** n'a pas d'onglet chez l'ami. Je la mets en raccourci fixe en haut de Découvrir. **À valider** par le propriétaire.

## Ordre de construction (chaque étape se montre au propriétaire)

1. **Socle** : monorepo, Docker, `/health`, jetons de couleurs, les 5 onglets vides avec MobileShell, CI lint + typecheck.
2. **Lire** : catalogue d'exemple, Découvrir, fiche du livre, liseuse par chapitres avec progression. Comptes : inscription, connexion, session.
3. **Écrire** : Mes livres, éditeur, chapitres, Publier tout le livre, import Word/PDF.
4. **Bibliothèque et Notes** : suivis, surlignages, épingles, mots de fin de chapitre.
5. **Bible**, **Plume** (offres, livre offert, essais) et **paiement déclaré** Mobile Money.
6. Écrits courts, avis, notifications, puis l'emballage pour les magasins d'applications.

## Réponses de la relecture (28/10)

- **Le dépôt de l'ami** : il reste inaccessible. Jusqu'à la fusion, notre schéma Prisma fait foi. `LIAISON.md` liste tout ce qui a été deviné (noms de paquets, modèles, conventions) pour qu'on le compare au sien le jour venu.
- **StudioShell** (mon choix) : le téléphone d'abord, avec MobileShell. Sur un grand écran, l'atelier et l'éditeur passent dans StudioShell : une colonne de chapitres à gauche, l'éditeur au centre. Les autres écrans restent centrés, sans seconde navigation.
- **Où montrer les étapes** (mon choix) : sur le Mac du propriétaire jusqu'à l'étape 3, puis en ligne. Le choix de l'hébergeur NestJS + Redis sera tranché à ce moment-là.
- **Fonctions du Sōzō actuel placées dans l'ordre** (mon choix) :
  - étape 5 : une console `apps/admin`, avec code à deux facteurs, confirmation des paiements, cadeaux et modération ;
  - étape 6 : revenus et reversements, parutions programmées, relecture par l'IA, e-mails et notifications sur l'appareil, filigrane.
- **Fonctions vues seulement sur les captures de l'ami** (mon choix) :
  - « Tendances » = les livres les plus lus de la semaine, calculés à partir de vraies lectures, jamais des chiffres inventés ;
  - les collections sont les étagères personnelles du lecteur ;
  - le surlignage dans les livres et « À lire » sont construits (petits, et utiles) ;
  - « Lecture partagée » attend que l'ami explique ce que c'est.

## Ce qui est laissé au bâtisseur

- Le choix entre Vite et Next.js pour `apps/web`. Mon penchant : **Vite**, plus léger pour une application PWA. Il faudra corriger si le dépôt de l'ami utilise Next.js.
- Le découpage des modules NestJS et le schéma Prisma. Ils partiront du schéma actuel (`backend/schema.sql`, 44 tables), sans le recopier en bloc : on ne prend que les tables de l'étape en cours.
- Les tests. Ils suivent la règle du Sōzō actuel : un garde-fou se voit tomber quand on le neutralise.
