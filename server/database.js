const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'score26.db'));

db.pragma('foreign_keys = ON');

// Création des tables (schéma complet v2)
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id         TEXT PRIMARY KEY,
    pseudo     TEXT UNIQUE NOT NULL,
    avatar_seed TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS matchs (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    equipe_a         TEXT NOT NULL,
    equipe_b         TEXT NOT NULL,
    date_coup_envoi  DATETIME NOT NULL,
    score_reel_a     INTEGER,
    score_reel_b     INTEGER,
    phase            TEXT NOT NULL DEFAULT 'groupe',
    journee          INTEGER NOT NULL,
    groupe           TEXT,
    statut           TEXT NOT NULL DEFAULT 'a_venir',
    api_match_id     INTEGER
  );

  CREATE TABLE IF NOT EXISTS pronos (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         TEXT NOT NULL REFERENCES users(id),
    match_id        INTEGER NOT NULL REFERENCES matchs(id),
    score_predit_a  INTEGER NOT NULL,
    score_predit_b  INTEGER NOT NULL,
    points_obtenus  INTEGER,
    verrouille      INTEGER NOT NULL DEFAULT 0,
    UNIQUE(user_id, match_id)
  );
`);

// Migrations v2 — ajout des colonnes sur une BDD existante sans les colonnes v2
// SQLite lance une erreur si la colonne existe déjà, le try/catch l'ignore proprement
const migrations = [
  "ALTER TABLE matchs ADD COLUMN groupe TEXT",
  "ALTER TABLE matchs ADD COLUMN statut TEXT NOT NULL DEFAULT 'a_venir'",
  "ALTER TABLE matchs ADD COLUMN api_match_id INTEGER",
  // v2 live
  "ALTER TABLE matchs ADD COLUMN score_live_a INTEGER",
  "ALTER TABLE matchs ADD COLUMN score_live_b INTEGER",
  "ALTER TABLE matchs ADD COLUMN minute_live INTEGER",
];
for (const sql of migrations) {
  try { db.exec(sql) } catch (_) { /* colonne déjà présente */ }
}

module.exports = db;
