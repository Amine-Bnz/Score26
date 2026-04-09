// Service football-data.org
// Tier gratuit : 10 req/min, pas de cap journalier, CDM 2026 couverte
// Doc : https://docs.football-data.org/general/v4/index.html

const logger = require('../logger');
const BASE = 'https://api.football-data.org/v4';

// Mapping noms anglais football-data.org → noms français + emoji stockés en base
// football-data.org retourne des noms en anglais, parfois avec des variantes
const TEAM_MAP = {
  'United States':        '🇺🇸 États-Unis',
  'USA':                  '🇺🇸 États-Unis',
  'Portugal':             '🇵🇹 Portugal',
  'Mali':                 '🇲🇱 Mali',
  'Canada':               '🇨🇦 Canada',
  'Belgium':              '🇧🇪 Belgique',
  'Morocco':              '🇲🇦 Maroc',
  'Mexico':               '🇲🇽 Mexique',
  'Austria':              '🇦🇹 Autriche',
  'Senegal':              '🇸🇳 Sénégal',
  'Argentina':            '🇦🇷 Argentine',
  'France':               '🇫🇷 France',
  'Japan':                '🇯🇵 Japon',
  'Brazil':               '🇧🇷 Brésil',
  'Germany':              '🇩🇪 Allemagne',
  'Saudi Arabia':         '🇸🇦 Arabie Saoudite',
  'Colombia':             '🇨🇴 Colombie',
  'Spain':                '🇪🇸 Espagne',
  'Australia':            '🇦🇺 Australie',
  'Uruguay':              '🇺🇾 Uruguay',
  'Netherlands':          '🇳🇱 Pays-Bas',
  'Cameroon':             '🇨🇲 Cameroun',
  'Ecuador':              '🇪🇨 Équateur',
  'Italy':                '🇮🇹 Italie',
  'Iran':                 '🇮🇷 Iran',
  'IR Iran':              '🇮🇷 Iran',
  'Venezuela':            '🇻🇪 Venezuela',
  'Poland':               '🇵🇱 Pologne',
  'Nigeria':              '🇳🇬 Nigeria',
  'Panama':               '🇵🇦 Panama',
  'Croatia':              '🇭🇷 Croatie',
  'Korea Republic':       '🇰🇷 Corée du Sud',
  'South Korea':          '🇰🇷 Corée du Sud',
  'Costa Rica':           '🇨🇷 Costa Rica',
  'Denmark':              '🇩🇰 Danemark',
  'Egypt':                '🇪🇬 Égypte',
  'Honduras':             '🇭🇳 Honduras',
  'Serbia':               '🇷🇸 Serbie',
  'Qatar':                '🇶🇦 Qatar',
  'Bolivia':              '🇧🇴 Bolivie',
  'Switzerland':          '🇨🇭 Suisse',
  "Côte d'Ivoire":        "🇨🇮 Côte d'Ivoire",
  "Ivory Coast":          "🇨🇮 Côte d'Ivoire",
  'Indonesia':            '🇮🇩 Indonésie',
  'England':              '🏴󠁧󠁢󠁥󠁮󠁧󠁿 Angleterre',
  'Algeria':              '🇩🇿 Algérie',
  'New Zealand':          '🇳🇿 Nouvelle-Zélande',
  'Scotland':             '🏴󠁧󠁢󠁳󠁣󠁴󠁿 Écosse',
  'Tunisia':              '🇹🇳 Tunisie',
  'Turkey':               '🇹🇷 Turquie',
  'Türkiye':              '🇹🇷 Turquie',
  'Iraq':                 '🇮🇶 Irak',
  'Uzbekistan':           '🇺🇿 Ouzbékistan',
};

