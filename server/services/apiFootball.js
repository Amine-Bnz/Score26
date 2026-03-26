// Service API-Football (api-football.com)
// Tier gratuit : 100 req/jour — utilisé UNIQUEMENT quand un match est en cours
// World Cup 2026 : league_id = 1, season = 2026
// Doc : https://www.api-football.com/documentation-v3

const BASE = 'https://v3.football.api-sports.io';
const WC_LEAGUE_ID = 1;
const WC_SEASON    = 2026;

// Statuts API-Football qui signifient "match terminé"
const STATUTS_TERMINES = new Set(['FT', 'AET', 'PEN', 'AWD', 'WO']);
// Statuts qui signifient "match en cours" (y compris mi-temps et prolongations)
const STATUTS_EN_COURS = new Set(['1H', 'HT', '2H', 'ET', 'BT', 'P', 'INT']);

async function fetchAF(endpoint) {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key || key === 'your_key_here') {
    throw new Error('API_FOOTBALL_KEY non configurée dans .env');
  }
  const res = await fetch(`${BASE}${endpoint}`, {
    headers: { 'x-apisports-key': key },
  });
  if (!res.ok) throw new Error(`API-Football erreur ${res.status} sur ${endpoint}`);
  return res.json();
}

// Vérifie si un match CDM 2026 est potentiellement en cours en ce moment
// Critère : date_coup_envoi entre maintenant-120min et maintenant+10min
// Ou statut déjà "en_cours" en base
// → Si faux, on n'appelle pas l'API (économise les 100 req/jour)
function matchEnCoursProbable(db) {
  const maintenant  = Date.now();
  const debutFenetre = new Date(maintenant - 120 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
  const finFenetre   = new Date(maintenant +  10 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');

  const trouve = db.prepare(`
    SELECT id FROM matchs
    WHERE statut = 'en_cours'
       OR (date_coup_envoi BETWEEN ? AND ? AND statut = 'a_venir')
    LIMIT 1
  `).get(debutFenetre, finFenetre);

  return !!trouve;
}

// ── syncLive ──────────────────────────────────────────────────────────────────
// Appelé toutes les 3 minutes depuis index.js
// Récupère les fixtures CDM 2026 en direct et met à jour score_live + minute + statut
async function syncLive(db) {
  // Vérification préalable : ne pas gaspiller les 100 req/jour si aucun match en cours
  if (!matchEnCoursProbable(db)) {
    return 0;
  }

  const data = await fetchAF(
    `/fixtures?live=all&league=${WC_LEAGUE_ID}&season=${WC_SEASON}`
  );
  const fixtures = data.response ?? [];

  if (fixtures.length === 0) {
    // Plus rien en live — remettre "en_cours" → "a_venir" si le score live est null
    // (cas où le match n'a pas encore commencé malgré la fenêtre temporelle)
    return 0;
  }

  let mis_a_jour = 0;
  for (const f of fixtures) {
    const match = db.prepare(
      'SELECT id, score_reel_a FROM matchs WHERE api_match_id = ?'
    ).get(f.fixture.id);
    if (!match) continue;

    const statusShort = f.fixture.status.short;
    const minute      = f.fixture.status.elapsed;
    const scoreA      = f.goals.home ?? 0;
    const scoreB      = f.goals.away ?? 0;

    if (STATUTS_TERMINES.has(statusShort)) {
      // Match terminé côté API-Football
      // On met les scores live à jour — syncResultats (football-data.org) finalisera proprement
      db.prepare(`
        UPDATE matchs
        SET statut = 'termine', score_live_a = ?, score_live_b = ?, minute_live = NULL
        WHERE id = ?
      `).run(scoreA, scoreB, match.id);

    } else if (STATUTS_EN_COURS.has(statusShort)) {
      db.prepare(`
        UPDATE matchs
        SET statut = 'en_cours', score_live_a = ?, score_live_b = ?, minute_live = ?
        WHERE id = ?
      `).run(scoreA, scoreB, minute, match.id);
    }

    mis_a_jour++;
  }

  console.log(`[sync live] ${fixtures.length} match(s) en direct → ${mis_a_jour} mis à jour`);
  return mis_a_jour;
}

module.exports = { syncLive };
