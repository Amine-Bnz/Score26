const db = require('./database');

// Calcule et persiste les points_obtenus pour tous les pronos d'un match
// Appelé après la saisie du score réel
function calculerPoints(matchId) {
  const match = db.prepare('SELECT score_reel_a, score_reel_b FROM matchs WHERE id = ?').get(matchId);
  if (!match || match.score_reel_a == null || match.score_reel_b == null) return;

  const pronos = db.prepare('SELECT * FROM pronos WHERE match_id = ?').all(matchId);
  if (pronos.length === 0) return;

  const totalPronos = pronos.length;

  const calculer = db.transaction(() => {
    for (const prono of pronos) {
      const pointsBase = calculerPointsBase(prono, match);

      // Cote cachée : 1 / (nb_même_prono / total), plafond x5
      // "même prono" = même score exact prédit
      const nbMemeProno = db.prepare(`
        SELECT COUNT(*) AS nb FROM pronos
        WHERE match_id = ? AND score_predit_a = ? AND score_predit_b = ?
      `).get(matchId, prono.score_predit_a, prono.score_predit_b).nb;

      const ratio = nbMemeProno / totalPronos;
      const cote = Math.min(1 / ratio, 5);

      const pointsFinaux = Math.round(pointsBase * cote);

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

module.exports = { calculerPoints };
