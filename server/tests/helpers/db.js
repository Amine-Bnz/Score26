'use strict';
const Database = require('better-sqlite3');

// Crée une BDD SQLite in-memory avec le même schéma que database.js
// Utilisée par les tests pour repartir d'un état vide, sans toucher score26.db
function createTestDb() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE users (
      id          TEXT PRIMARY KEY,
      pseudo      TEXT UNIQUE NOT NULL,
      avatar_seed TEXT NOT NULL,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE matchs (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      equipe_a         TEXT NOT NULL DEFAULT 'A',
      equipe_b         TEXT NOT NULL DEFAULT 'B',
      date_coup_envoi  DATETIME NOT NULL,
      score_reel_a     INTEGER,
      score_reel_b     INTEGER,
      phase            TEXT NOT NULL DEFAULT 'groupe',
      journee          INTEGER NOT NULL DEFAULT 1,
      groupe           TEXT,
      statut           TEXT NOT NULL DEFAULT 'a_venir',
      api_match_id     INTEGER,
      score_live_a     INTEGER,
      score_live_b     INTEGER,
      minute_live      INTEGER
    );

    CREATE TABLE pronos (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id         TEXT    NOT NULL REFERENCES users(id),
      match_id        INTEGER NOT NULL REFERENCES matchs(id),
      score_predit_a  INTEGER NOT NULL,
      score_predit_b  INTEGER NOT NULL,
      points_obtenus  INTEGER,
      verrouille      INTEGER NOT NULL DEFAULT 0,
      UNIQUE(user_id, match_id)
    );
  `);

  return db;
}

module.exports = { createTestDb };
