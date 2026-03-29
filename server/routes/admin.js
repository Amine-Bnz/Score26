const express = require('express');
const router  = express.Router();
const db      = require('../database');
const { calculerPoints } = require('../scoring');
const logger  = require('../logger');

// Middleware — vérifie le token admin à chaque requête
function checkToken(req, res, next) {
  const token = req.query.token || req.headers['x-admin-token'];
  const expected = process.env.ADMIN_TOKEN;
  if (!expected || expected === 'change_this_before_deploy' || token !== expected) {
    logger.warn({ ip: req.ip, method: req.method, path: req.path }, '[admin] Accès refusé');
    return res.status(401).json({ error: 'Token invalide.' });
  }
  logger.info({ ip: req.ip, method: req.method, path: req.path }, '[admin] Accès autorisé');
  next();
}

// GET /api/admin/matchs — tous les matchs, sans filtre user
router.get('/matchs', checkToken, (req, res) => {
  const matchs = db.prepare(`
    SELECT id, equipe_a, equipe_b, date_coup_envoi, groupe, journee, phase, statut,
           score_reel_a, score_reel_b, score_live_a, score_live_b, minute_live
    FROM matchs
    ORDER BY date_coup_envoi ASC
  `).all();
  res.json(matchs);
});

// PATCH /api/admin/matchs/:id — mise à jour statut et/ou score
// Body : { statut?, score_reel_a?, score_reel_b?, recalculer? }
router.patch('/matchs/:id', checkToken, (req, res) => {
  const { statut, score_reel_a, score_reel_b, recalculer } = req.body;

  const match = db.prepare('SELECT * FROM matchs WHERE id = ?').get(req.params.id);
  if (!match) return res.status(404).json({ error: 'Match introuvable.' });

  // Validation scores si fournis
  if (score_reel_a != null || score_reel_b != null) {
    const a = parseInt(score_reel_a, 10);
    const b = parseInt(score_reel_b, 10);
    if (isNaN(a) || isNaN(b) || a < 0 || b < 0 || a > 99 || b > 99) {
      return res.status(400).json({ error: 'Scores invalides (entiers 0-99).' });
    }
    req.body.score_reel_a = a;
    req.body.score_reel_b = b;
  }

  // Validation statut si fourni
  const STATUTS_VALIDES = ['a_venir', 'en_cours', 'termine'];
  if (statut && !STATUTS_VALIDES.includes(statut)) {
    return res.status(400).json({ error: `Statut invalide (${STATUTS_VALIDES.join(', ')}).` });
  }

  const matchId = req.params.id;

  // Mise à jour du statut seul (ex: passer en 'en_cours')
  if (statut && req.body.score_reel_a == null) {
    db.prepare('UPDATE matchs SET statut = ? WHERE id = ?').run(statut, matchId);
    logger.info({ ip: req.ip, matchId, action: 'statut', statut }, '[admin] Statut modifié');
  }

  // Saisie du score réel → statut forcé à 'termine' + calcul des points
  if (req.body.score_reel_a != null && req.body.score_reel_b != null) {
    db.prepare(`
      UPDATE matchs SET score_reel_a = ?, score_reel_b = ?, statut = 'termine' WHERE id = ?
    `).run(req.body.score_reel_a, req.body.score_reel_b, matchId);
    calculerPoints(matchId);
    logger.info({ ip: req.ip, matchId, action: 'score', score: `${req.body.score_reel_a}-${req.body.score_reel_b}` }, '[admin] Score saisi + points calculés');
  }

  // Recalcul des points seul (sans changer le score)
  if (recalculer && score_reel_a == null) {
    calculerPoints(matchId);
    logger.info({ ip: req.ip, matchId, action: 'recalcul' }, '[admin] Points recalculés');
  }

  // Réinitialisation complète → score NULL, statut a_venir, points pronos remis à NULL
  if (req.body.reset) {
    db.prepare(`
      UPDATE matchs SET score_reel_a = NULL, score_reel_b = NULL, statut = 'a_venir' WHERE id = ?
    `).run(matchId);
    db.prepare(`
      UPDATE pronos SET points_obtenus = NULL WHERE match_id = ?
    `).run(matchId);
    logger.info({ ip: req.ip, matchId, action: 'reset' }, '[admin] Match réinitialisé');
  }

  res.json(db.prepare('SELECT * FROM matchs WHERE id = ?').get(matchId));
});

module.exports = router;
