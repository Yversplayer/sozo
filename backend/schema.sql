-- Sōzō — schéma de base (sous-ensemble commun SQLite / PostgreSQL).
-- Dates : texte ISO 8601 en UTC (« 2026-10-14T18:00:00Z »), identique sur
-- les deux moteurs. Montants : entiers en CENTIMES, jamais de flottants.
-- Les tables privées porteront owner_id / user_id (étapes 2 à 5).

CREATE TABLE IF NOT EXISTS schema_meta (
  version INTEGER NOT NULL
);

-- Journal d'audit : qui, quand, quoi, sur quelle ressource, avant / après,
-- succès ou refus. Les refus d'autorisation et de CSRF y sont inscrits.
-- Immuable : des déclencheurs (db.py) refusent toute modification ou suppression.
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  user_id INTEGER,
  ip TEXT,
  action TEXT NOT NULL,
  ressource TEXT,
  avant TEXT,
  apres TEXT,
  resultat TEXT NOT NULL CHECK (resultat IN ('ok', 'refus', 'erreur'))
);
CREATE INDEX IF NOT EXISTS audit_log_at ON audit_log (at);
CREATE INDEX IF NOT EXISTS audit_log_user ON audit_log (user_id, at);

-- ── Étape 2 : comptes et sessions ─────────────────────────────────────────
-- Le rôle n'est JAMAIS fourni par le client après l'inscription ; « admin »
-- n'existe pas ici : l'administration de la plateforme aura ses propres
-- comptes, créés en ligne de commande, avec TOTP (étape 6).
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  nom TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('lecteur', 'auteur')),
  password_hash TEXT NOT NULL,
  email_verifie_at TEXT,
  actif INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

-- Seule l'EMPREINTE du jeton est stockée : la base volée n'ouvre aucune session.
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users (id),
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_seen TEXT,
  revoked_at TEXT,
  ip TEXT,
  agent TEXT
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions (user_id);

-- Jetons à usage unique : vérification d'e-mail, réinitialisation.
CREATE TABLE IF NOT EXISTS jetons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users (id),
  nature TEXT NOT NULL CHECK (nature IN ('verification', 'reinitialisation')),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rate_limits (
  cle TEXT PRIMARY KEY,
  debut TEXT NOT NULL,
  n INTEGER NOT NULL
);

-- E-mails : en mode « capture », le message est rédigé et rangé ICI, et rien
-- ne part. Son état reste « capture » : il n'est jamais présenté comme envoyé.
CREATE TABLE IF NOT EXISTS emails (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  destinataire TEXT NOT NULL,
  sujet TEXT NOT NULL,
  corps TEXT NOT NULL,
  etat TEXT NOT NULL CHECK (etat IN ('capture', 'envoye', 'echec')),
  created_at TEXT NOT NULL
);

