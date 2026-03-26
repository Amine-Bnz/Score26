const db = require('./database');

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
// Les matchs sont joués aux USA/Canada/Mexique — les heures locales varient
// 19:00 UTC ≈ 15h00 ET | 22:00 UTC ≈ 18h00 ET | 01:00 UTC+1 ≈ 21h00 ET
//
// ATTENTION : équipes et calendrier approximatifs basés sur les qualifications
// connues fin 2025. À mettre à jour avec le tirage officiel si nécessaire.
//
// Format CDM 2026 : 48 équipes, 16 groupes de 3, 3 matchs par groupe = 48 matchs
// Journée 1 : 11–17 juin | Journée 2 : 18–24 juin | Journée 3 : 25 juin–1er juillet

const matchs = [
  // ── GROUPE A ──────────────────────────────────────────────────────────────
  { g:'A', j:1, a:'🇺🇸 États-Unis',  b:'🇵🇹 Portugal',       date:'2026-06-11 22:00:00' },
  { g:'A', j:2, a:'🇺🇸 États-Unis',  b:'🇲🇱 Mali',           date:'2026-06-18 19:00:00' },
  { g:'A', j:3, a:'🇵🇹 Portugal',    b:'🇲🇱 Mali',           date:'2026-06-25 22:00:00' },

  // ── GROUPE B ──────────────────────────────────────────────────────────────
  { g:'B', j:1, a:'🇨🇦 Canada',      b:'🇧🇪 Belgique',       date:'2026-06-11 19:00:00' },
  { g:'B', j:2, a:'🇨🇦 Canada',      b:'🇲🇦 Maroc',          date:'2026-06-18 22:00:00' },
  { g:'B', j:3, a:'🇧🇪 Belgique',    b:'🇲🇦 Maroc',          date:'2026-06-25 19:00:00' },

  // ── GROUPE C ──────────────────────────────────────────────────────────────
  { g:'C', j:1, a:'🇲🇽 Mexique',     b:'🇦🇹 Autriche',       date:'2026-06-12 22:00:00' },
  { g:'C', j:2, a:'🇲🇽 Mexique',     b:'🇸🇳 Sénégal',        date:'2026-06-19 19:00:00' },
  { g:'C', j:3, a:'🇦🇹 Autriche',    b:'🇸🇳 Sénégal',        date:'2026-06-26 22:00:00' },

  // ── GROUPE D ──────────────────────────────────────────────────────────────
  { g:'D', j:1, a:'🇦🇷 Argentine',   b:'🇫🇷 France',         date:'2026-06-12 19:00:00' },
  { g:'D', j:2, a:'🇦🇷 Argentine',   b:'🇯🇵 Japon',          date:'2026-06-19 22:00:00' },
  { g:'D', j:3, a:'🇫🇷 France',      b:'🇯🇵 Japon',          date:'2026-06-26 19:00:00' },

  // ── GROUPE E ──────────────────────────────────────────────────────────────
  { g:'E', j:1, a:'🇧🇷 Brésil',      b:'🇩🇪 Allemagne',      date:'2026-06-13 22:00:00' },
  { g:'E', j:2, a:'🇧🇷 Brésil',      b:'🇸🇦 Arabie Saoudite',date:'2026-06-20 19:00:00' },
  { g:'E', j:3, a:'🇩🇪 Allemagne',   b:'🇸🇦 Arabie Saoudite',date:'2026-06-27 22:00:00' },

  // ── GROUPE F ──────────────────────────────────────────────────────────────
  { g:'F', j:1, a:'🇨🇴 Colombie',    b:'🇪🇸 Espagne',        date:'2026-06-13 19:00:00' },
  { g:'F', j:2, a:'🇨🇴 Colombie',    b:'🇦🇺 Australie',      date:'2026-06-20 22:00:00' },
  { g:'F', j:3, a:'🇪🇸 Espagne',     b:'🇦🇺 Australie',      date:'2026-06-27 19:00:00' },

  // ── GROUPE G ──────────────────────────────────────────────────────────────
  { g:'G', j:1, a:'🇺🇾 Uruguay',     b:'🇳🇱 Pays-Bas',       date:'2026-06-14 22:00:00' },
  { g:'G', j:2, a:'🇺🇾 Uruguay',     b:'🇨🇲 Cameroun',       date:'2026-06-21 19:00:00' },
  { g:'G', j:3, a:'🇳🇱 Pays-Bas',    b:'🇨🇲 Cameroun',       date:'2026-06-28 22:00:00' },

  // ── GROUPE H ──────────────────────────────────────────────────────────────
  { g:'H', j:1, a:'🇪🇨 Équateur',    b:'🇮🇹 Italie',         date:'2026-06-14 19:00:00' },
  { g:'H', j:2, a:'🇪🇨 Équateur',    b:'🇮🇷 Iran',           date:'2026-06-21 22:00:00' },
  { g:'H', j:3, a:'🇮🇹 Italie',      b:'🇮🇷 Iran',           date:'2026-06-28 19:00:00' },

  // ── GROUPE I ──────────────────────────────────────────────────────────────
  { g:'I', j:1, a:'🇻🇪 Venezuela',   b:'🇵🇱 Pologne',        date:'2026-06-15 22:00:00' },
  { g:'I', j:2, a:'🇻🇪 Venezuela',   b:'🇳🇬 Nigeria',        date:'2026-06-22 19:00:00' },
  { g:'I', j:3, a:'🇵🇱 Pologne',     b:'🇳🇬 Nigeria',        date:'2026-06-29 22:00:00' },

  // ── GROUPE J ──────────────────────────────────────────────────────────────
  { g:'J', j:1, a:'🇵🇦 Panama',      b:'🇭🇷 Croatie',        date:'2026-06-15 19:00:00' },
  { g:'J', j:2, a:'🇵🇦 Panama',      b:'🇰🇷 Corée du Sud',   date:'2026-06-22 22:00:00' },
  { g:'J', j:3, a:'🇭🇷 Croatie',     b:'🇰🇷 Corée du Sud',   date:'2026-06-29 19:00:00' },

  // ── GROUPE K ──────────────────────────────────────────────────────────────
  { g:'K', j:1, a:'🇨🇷 Costa Rica',  b:'🇩🇰 Danemark',       date:'2026-06-16 22:00:00' },
  { g:'K', j:2, a:'🇨🇷 Costa Rica',  b:'🇪🇬 Égypte',         date:'2026-06-23 19:00:00' },
  { g:'K', j:3, a:'🇩🇰 Danemark',    b:'🇪🇬 Égypte',         date:'2026-06-30 22:00:00' },

  // ── GROUPE L ──────────────────────────────────────────────────────────────
  { g:'L', j:1, a:'🇭🇳 Honduras',    b:'🇷🇸 Serbie',         date:'2026-06-16 19:00:00' },
  { g:'L', j:2, a:'🇭🇳 Honduras',    b:'🇶🇦 Qatar',          date:'2026-06-23 22:00:00' },
  { g:'L', j:3, a:'🇷🇸 Serbie',      b:'🇶🇦 Qatar',          date:'2026-06-30 19:00:00' },

  // ── GROUPE M ──────────────────────────────────────────────────────────────
  { g:'M', j:1, a:'🇧🇴 Bolivie',     b:'🇨🇭 Suisse',         date:'2026-06-17 19:00:00' },
  { g:'M', j:2, a:'🇧🇴 Bolivie',     b:"🇨🇮 Côte d'Ivoire",  date:'2026-06-24 19:00:00' },
  { g:'M', j:3, a:'🇨🇭 Suisse',      b:"🇨🇮 Côte d'Ivoire",  date:'2026-07-01 19:00:00' },

  // ── GROUPE N ──────────────────────────────────────────────────────────────
  { g:'N', j:1, a:'🇮🇩 Indonésie',   b:'🏴󠁧󠁢󠁥󠁮󠁧󠁿 Angleterre',    date:'2026-06-17 22:00:00' },
  { g:'N', j:2, a:'🇮🇩 Indonésie',   b:'🇩🇿 Algérie',        date:'2026-06-24 22:00:00' },
  { g:'N', j:3, a:'🏴󠁧󠁢󠁥󠁮󠁧󠁿 Angleterre', b:'🇩🇿 Algérie',        date:'2026-07-01 22:00:00' },

  // ── GROUPE O ──────────────────────────────────────────────────────────────
  { g:'O', j:1, a:'🇳🇿 Nouvelle-Zélande', b:'🏴󠁧󠁢󠁳󠁣󠁴󠁿 Écosse',   date:'2026-06-17 01:00:00' },
  { g:'O', j:2, a:'🇳🇿 Nouvelle-Zélande', b:'🇹🇳 Tunisie',    date:'2026-06-24 01:00:00' },
  { g:'O', j:3, a:'🏴󠁧󠁢󠁳󠁣󠁴󠁿 Écosse',      b:'🇹🇳 Tunisie',    date:'2026-07-01 01:00:00' },

  // ── GROUPE P ──────────────────────────────────────────────────────────────
  { g:'P', j:1, a:'🇹🇷 Turquie',     b:'🇮🇶 Irak',           date:'2026-06-18 01:00:00' },
  { g:'P', j:2, a:'🇹🇷 Turquie',     b:'🇺🇿 Ouzbékistan',    date:'2026-06-25 01:00:00' },
  { g:'P', j:3, a:'🇮🇶 Irak',        b:'🇺🇿 Ouzbékistan',    date:'2026-07-02 01:00:00' },
];

seedAll(matchs);

console.log(`Seed terminé — ${matchs.length} matchs insérés (16 groupes × 3 matchs).`);
db.close();