// Appel générique à l'API football-data.org
async function fetchFD(endpoint) {
  const key = process.env.FOOTBALL_DATA_KEY;
  if (!key || key === 'your_key_here') {
    throw new Error('FOOTBALL_DATA_KEY non configurée dans .env');
  }

  const res = await fetch(`${BASE}${endpoint}`, {
    headers: { 'X-Auth-Token': key },
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    throw new Error(`football-data.org erreur ${res.status} sur ${endpoint}`);
  }
  return res.json();
}

// ── syncCalendrier ────────────────────────────────────────────────────────────
// Récupère les matchs CDM 2026 depuis football-data.org et met à jour :
//   - api_match_id (pour faire le lien avec API-Football lors du live)
//   - date_coup_envoi (dates officielles, plus précises que le seed approximatif)
async function syncCalendrier(db) {
  const data = await fetchFD('/competitions/WC/matches?season=2026');
  const matchsAPI = data.matches ?? [];

  let mis_a_jour = 0;
  for (const m of matchsAPI) {
    const nomA = TEAM_MAP[m.homeTeam.name] ?? TEAM_MAP[m.homeTeam.shortName];
    const nomB = TEAM_MAP[m.awayTeam.name] ?? TEAM_MAP[m.awayTeam.shortName];
    if (!nomA || !nomB) {
      logger.warn(`[sync] Équipe inconnue : "${m.homeTeam.name}" ou "${m.awayTeam.name}"`);
      continue;
    }

    // Cherche le match en base par les deux noms d'équipe
    const match = db.prepare(
      'SELECT id FROM matchs WHERE equipe_a = ? AND equipe_b = ?'
    ).get(nomA, nomB);

    if (!match) {
      logger.warn(`[sync] Match introuvable en base : ${nomA} vs ${nomB}`);
      continue;
    }

    // Convertit la date UTC de l'API ("2026-06-11T22:00:00Z") au format SQLite
    const dateSQLite = m.utcDate.replace('T', ' ').replace('Z', '');

    db.prepare(
      'UPDATE matchs SET api_match_id = ?, date_coup_envoi = ? WHERE id = ?'
    ).run(m.id, dateSQLite, match.id);

    mis_a_jour++;
  }

  logger.info(`[sync calendrier] ${mis_a_jour}/${matchsAPI.length} matchs mis à jour`);
  return mis_a_jour;
}

// ── syncResultats ─────────────────────────────────────────────────────────────
// Récupère les matchs terminés et met à jour les scores en base.
// Déclenche le calcul des points automatiquement via la fonction calculerPoints.
async function syncResultats(db, { calculerPoints, envoyerNotifResultat, resoudreChallenges, envoyerRecapJournee }) {
  const data = await fetchFD('/competitions/WC/matches?season=2026&status=FINISHED');
  const matchsTermines = data.matches ?? [];

  let mis_a_jour = 0;
  const journeesAVerifier = new Set();

  for (const m of matchsTermines) {
    // Ne traiter que les matchs qu'on a liés via api_match_id
    const match = db.prepare(
      'SELECT id, score_reel_a, journee FROM matchs WHERE api_match_id = ?'
    ).get(m.id);

    if (!match) continue;
    if (match.score_reel_a !== null) continue; // déjà traité

    const scoreA = m.score.fullTime.home;
    const scoreB = m.score.fullTime.away;
    if (scoreA === null || scoreB === null) continue;

    db.prepare(
      "UPDATE matchs SET score_reel_a = ?, score_reel_b = ?, statut = 'termine' WHERE id = ?"
    ).run(scoreA, scoreB, match.id);

    calculerPoints(match.id);
    if (resoudreChallenges) resoudreChallenges(match.id);
    if (envoyerNotifResultat) {
      envoyerNotifResultat(db, match.id).catch(e => logger.error({ err: e }, '[sync résultats] erreur notif résultat'));
    }
    if (match.journee) journeesAVerifier.add(match.journee);
    mis_a_jour++;
    logger.info(`[sync résultats] Match ${match.id} terminé : ${scoreA}-${scoreB}`);
  }

  // Vérifier si des journées sont complètement terminées → envoyer récap
  if (envoyerRecapJournee) {
    for (const journee of journeesAVerifier) {
      envoyerRecapJournee(db, journee).catch(e => logger.error({ err: e }, `[sync résultats] erreur récap journée ${journee}`));
    }
  }

  logger.info(`[sync résultats] ${mis_a_jour} nouveau(x) résultat(s) enregistré(s)`);
  return mis_a_jour;
}

module.exports = { syncCalendrier, syncResultats, TEAM_MAP };
