// Backup SQLite — copie atomique de la base vers un fichier horodaté
// Usage : node backup.js
// En prod (Fly.io) : fly ssh console -C "node backup.js"
// Le backup est créé dans le même répertoire que la base (volume /data/ en prod)

require('dotenv').config();
const path = require('path');
const db   = require('./database');

const dbPath   = process.env.DATABASE_PATH || path.join(__dirname, 'score26.db');
const dir      = path.dirname(dbPath);
const ts       = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const dest     = path.join(dir, `score26-backup-${ts}.db`);

async function main() {
  console.log(`Backup de ${dbPath} vers ${dest}...`);
  await db.backup(dest);
  console.log(`Backup terminé : ${dest}`);
}

main().catch(err => {
  console.error('Erreur backup :', err.message);
  process.exit(1);
});
