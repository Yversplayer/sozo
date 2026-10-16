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
