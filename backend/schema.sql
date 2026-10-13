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