-- ── Étape 3 : livres, pages, lecture ───────────────────────────────────────
-- Montants en CENTIMES entiers. owner_id vient toujours de la session.
CREATE TABLE IF NOT EXISTS books (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL REFERENCES users (id),
  slug TEXT NOT NULL UNIQUE,
  titre TEXT NOT NULL,
  categorie TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  couverture TEXT NOT NULL DEFAULT 'couv-pages',
  style TEXT NOT NULL DEFAULT 'a' CHECK (style IN ('a', 'b', 'c', 'd')),
  format TEXT NOT NULL DEFAULT 'texte' CHECK (format IN ('texte', 'vers', 'planche')),
  mode TEXT NOT NULL DEFAULT 'progressive' CHECK (mode IN ('integral', 'progressive')),
  acces TEXT NOT NULL DEFAULT 'free' CHECK (acces IN ('free', 'paid', 'mixed')),
  prix_page INTEGER CHECK (prix_page IS NULL OR prix_page >= 0),
  prix_chapitre INTEGER CHECK (prix_chapitre IS NULL OR prix_chapitre >= 0),
  prix_livre INTEGER CHECK (prix_livre IS NULL OR prix_livre >= 0),
  statut TEXT NOT NULL DEFAULT 'actif' CHECK (statut IN ('actif', 'retire')),
  retrait_motif TEXT,
  fichier_source TEXT,
  demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS books_owner ON books (owner_id);

CREATE TABLE IF NOT EXISTS chapters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id INTEGER NOT NULL REFERENCES books (id),
  titre TEXT NOT NULL,
  page_de INTEGER NOT NULL,
  page_a INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS chapters_book ON chapters (book_id);

-- Une page : son état de publication. Son TEXTE vit dans page_versions.
CREATE TABLE IF NOT EXISTS pages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id INTEGER NOT NULL REFERENCES books (id),
  n INTEGER NOT NULL,
  acces TEXT NOT NULL CHECK (acces IN ('free', 'paid')),
  statut TEXT NOT NULL CHECK (statut IN ('draft', 'scheduled', 'published')),
  publie_le TEXT,
  source TEXT NOT NULL DEFAULT 'editor' CHECK (source IN ('editor', 'pdf', 'epub', 'docx')),
  created_at TEXT NOT NULL,
  UNIQUE (book_id, n)
);

-- L'historique ne s'écrase pas : chaque correction crée une version ;
-- l'ancienne passe is_current = 0, datée, et reste.
CREATE TABLE IF NOT EXISTS page_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  page_id INTEGER NOT NULL REFERENCES pages (id),
  version INTEGER NOT NULL,
  contenu TEXT NOT NULL,
  is_current INTEGER NOT NULL DEFAULT 1,
  auteur_id INTEGER NOT NULL REFERENCES users (id),
  created_at TEXT NOT NULL,
  remplacee_le TEXT,
  UNIQUE (page_id, version)
);
CREATE INDEX IF NOT EXISTS page_versions_courante ON page_versions (page_id, is_current);

CREATE TABLE IF NOT EXISTS imports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users (id),
  book_id INTEGER NOT NULL REFERENCES books (id),
  nom_fichier TEXT NOT NULL,
  nature TEXT NOT NULL CHECK (nature IN ('pdf', 'epub', 'docx')),
  taille INTEGER NOT NULL,
  empreinte TEXT NOT NULL,
  pages_creees INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS follows (
  user_id INTEGER NOT NULL REFERENCES users (id),
  book_id INTEGER NOT NULL REFERENCES books (id),
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, book_id)
);

CREATE TABLE IF NOT EXISTS progress (
  user_id INTEGER NOT NULL REFERENCES users (id),
  book_id INTEGER NOT NULL REFERENCES books (id),
  page_n INTEGER NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, book_id)
);

CREATE TABLE IF NOT EXISTS signalements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users (id),
  book_id INTEGER NOT NULL REFERENCES books (id),
  motif TEXT NOT NULL,
  etat TEXT NOT NULL DEFAULT 'ouvert' CHECK (etat IN ('ouvert', 'traite', 'rejete')),
  created_at TEXT NOT NULL
);

