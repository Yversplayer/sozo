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
