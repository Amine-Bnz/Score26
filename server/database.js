const Database = require('better-sqlite3');
const path = require('path');

// En prod (Fly.io) : DATABASE_PATH=/data/score26.db (volume persistant)
// En dev : fichier local dans le dossier server/
const db = new Database(process.env.DATABASE_PATH || path.join(__dirname, 'score26.db'));

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

  CREATE TABLE IF NOT EXISTS push_subscriptions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint   TEXT NOT NULL UNIQUE,
    p256dh     TEXT NOT NULL,
    auth       TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS notifs_envoyees (
    user_id  TEXT    NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
    match_id INTEGER NOT NULL REFERENCES matchs(id) ON DELETE CASCADE,
    sent_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, match_id)
  );

  CREATE TABLE IF NOT EXISTS friendships (
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    friend_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, friend_id)
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
  // v3 friend code
  "ALTER TABLE users ADD COLUMN friend_code TEXT",
  // v3 accounts
  "ALTER TABLE users ADD COLUMN email TEXT",
  "ALTER TABLE users ADD COLUMN password_hash TEXT",
  // v4 notif delay
  "ALTER TABLE push_subscriptions ADD COLUMN notif_delay INTEGER DEFAULT 60",
];
for (const sql of migrations) {
  try { db.exec(sql) } catch (_) { /* colonne déjà présente */ }
}

// Index unique sur friend_code (idempotent)
try { db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_friend_code ON users(friend_code)') } catch (_) {}

// Générer un friend_code pour les users existants sans code
function generateFriendCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sans I/O/0/1 pour éviter confusion
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

const usersWithoutCode = db.prepare('SELECT id FROM users WHERE friend_code IS NULL').all();
if (usersWithoutCode.length > 0) {
  const update = db.prepare('UPDATE users SET friend_code = ? WHERE id = ?');
  const existing = new Set(db.prepare('SELECT friend_code FROM users WHERE friend_code IS NOT NULL').all().map(r => r.friend_code));
  db.transaction(() => {
    for (const u of usersWithoutCode) {
      let code;
      do { code = generateFriendCode(); } while (existing.has(code));
      existing.add(code);
      update.run(code, u.id);
    }
  })();
}

// Tables v3 : groupes privés
db.exec(`
  CREATE TABLE IF NOT EXISTS groups_ (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    invite_code TEXT UNIQUE NOT NULL,
    owner_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS group_members (
    group_id   TEXT NOT NULL REFERENCES groups_(id) ON DELETE CASCADE,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (group_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS notifs_resultats (
    user_id  TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    match_id INTEGER NOT NULL REFERENCES matchs(id) ON DELETE CASCADE,
    sent_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, match_id)
  );
`);

// Table v4 : défis 1v1
db.exec(`
  CREATE TABLE IF NOT EXISTS challenges (
    id             TEXT PRIMARY KEY,
    challenger_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    opponent_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    match_id       INTEGER NOT NULL REFERENCES matchs(id) ON DELETE CASCADE,
    status         TEXT NOT NULL DEFAULT 'pending',
    winner_id      TEXT,
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS bonus_pronos (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type           TEXT NOT NULL,
    value          TEXT NOT NULL,
    points_obtenus INTEGER,
    locked         INTEGER NOT NULL DEFAULT 0,
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, type)
  );
`);

db.generateFriendCode = generateFriendCode;

module.exports = db;