-- ── Étape 5 : argent ──────────────────────────────────────────────────────
-- États explicites ; UNKNOWN ≠ FAILED. Clé d'idempotence unique PAR
-- ACHETEUR (Klassio : une contrainte globale permettait de bloquer autrui).
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users (id),
  objet TEXT NOT NULL CHECK (objet IN ('page', 'chapitre', 'livre', 'plume')),
  book_id INTEGER REFERENCES books (id),
  page_de INTEGER,
  page_a INTEGER,
  montant INTEGER NOT NULL CHECK (montant > 0),
  devise TEXT NOT NULL DEFAULT 'USD',
  etat TEXT NOT NULL CHECK (etat IN ('CREATED', 'PENDING', 'CONFIRMED', 'FAILED', 'CANCELLED', 'EXPIRED', 'UNKNOWN')),
  idempotency_key TEXT NOT NULL,
  prestataire TEXT,
  operateur TEXT,
  reference TEXT,
  motif_refus TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  confirme_le TEXT,
  confirme_par TEXT,
  UNIQUE (user_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS payments_etat ON payments (etat, created_at);

-- Droits de lecture : écrits UNIQUEMENT à la confirmation, jamais retirés.
-- page_a NULL = jusqu'à la dernière page, présente et à venir (livre entier).
CREATE TABLE IF NOT EXISTS entitlements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users (id),
  book_id INTEGER NOT NULL REFERENCES books (id),
  page_de INTEGER NOT NULL,
  page_a INTEGER,
  payment_id INTEGER NOT NULL UNIQUE REFERENCES payments (id),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS entitlements_user ON entitlements (user_id, book_id);

-- Un reçu n'existe qu'après confirmation réelle ; numéro unique.
CREATE TABLE IF NOT EXISTS receipts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payment_id INTEGER NOT NULL UNIQUE REFERENCES payments (id),
  user_id INTEGER NOT NULL REFERENCES users (id),
  numero TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

-- Registre : chaque vente découpée ; la somme des lignes = le montant payé.
CREATE TABLE IF NOT EXISTS ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payment_id INTEGER NOT NULL REFERENCES payments (id),
  beneficiaire TEXT NOT NULL CHECK (beneficiaire IN ('auteur', 'plateforme', 'frais')),
  author_id INTEGER REFERENCES users (id),
  montant INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ledger_auteur ON ledger (author_id);

CREATE TABLE IF NOT EXISTS payouts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  author_id INTEGER NOT NULL REFERENCES users (id),
  montant INTEGER NOT NULL CHECK (montant > 0),
  operateur TEXT NOT NULL,
  numero TEXT NOT NULL,
  etat TEXT NOT NULL CHECK (etat IN ('DEMANDE', 'PAYE', 'REFUSE')),
  reference TEXT,
  motif TEXT,
  created_at TEXT NOT NULL,
  traite_le TEXT,
  traite_par TEXT
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users (id),
  debut TEXT NOT NULL,
  fin TEXT NOT NULL,
  payment_id INTEGER NOT NULL UNIQUE REFERENCES payments (id)
);

-- Un événement de prestataire n'est traité qu'une fois : un webhook rejoué
-- ne confirme jamais deux fois (bug réel chez Klassio).
CREATE TABLE IF NOT EXISTS webhook_events (
  prestataire TEXT NOT NULL,
  event_id TEXT NOT NULL,
  recu_le TEXT NOT NULL,
  PRIMARY KEY (prestataire, event_id)
);

-- ── Étape 6 : administration de la plateforme (comptes SÉPARÉS) ────────────
CREATE TABLE IF NOT EXISTS admin_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  nom TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  totp_secret TEXT NOT NULL,
  totp_dernier_pas INTEGER NOT NULL DEFAULT 0,
  actif INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id INTEGER NOT NULL REFERENCES admin_users (id),
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT
);

-- ── Index du 16/10/2026 (audit) : les requêtes réellement fréquentes ───────
-- Additifs : IF NOT EXISTS, aucune donnée touchée.
CREATE INDEX IF NOT EXISTS follows_livre ON follows (book_id);                  -- nombre de lecteurs qui suivent
CREATE INDEX IF NOT EXISTS payments_utilisateur ON payments (user_id, id);      -- Mon compte
CREATE INDEX IF NOT EXISTS payments_reference ON payments (operateur, reference); -- une référence = un achat
CREATE INDEX IF NOT EXISTS ledger_paiement ON ledger (payment_id);              -- rapprochement
CREATE INDEX IF NOT EXISTS payouts_auteur ON payouts (author_id, etat);         -- solde de l'auteur
CREATE INDEX IF NOT EXISTS signalements_etat ON signalements (etat, id);        -- file de modération
CREATE INDEX IF NOT EXISTS imports_livre ON imports (book_id);
CREATE INDEX IF NOT EXISTS subscriptions_utilisateur ON subscriptions (user_id, fin);

