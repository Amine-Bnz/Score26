const db = require('./database');

// Calcule et persiste les points_obtenus pour tous les pronos d'un match
// Appelé après la saisie du score réel
function calculerPoints(matchId) {
  const match = db.prepare('SELECT score_reel_a, score_reel_b, is_featured FROM matchs WHERE id = ?').get(matchId);
  if (!match || match.score_reel_a == null || match.score_reel_b == null) return;

  const pronos = db.prepare('SELECT * FROM pronos WHERE match_id = ?').all(matchId);
  if (pronos.length === 0) return;

  const totalPronos = pronos.length;

  // Pré-calcul des comptes par groupe de prono (un seul SELECT au lieu de N)
  const comptes = {};
  const rows = db.prepare(`
    SELECT score_predit_a, score_predit_b, COUNT(*) AS nb
    FROM pronos WHERE match_id = ?
    GROUP BY score_predit_a, score_predit_b
  `).all(matchId);
  for (const r of rows) {
    comptes[`${r.score_predit_a}-${r.score_predit_b}`] = r.nb;
  }

  const calculer = db.transaction(() => {
    for (const prono of pronos) {
      const pointsBase = calculerPointsBase(prono, match);

      // Cote cachée : 1 / (nb_même_prono / total), plafond x5
      const nbMemeProno = comptes[`${prono.score_predit_a}-${prono.score_predit_b}`] || 1;
      const ratio = nbMemeProno / totalPronos;
      const cote = Math.min(1 / ratio, 5);

      const multiplier = match.is_featured ? 2 : 1;
      const pointsFinaux = Math.round(pointsBase * cote * multiplier);

      db.prepare('UPDATE pronos SET points_obtenus = ?, verrouille = 1 WHERE id = ?')
        .run(pointsFinaux, prono.id);
    }
  });

  calculer();
}

// Retourne les points de base selon les règles métier
function calculerPointsBase(prono, match) {
  const { score_predit_a: pA, score_predit_b: pB } = prono;
  const { score_reel_a: rA, score_reel_b: rB } = match;

  // Score exact
  if (pA === rA && pB === rB) return 50;

  // Bonne issue (victoire A, nul, victoire B)
  const issueReelle  = Math.sign(rA - rB); // -1, 0, 1
  const issuePredite = Math.sign(pA - pB);
  if (issueReelle === issuePredite) return 20;

  return 0;
}

// Résoudre les défis 1v1 pour un match donné
function resoudreChallenges(matchId) {
  const challenges = db.prepare(`
    SELECT c.id, c.challenger_id, c.opponent_id
    FROM challenges c
    WHERE c.match_id = ? AND c.status = 'accepted'
  `).all(matchId);

  if (challenges.length === 0) return;

  const update = db.prepare('UPDATE challenges SET status = ?, winner_id = ? WHERE id = ?');

  db.transaction(() => {
    for (const c of challenges) {
      const p1 = db.prepare('SELECT points_obtenus FROM pronos WHERE user_id = ? AND match_id = ?').get(c.challenger_id, matchId);
      const p2 = db.prepare('SELECT points_obtenus FROM pronos WHERE user_id = ? AND match_id = ?').get(c.opponent_id, matchId);

      const s1 = p1?.points_obtenus ?? 0;
      const s2 = p2?.points_obtenus ?? 0;

      if (s1 > s2) update.run('resolved', c.challenger_id, c.id);
      else if (s2 > s1) update.run('resolved', c.opponent_id, c.id);
      else update.run('resolved', null, c.id); // égalité
    }
  })();
}

module.exports = { calculerPoints, calculerPointsBase, resoudreChallenges };
