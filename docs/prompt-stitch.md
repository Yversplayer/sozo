# Prompts pour Stitch — écrans de l'application Sōzō (08/11/2026)

Mode d'emploi :
1. Dans Stitch, choisir **Mobile**.
2. Joindre 2 ou 3 captures trouvées (Dribbble…) qui montrent le style voulu.
3. Coller le **prompt général**, puis UN prompt d'écran à la fois (Stitch fait mieux écran par écran).
4. Renvoyer les écrans obtenus à Claude : il les reproduit sur le vrai Sōzō (serveur, comptes, achats déjà faits).

---

## Prompt général (à coller en premier)

```
Design a mobile app called "Sōzō": a reading and writing platform for Christian and inspirational books, made in Kinshasa (DR Congo). Readers read books chapter by chapter (free, paid or mixed pages), follow authors, and post short writings (thoughts, prayers, poems, quotes). Authors publish their books page by page.

Use the attached screenshots as STYLE reference only (layout, spacing, typography, feel). Do not copy their content or branding.

Feel: young, technological and clean, like Instagram, TikTok or Webtoon. A native mobile app, not a website: no boxes around information, no borders everywhere, generous white space, big book covers, smooth.

Brand:
- Background WHITE by default (#FFFFFF). Optional dark mode later.
- Logo: a small golden feather (quill) followed by the word "Sōzō" in bold sans-serif (Inter, semibold), top left of the home screen.
- Accent colors: deep burgundy #6B0F1A for main actions, gold #D4AF37 for the feather and highlights. Use them sparingly.
- Fonts: Inter for interface, Cormorant Garamond (serif) for book titles and quotes.
- Text must stay readable (contrast AA).

Navigation: a floating bottom tab bar with 5 tabs: Découvrir (home), Rechercher (search), Écrire (central round golden button with the feather), Notes, Profil (user avatar with initials).

All text in FRENCH. Use realistic example content (Christian books, Bible verses Louis Segond 1910). Prices in US dollars. Payment is Mobile Money: the reader declares the payment and Sōzō confirms it (never "paid instantly by card").
Do not invent features that are not listed in the screen prompts.
```

---

## Prompts d'écran (un à la fois)

### 1. Découvrir (accueil)
```
Home screen "Découvrir". Top: golden feather + "Sōzō" in bold, then a download icon and a bell icon with an unread badge. Filter pills: Livres, Écrits, La Bible. Center: the book of the day, large cover, title in serif, "Roman · Mixte · Author name", two buttons "Aller lire" (filled dark) and "S'abonner". The background at the top takes a soft tint from that cover's colors, fading to white. Then horizontal rows of covers: "Reprendre la lecture" (with progress bar and "Page 12"), "Nouveautés", "Pour vous", categories. Between rows, short writings shown without frames: a quote in serif italic, author name, and three actions: heart with count, comments with count, share. A "Verset du jour". At the bottom: "Et vous, qu'avez-vous sur le cœur ?" with a button "Écrire une pensée".
```

### 2. Rechercher
```
Search screen "Rechercher". The search field is at the top, focused, keyboard open. Below it: recent searches, then category circles (Méditation, Prière, Poésie, Roman, Jeunesse, Essai, Biographie, Bible), then popular books as a grid of covers and popular authors with avatar and follower count.
```

### 3. Fiche d'un livre
```
Book detail screen. Large floating cover at the top on a soft tint of the cover's colors. Title (serif), author, short description. Main button "Commencer à lire" (or "Reprendre · chap. 2 · page 7"). A list of chapters, one per line: "Chap. 1 · Le premier matin", with a free/paid badge and a small price for paid ones. Top right: an "i" button (opens full details: presentation, pages, price, author, reviews, report) and a "⋮" menu (Partager, Ajouter à mes abonnements, Télécharger). Back arrow top left.
```

### 4. Liseuse
```
Reading screen. Clean full-page text in serif, comfortable size, chapter title at the top. Minimal top bar (back, chapter name, settings "Aa"). Bottom: page progress "Page 7 / 42" and "Chapitre suivant". Selecting text offers: Surligner, Garder la citation, Partager. A paid page shows a calm paywall card: price in dollars and "Acheter avec Mobile Money", with the note "Sōzō confirme votre paiement".
```

### 5. Écrire
```
Writing hub "Écrire". Big title "Qu'allez-vous écrire aujourd'hui ?". A list of ways to write, each with an icon and one line of explanation: Une pensée, Une prière, Un poème, Un récit, Un livre (page par page). Below: "Mes brouillons" and "Publiés" with small previews. For authors: link to "Mon studio" (books, sales, payouts).
```

### 6. Notes
```
Notes screen: a personal notebook, beautiful and personal. Sections as swipeable tabs: Surlignés, Versets, Marque-pages, Écrits gardés. Highlights look like marker strokes on the quoted text, with book title and page. Bible verses appear in the color the user chose. Bookmarks show the cover, chapter and page. Empty states are warm and illustrated with the golden feather, never just grey text.
```

### 7. Profil
```
Profile screen in the style "Mes séries" (Webtoon). Top: avatar, name, settings gear. Swipeable tabs that the finger can slide between (the bottom tab bar stays still): Récents ("Lu il y a 15 jours"), Abonnements, Téléchargements, Achetés, Commentaires. Each item shows the cover, title, author and last chapter read.
```

### 8. Un écrit et ses commentaires
```
Writing detail screen: a short poem or prayer in serif, author with avatar, date. Actions: heart, comments, keep, share. A floating "Retour" pill at the top left. Comments below: input "Un mot pour l'auteur…", button "Publier", then comments with avatar, name, date, "Répondre" and "Signaler". Note: "Restez bienveillant : chaque commentaire peut être signalé."
```

### 9. Page d'un auteur
```
Author page: avatar, name, short bio, followers count, button "Suivre". Tabs: Livres, Écrits. Grid of covers and list of short writings.
```

### 10. Notifications
```
Notifications screen (opened from the bell): grouped by "Aujourd'hui", "Cette semaine". Items: new chapter from a followed author, someone liked or commented your writing, payment confirmed by Sōzō, new follower. Unread items marked with a small gold dot.
```

### 11. Achat et reçu
```
Purchase flow: choose what to buy (one page, the whole book), price in dollars, then Mobile Money instructions (operator, number to send to, reference to enter), and a field for the transaction reference. After sending: status "En attente de vérification", then a receipt screen "Confirmé" with amount, date and reference.
```

### 12. Paramètres
```
Settings screen: Mon compte (name, email, password), Thème (Clair / Nocturne), Notifications, Appareils connectés, Offre Plume for authors, Mentions légales, Charte, Se déconnecter. Simple grouped list, iOS style.
```

### 13. Connexion
```
Login and sign-up screen: golden feather and "Sōzō" centered, tagline "Lisez, écrivez, partagez la foi". Tabs Connexion / Inscription, email, password with eye icon, button "Se connecter", link "Mot de passe oublié ?". Clean white background.
```
