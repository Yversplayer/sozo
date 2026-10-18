# Sōzō — crédits et statut du brouillon

## Identité
Palette (bordeaux #6B0F1A, blanc cassé #F8F5EB, or #D4AF37), logo à la plume
et devise repris des maquettes fournies par le propriétaire (13/10/2026).
Logo vectoriel : Cormorant Garamond 600 (licence SIL OFL), plume dessinée à la main.

## Photos
Toutes les photos de `images/` viennent de StockSnap et du répertoire photo
WordPress, via l'API publique Openverse, sous licence **CC0** (domaine public,
usage commercial autorisé, sans attribution obligatoire). Elles illustrent :
aucune ne représente un auteur, un lecteur ou un livre réel.
Résolution limitée à 960 px de large pour la plupart : à remplacer
(Higgsfield ou photos propres) avant une mise en ligne.

## Données
**Catalogue d'exemple de l'application** (`backend/tools/demo.json`, écrit par
`demo_catalogue.py`, 18/10/2026) : 12 auteurs et 14 livres de foi chrétienne,
tous INVENTÉS, textes originaux. Les versets cités sont lus dans la Bible
Louis Segond 1910 intégrée (domaine public), jamais recopiés à la main.
Chaque livre porte l'étiquette « Exemple » et ne se vend pas.

**Vitrine de la landing** (`app/data.js`, figée) : livres, auteurs, prix, dates, achats et lecteurs sont fictifs, sauf
« Croix de bois, Actes de foi » (Nawezi N.), dont le titre, les chapitres et
les premières lignes viennent des maquettes du propriétaire. Le recueil
personnel « Sōzō » n'est PAS dans le catalogue : il inspire, il n'est pas publié.
Aucun serveur, aucun paiement : les achats affichent un récapitulatif réel
et un bouton « Payer » désactivé.

## Bible
`app/bible/` : Bible Louis Segond 1910 (domaine public), source getbible.net
(« ls1910 »), découpée en un fichier par livre (4,4 Mo au total).

## Langue française
`app/langue/lexique.txt` : dérivé du lexique des formes fléchies de Grammalecte
v7.7 (Olivier R., Dicollecte) — licence MPL 2.0. 476 088 formes, étiquettes
grammaticales réduites, lemmes et fréquences.
`app/langue/synonymes.txt` : dérivé du thésaurus myThes 2.3 (Frédéric Labbé,
Dicollecte) — licence LGPL 2.1 ou ultérieure.
