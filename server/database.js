const Database = require('better-sqlite3');
const path = require('path');

// Initialisation de la base de données SQLite
const db = new Database(path.join(__dirname, 'score26.db'));

// Activation des clés étrangères
db.pragma('foreign_keys = ON');

// Création des tables si elles n'existent pas
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    pseudo TEXT UNIQUE NOT NULL,
    avatar_seed TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS matchs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    equipe_a TEXT NOT NULL,
    equipe_b TEXT NOT NULL,
    date_coup_envoi DATETIME NOT NULL,
    score_reel_a INTEGER,
    score_reel_b INTEGER,
    phase TEXT NOT NULL DEFAULT 'groupe',
    journee INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS pronos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL REFERENCES users(id),
    match_id INTEGER NOT NULL REFERENCES matchs(id),
    score_predit_a INTEGER NOT NULL,
    score_predit_b INTEGER NOT NULL,
    points_obtenus INTEGER,
    verrouille INTEGER NOT NULL DEFAULT 0,
    UNIQUE(user_id, match_id)
  );
`);

module.exports = db;