-- ── Remboursements (16/10/2026) ────────────────────────────────────────────
-- Un remboursement ne MODIFIE rien d'historique : il s'ajoute. Le paiement
-- reste CONFIRMED (il a bien eu lieu) ; le droit de lecture est marqué révoqué
-- (entitlements.revoque_le) ; le registre reçoit des lignes CORRECTRICES
-- négatives. Un paiement ne se rembourse qu'une fois (UNIQUE).
CREATE TABLE IF NOT EXISTS refunds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payment_id INTEGER NOT NULL UNIQUE REFERENCES payments (id),
  user_id INTEGER NOT NULL REFERENCES users (id),
  montant INTEGER NOT NULL CHECK (montant > 0),
  motif TEXT NOT NULL,
  reference TEXT,
  par TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- ── Messages sortants (16/10/2026) ─────────────────────────────────────────
-- File d'envoi : un message est écrit DANS la transaction de l'action qui le
-- cause (rien ne part pour une action annulée), puis expédié après coup, avec
-- nouvelles tentatives. Un code de sécurité est effacé du corps une fois
-- envoyé (sensible = 1) : la base ne garde pas de codes lisibles.
CREATE TABLE IF NOT EXISTS envois (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  canal TEXT NOT NULL CHECK (canal IN ('email', 'push')),
  user_id INTEGER REFERENCES users (id),
  destinataire TEXT NOT NULL,
  sujet TEXT NOT NULL,
  texte TEXT NOT NULL,
  html TEXT,
  lien TEXT,
  sensible INTEGER NOT NULL DEFAULT 0,
  etat TEXT NOT NULL CHECK (etat IN ('capture', 'attente', 'en_cours', 'envoye', 'abandonne')),
  essais INTEGER NOT NULL DEFAULT 0,
  prochain_essai TEXT,
  erreur TEXT,
  created_at TEXT NOT NULL,
  envoye_le TEXT
);
CREATE INDEX IF NOT EXISTS envois_file ON envois (etat, prochain_essai);
CREATE INDEX IF NOT EXISTS envois_utilisateur ON envois (user_id, id);

-- ── Codes à durée limitée (16/10/2026) ────────────────────────────────────
-- Mot de passe oublié ou changé : un code à 6 chiffres, envoyé par e-mail,
-- valable 15 minutes, 5 essais au plus, à usage unique. Seule son empreinte
-- est stockée. Un nouveau code remplace l'ancien.
CREATE TABLE IF NOT EXISTS codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users (id),
  objet TEXT NOT NULL CHECK (objet IN ('reinitialisation', 'changement')),
  empreinte TEXT NOT NULL,
  essais INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS codes_actifs ON codes (user_id, objet, used_at);

-- ── Notifications (16/10/2026) ─────────────────────────────────────────────
-- Une notification est un FAIT adressé à une personne, dédoublonné par `cle`
-- (une même parution, un même paiement ne notifient qu'une fois, même si la
-- tâche tourne deux fois). Les canaux (appareil, e-mail) passent par `envois`.
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users (id),
  type TEXT NOT NULL CHECK (type IN ('parution', 'paiement', 'vente', 'reversement', 'securite', 'plume', 'moderation', 'test', 'communaute', 'abonnements')),
  titre TEXT NOT NULL,
  corps TEXT NOT NULL,
  lien TEXT,
  cle TEXT NOT NULL,
  lu_le TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (user_id, cle)
);
CREATE INDEX IF NOT EXISTS notifications_personne ON notifications (user_id, id);

-- Appareils abonnés aux notifications (Web Push). L'adresse du service de
-- notification est vérifiée à l'inscription : le serveur n'écrit qu'aux
-- services connus (Google, Mozilla, Apple, Microsoft), jamais à une adresse
-- fournie au hasard (sinon : requêtes forgées vers le réseau interne).
CREATE TABLE IF NOT EXISTS appareils (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users (id),
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  libelle TEXT,
  created_at TEXT NOT NULL,
  dernier_succes TEXT
);
CREATE INDEX IF NOT EXISTS appareils_personne ON appareils (user_id);

