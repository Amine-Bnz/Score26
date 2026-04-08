const db = require('./database');
const logger = require('./logger');

function runSeed() {
  // ─── Remise à zéro ────────────────────────────────────────────────────────────
  // Les pronos référencent les matchs (FK), on les supprime en premier
  db.prepare('DELETE FROM pronos').run();
  db.prepare('DELETE FROM matchs').run();
  db.prepare("DELETE FROM sqlite_sequence WHERE name = 'matchs'").run();
  db.prepare("DELETE FROM sqlite_sequence WHERE name = 'pronos'").run();

  // ─── Insertion ────────────────────────────────────────────────────────────────
  const insert = db.prepare(`
    INSERT INTO matchs (equipe_a, equipe_b, date_coup_envoi, phase, journee, groupe, statut)
    VALUES (@a, @b, @date, 'groupe', @j, @g, 'a_venir')
  `);

  const seedAll = db.transaction((matchs) => {
    for (const m of matchs) insert.run(m);
  });

// Format des dates : heure UTC stockée en base
// Heures source : Yahoo Sports (heure ET = UTC-4 en été) → converties en UTC (+4h)
//
// CDM 2026 : 48 équipes, 12 groupes de 4 (A–L), 6 matchs par groupe = 72 matchs
// Journée 3 : matchs simultanés pour équité sportive
//
// Toutes les équipes qualifiées (mis à jour le 1er avril 2026) :
// Barrages UEFA : Bosnie (A), Suède (B), Turquie (C), Tchéquie (D)
// Barrages FIFA : RD Congo (1/Groupe K), Irak (2/Groupe I)

const matchs = [
  // ── GROUPE A : Mexique · Afrique du Sud · Corée du Sud · Tchéquie ───────────
  { g:'A', j:1, a:'🇲🇽 Mexique',         b:'🇿🇦 Afrique du Sud',  date:'2026-06-11 19:00:00' },
  { g:'A', j:1, a:'🇰🇷 Corée du Sud',    b:'🇨🇿 Tchéquie',   date:'2026-06-12 02:00:00' },
  { g:'A', j:2, a:'🇨🇿 Tchéquie',   b:'🇿🇦 Afrique du Sud',  date:'2026-06-18 16:00:00' },
  { g:'A', j:2, a:'🇲🇽 Mexique',         b:'🇰🇷 Corée du Sud',    date:'2026-06-19 01:00:00' },
  { g:'A', j:3, a:'🇨🇿 Tchéquie',   b:'🇲🇽 Mexique',         date:'2026-06-25 01:00:00' },
  { g:'A', j:3, a:'🇿🇦 Afrique du Sud',  b:'🇰🇷 Corée du Sud',    date:'2026-06-25 01:00:00' },

  // ── GROUPE B : Canada · Bosnie · Qatar · Suisse ──────────────────────────
  { g:'B', j:1, a:'🇨🇦 Canada',          b:'🇧🇦 Bosnie',   date:'2026-06-12 19:00:00' },
  { g:'B', j:1, a:'🇶🇦 Qatar',           b:'🇨🇭 Suisse',          date:'2026-06-13 19:00:00' },
  { g:'B', j:2, a:'🇨🇭 Suisse',          b:'🇧🇦 Bosnie',   date:'2026-06-18 19:00:00' },
  { g:'B', j:2, a:'🇨🇦 Canada',          b:'🇶🇦 Qatar',           date:'2026-06-18 22:00:00' },
  { g:'B', j:3, a:'🇨🇭 Suisse',          b:'🇨🇦 Canada',          date:'2026-06-24 19:00:00' },
  { g:'B', j:3, a:'🇧🇦 Bosnie',   b:'🇶🇦 Qatar',           date:'2026-06-24 19:00:00' },

  // ── GROUPE C : Brésil · Maroc · Haïti · Écosse ──────────────────────────
  { g:'C', j:1, a:'🇧🇷 Brésil',          b:'🇲🇦 Maroc',           date:'2026-06-13 22:00:00' },
  { g:'C', j:1, a:'🇭🇹 Haïti',           b:'🏴󠁧󠁢󠁳󠁣󠁴󠁿 Écosse',          date:'2026-06-14 01:00:00' },
  { g:'C', j:2, a:'🏴󠁧󠁢󠁳󠁣󠁴󠁿 Écosse',         b:'🇲🇦 Maroc',           date:'2026-06-19 22:00:00' },
  { g:'C', j:2, a:'🇧🇷 Brésil',          b:'🇭🇹 Haïti',           date:'2026-06-20 01:00:00' },
  { g:'C', j:3, a:'🏴󠁧󠁢󠁳󠁣󠁴󠁿 Écosse',         b:'🇧🇷 Brésil',          date:'2026-06-24 22:00:00' },
  { g:'C', j:3, a:'🇲🇦 Maroc',           b:'🇭🇹 Haïti',           date:'2026-06-24 22:00:00' },

  // ── GROUPE D : États-Unis · Paraguay · Australie · Turquie ──────────────
  { g:'D', j:1, a:'🇺🇸 États-Unis',      b:'🇵🇾 Paraguay',        date:'2026-06-13 01:00:00' },
  { g:'D', j:1, a:'🇦🇺 Australie',       b:'🇹🇷 Turquie',   date:'2026-06-13 04:00:00' },
  { g:'D', j:2, a:'🇹🇷 Turquie',   b:'🇵🇾 Paraguay',        date:'2026-06-19 04:00:00' },
  { g:'D', j:2, a:'🇺🇸 États-Unis',      b:'🇦🇺 Australie',       date:'2026-06-19 19:00:00' },
  { g:'D', j:3, a:'🇹🇷 Turquie',   b:'🇺🇸 États-Unis',      date:'2026-06-26 02:00:00' },
  { g:'D', j:3, a:'🇵🇾 Paraguay',        b:'🇦🇺 Australie',       date:'2026-06-26 02:00:00' },

  // ── GROUPE E : Allemagne · Curaçao · Côte d'Ivoire · Équateur ─────────────
  { g:'E', j:1, a:'🇩🇪 Allemagne',       b:"🇨🇼 Curaçao",         date:'2026-06-14 17:00:00' },
  { g:'E', j:1, a:"🇨🇮 Côte d'Ivoire",  b:'🇪🇨 Équateur',        date:'2026-06-14 23:00:00' },
  { g:'E', j:2, a:'🇩🇪 Allemagne',       b:"🇨🇮 Côte d'Ivoire",  date:'2026-06-20 20:00:00' },
  { g:'E', j:2, a:'🇪🇨 Équateur',        b:"🇨🇼 Curaçao",         date:'2026-06-21 00:00:00' },
  { g:'E', j:3, a:"🇨🇼 Curaçao",         b:"🇨🇮 Côte d'Ivoire",  date:'2026-06-25 20:00:00' },
  { g:'E', j:3, a:'🇪🇨 Équateur',        b:'🇩🇪 Allemagne',       date:'2026-06-25 20:00:00' },

  // ── GROUPE F : Pays-Bas · Japon · Suède · Tunisie ────────────────────────
  { g:'F', j:1, a:'🇳🇱 Pays-Bas',        b:'🇯🇵 Japon',           date:'2026-06-14 20:00:00' },
  { g:'F', j:1, a:'🇸🇪 Suède',   b:'🇹🇳 Tunisie',         date:'2026-06-15 02:00:00' },
  { g:'F', j:2, a:'🇳🇱 Pays-Bas',        b:'🇸🇪 Suède',   date:'2026-06-20 17:00:00' },
  { g:'F', j:2, a:'🇹🇳 Tunisie',         b:'🇯🇵 Japon',           date:'2026-06-20 04:00:00' },
  { g:'F', j:3, a:'🇯🇵 Japon',           b:'🇸🇪 Suède',   date:'2026-06-25 23:00:00' },
  { g:'F', j:3, a:'🇹🇳 Tunisie',         b:'🇳🇱 Pays-Bas',        date:'2026-06-25 23:00:00' },

  // ── GROUPE G : Belgique · Égypte · Iran · Nouvelle-Zélande ───────────────
  { g:'G', j:1, a:'🇧🇪 Belgique',        b:'🇪🇬 Égypte',          date:'2026-06-15 19:00:00' },
  { g:'G', j:1, a:'🇮🇷 Iran',            b:'🇳🇿 Nouvelle-Zélande',date:'2026-06-16 01:00:00' },
  { g:'G', j:2, a:'🇧🇪 Belgique',        b:'🇮🇷 Iran',            date:'2026-06-21 19:00:00' },
  { g:'G', j:2, a:'🇳🇿 Nouvelle-Zélande',b:'🇪🇬 Égypte',          date:'2026-06-22 01:00:00' },
  { g:'G', j:3, a:'🇪🇬 Égypte',          b:'🇮🇷 Iran',            date:'2026-06-27 03:00:00' },
  { g:'G', j:3, a:'🇳🇿 Nouvelle-Zélande',b:'🇧🇪 Belgique',        date:'2026-06-27 03:00:00' },

  // ── GROUPE H : Espagne · Cap-Vert · Arabie Saoudite · Uruguay ────────────
  { g:'H', j:1, a:'🇪🇸 Espagne',         b:'🇨🇻 Cap-Vert',        date:'2026-06-15 16:00:00' },
  { g:'H', j:1, a:'🇸🇦 Arabie Saoudite', b:'🇺🇾 Uruguay',         date:'2026-06-15 22:00:00' },
  { g:'H', j:2, a:'🇪🇸 Espagne',         b:'🇸🇦 Arabie Saoudite', date:'2026-06-21 16:00:00' },
  { g:'H', j:2, a:'🇺🇾 Uruguay',         b:'🇨🇻 Cap-Vert',        date:'2026-06-21 22:00:00' },
  { g:'H', j:3, a:'🇨🇻 Cap-Vert',        b:'🇸🇦 Arabie Saoudite', date:'2026-06-27 00:00:00' },
  { g:'H', j:3, a:'🇺🇾 Uruguay',         b:'🇪🇸 Espagne',         date:'2026-06-27 00:00:00' },

  // ── GROUPE I : France · Sénégal · Norvège · Irak ─────────────────────────
  { g:'I', j:1, a:'🇫🇷 France',          b:'🇸🇳 Sénégal',         date:'2026-06-16 19:00:00' },
  { g:'I', j:1, a:'🇮🇶 Irak',   b:'🇳🇴 Norvège',         date:'2026-06-16 22:00:00' },
  { g:'I', j:2, a:'🇫🇷 France',          b:'🇮🇶 Irak',   date:'2026-06-22 21:00:00' },
  { g:'I', j:2, a:'🇳🇴 Norvège',         b:'🇸🇳 Sénégal',         date:'2026-06-23 00:00:00' },
  { g:'I', j:3, a:'🇳🇴 Norvège',         b:'🇫🇷 France',          date:'2026-06-26 19:00:00' },
  { g:'I', j:3, a:'🇸🇳 Sénégal',         b:'🇮🇶 Irak',   date:'2026-06-26 19:00:00' },

  // ── GROUPE J : Argentine · Algérie · Autriche · Jordanie ─────────────────
  { g:'J', j:1, a:'🇦🇹 Autriche',        b:'🇯🇴 Jordanie',        date:'2026-06-16 04:00:00' },
  { g:'J', j:1, a:'🇦🇷 Argentine',       b:'🇩🇿 Algérie',         date:'2026-06-17 01:00:00' },
  { g:'J', j:2, a:'🇦🇷 Argentine',       b:'🇦🇹 Autriche',        date:'2026-06-22 17:00:00' },
  { g:'J', j:2, a:'🇯🇴 Jordanie',        b:'🇩🇿 Algérie',         date:'2026-06-23 03:00:00' },
  { g:'J', j:3, a:'🇯🇴 Jordanie',        b:'🇦🇷 Argentine',       date:'2026-06-28 02:00:00' },
  { g:'J', j:3, a:'🇩🇿 Algérie',         b:'🇦🇹 Autriche',        date:'2026-06-28 02:00:00' },

  // ── GROUPE K : Portugal · RD Congo · Ouzbékistan · Colombie ─────────────
  { g:'K', j:1, a:'🇵🇹 Portugal',        b:'🇨🇩 RD Congo',   date:'2026-06-17 17:00:00' },
  { g:'K', j:1, a:'🇺🇿 Ouzbékistan',     b:'🇨🇴 Colombie',        date:'2026-06-18 02:00:00' },
  { g:'K', j:2, a:'🇵🇹 Portugal',        b:'🇺🇿 Ouzbékistan',     date:'2026-06-23 17:00:00' },
  { g:'K', j:2, a:'🇨🇴 Colombie',        b:'🇨🇩 RD Congo',   date:'2026-06-24 02:00:00' },
  { g:'K', j:3, a:'🇨🇴 Colombie',        b:'🇵🇹 Portugal',        date:'2026-06-27 23:30:00' },
  { g:'K', j:3, a:'🇨🇩 RD Congo',   b:'🇺🇿 Ouzbékistan',     date:'2026-06-27 23:30:00' },

  // ── GROUPE L : Angleterre · Croatie · Ghana · Panama ─────────────────────
  { g:'L', j:1, a:'🏴󠁧󠁢󠁥󠁮󠁧󠁿 Angleterre',      b:'🇭🇷 Croatie',         date:'2026-06-17 20:00:00' },
  { g:'L', j:1, a:'🇬🇭 Ghana',           b:'🇵🇦 Panama',          date:'2026-06-17 23:00:00' },
  { g:'L', j:2, a:'🏴󠁧󠁢󠁥󠁮󠁧󠁿 Angleterre',      b:'🇬🇭 Ghana',           date:'2026-06-23 20:00:00' },
  { g:'L', j:2, a:'🇵🇦 Panama',          b:'🇭🇷 Croatie',         date:'2026-06-23 23:00:00' },
  { g:'L', j:3, a:'🇵🇦 Panama',          b:'🏴󠁧󠁢󠁥󠁮󠁧󠁿 Angleterre',      date:'2026-06-27 21:00:00' },
  { g:'L', j:3, a:'🇭🇷 Croatie',         b:'🇬🇭 Ghana',           date:'2026-06-27 21:00:00' },
];

  seedAll(matchs);
  logger.info(`Seed terminé — ${matchs.length} matchs insérés (12 groupes × 6 matchs, CDM 2026 réel).`);
}

// Exécute la seed si lancé en standalone (node seed.js), sinon exporte la fonction
if (require.main === module) {
  runSeed();
  db.close();
}

module.exports = { runSeed };
