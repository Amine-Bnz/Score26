const db = require('./database');

// Supprime les matchs existants pour éviter les doublons
db.prepare('DELETE FROM matchs').run();

// Insertion de 3 matchs fictifs pour tester
// Un match passé (score réel renseigné), un à venir, un verrouillé sans score
const insertMatch = db.prepare(`
  INSERT INTO matchs (equipe_a, equipe_b, date_coup_envoi, score_reel_a, score_reel_b, phase, journee)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

insertMatch.run('🇫🇷 France', '🇧🇷 Brésil', '2026-06-15 21:00:00', 2, 1, 'groupe', 1);
insertMatch.run('🇩🇪 Allemagne', '🇦🇷 Argentine', '2026-06-16 18:00:00', null, null, 'groupe', 1);
insertMatch.run('🇵🇹 Portugal', '🇪🇸 Espagne', '2026-03-20 20:00:00', 1, 1, 'groupe', 1);

console.log('Seed terminé — 3 matchs insérés.');
db.close();