-- Réglages générés par le serveur lui-même (17/10/2026) : aujourd'hui les clés
-- VAPID quand SOZO_VAPID_AUTO=1. Écrites une fois, jamais par un client ;
-- incluses dans les sauvegardes (chiffrées).
CREATE TABLE IF NOT EXISTS reglages (
  cle TEXT PRIMARY KEY,
  valeur TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- v8 (19/10/2026) : la couverture CRÉÉE par l'auteur (image envoyée depuis son
-- appareil). En base et non sur disque : le disque de Render (offre gratuite)
-- est effacé à chaque redéploiement. Reconnue par son contenu (JPEG, PNG,
-- WebP — jamais de SVG : un SVG peut porter du script). Publique comme le
-- livre : servie seulement si le livre est visible pour la personne.
CREATE TABLE IF NOT EXISTS couvertures (
  book_id INTEGER PRIMARY KEY REFERENCES books (id),
  mime TEXT NOT NULL CHECK (mime IN ('image/jpeg', 'image/png', 'image/webp')),
  donnees TEXT NOT NULL,
  empreinte TEXT NOT NULL,
  taille INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

-- Passages épinglés par un lecteur (mode lecture). Un extrait n'est accepté
-- que s'il figure VRAIMENT dans une page que la personne a le droit de lire.
CREATE TABLE IF NOT EXISTS epingles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users (id),
  book_id INTEGER NOT NULL REFERENCES books (id),
  n INTEGER NOT NULL,
  extrait TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS epingles_personne ON epingles (user_id, book_id);

-- Relectures par l'IA, comptées par personne et par jour (plafond : coût).
CREATE TABLE IF NOT EXISTS ia_usages (
  user_id INTEGER NOT NULL REFERENCES users (id),
  jour TEXT NOT NULL,
  n INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, jour)
);

-- v9 (19/10/2026) : cadeaux de la plateforme. Un livre entier ou 30 jours de
-- Plume OFFERTS par un administrateur (rôle finance, code frais), avec un
-- motif et une trace dans le journal d'audit. Aucun argent : ni paiement, ni
-- reçu, ni revenu pour l'auteur — ce n'est pas une vente. Retirable.
CREATE TABLE IF NOT EXISTS dons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users (id),
  objet TEXT NOT NULL CHECK (objet IN ('livre', 'plume')),
  book_id INTEGER REFERENCES books (id),
  debut TEXT NOT NULL,
  fin TEXT,
  motif TEXT NOT NULL,
  admin_id INTEGER NOT NULL REFERENCES admin_users (id),
  created_at TEXT NOT NULL,
  revoque_le TEXT
);
CREATE INDEX IF NOT EXISTS dons_personne ON dons (user_id, objet);

-- v10 (21/10/2026) : ÉCRITS — poème, récit, conte, pensée, prière. « Sōzō
-- n'est pas seulement des livres : on doit pouvoir publier un récit, un poème,
-- un conte, une phrase » (le propriétaire). Un brouillon n'est vu que par son
-- auteur ; une fois publié, tout compte connecté le lit, l'aime, le garde, le
-- commente. Rien ne s'efface : la corbeille se récupère, la modération retire
-- (retire_le) sans détruire.
CREATE TABLE IF NOT EXISTS ecrits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users (id),
  nature TEXT NOT NULL CHECK (nature IN ('poeme', 'recit', 'conte', 'pensee', 'priere')),
  titre TEXT NOT NULL DEFAULT '',
  texte TEXT NOT NULL,
  apparence TEXT,
  statut TEXT NOT NULL DEFAULT 'brouillon' CHECK (statut IN ('brouillon', 'publie')),
  publie_le TEXT,
  corbeille_le TEXT,
  retire_le TEXT,
  retrait_motif TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ecrits_fil ON ecrits (statut, id);
CREATE INDEX IF NOT EXISTS ecrits_auteur ON ecrits (user_id, id);

-- J'aime et « garder » (épingler un écrit dans sa bibliothèque) : un geste par
-- personne, par écrit et par nature — la clé primaire empêche le double compte.
CREATE TABLE IF NOT EXISTS ecrits_gestes (
  ecrit_id INTEGER NOT NULL REFERENCES ecrits (id),
  user_id INTEGER NOT NULL REFERENCES users (id),
  nature TEXT NOT NULL CHECK (nature IN ('jaime', 'garde')),
  created_at TEXT NOT NULL,
  PRIMARY KEY (ecrit_id, user_id, nature)
);
CREATE INDEX IF NOT EXISTS ecrits_gestes_personne ON ecrits_gestes (user_id, nature, created_at);

-- Un commentaire retiré (par son auteur, par l'auteur de l'écrit ou par la
-- modération) disparaît de l'écran mais reste en base, daté, avec qui l'a retiré.
CREATE TABLE IF NOT EXISTS ecrits_commentaires (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ecrit_id INTEGER NOT NULL REFERENCES ecrits (id),
  user_id INTEGER NOT NULL REFERENCES users (id),
  texte TEXT NOT NULL,
  created_at TEXT NOT NULL,
  retire_le TEXT,
  retire_par TEXT CHECK (retire_par IS NULL OR retire_par IN ('commentateur', 'auteur', 'moderation'))
);
CREATE INDEX IF NOT EXISTS ecrits_commentaires_fil ON ecrits_commentaires (ecrit_id, id);

CREATE TABLE IF NOT EXISTS signalements_ecrits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users (id),
  ecrit_id INTEGER NOT NULL REFERENCES ecrits (id),
  commentaire_id INTEGER REFERENCES ecrits_commentaires (id),
  motif TEXT NOT NULL,
  etat TEXT NOT NULL DEFAULT 'ouvert' CHECK (etat IN ('ouvert', 'traite', 'rejete')),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS signalements_ecrits_etat ON signalements_ecrits (etat, id);

-- Lot C (21/10/2026) : suivre un AUTEUR (pas seulement un livre). Une ligne par
-- personne et par auteur ; on ne se suit pas soi-même (refusé par le serveur).
CREATE TABLE IF NOT EXISTS abonnements (
  user_id INTEGER NOT NULL REFERENCES users (id),
  auteur_id INTEGER NOT NULL REFERENCES users (id),
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, auteur_id)
);
CREATE INDEX IF NOT EXISTS abonnements_auteur ON abonnements (auteur_id);

-- Lot D (21/10/2026) : versets gardés (synchronisés d'un appareil à l'autre)
-- et marque-pages d'un livre (posés seulement sur une page lisible).
CREATE TABLE IF NOT EXISTS versets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users (id),
  b INTEGER NOT NULL, c INTEGER NOT NULL, v1 INTEGER NOT NULL, v2 INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (user_id, b, c, v1, v2)
);
CREATE TABLE IF NOT EXISTS signets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users (id),
  book_id INTEGER NOT NULL REFERENCES books (id),
  n INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (user_id, book_id, n)
);

-- Backlog (21/10/2026) : avis sur les livres — une note de 1 à 5 et quelques
-- lignes, un avis par personne et par livre ; la modération retire sans détruire.
CREATE TABLE IF NOT EXISTS avis (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users (id),
  book_id INTEGER NOT NULL REFERENCES books (id),
  note INTEGER NOT NULL CHECK (note BETWEEN 1 AND 5),
  texte TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  modifie_le TEXT,
  retire_le TEXT,
  UNIQUE (user_id, book_id)
);
CREATE INDEX IF NOT EXISTS avis_livre ON avis (book_id, id);
