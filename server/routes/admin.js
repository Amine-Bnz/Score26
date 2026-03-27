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

  // Mise à jour du statut seul (ex: passer en 'en_cours')
  if (statut && score_reel_a == null) {
    db.prepare('UPDATE matchs SET statut = ? WHERE id = ?').run(statut, req.params.id);
  }

  // Saisie du score réel → statut forcé à 'termine' + calcul des points
  if (score_reel_a != null && score_reel_b != null) {
    db.prepare(`
      UPDATE matchs SET score_reel_a = ?, score_reel_b = ?, statut = 'termine' WHERE id = ?
    `).run(score_reel_a, score_reel_b, req.params.id);
    calculerPoints(req.params.id);
  }

  // Recalcul des points seul (sans changer le score)
  if (recalculer && score_reel_a == null) {
    calculerPoints(req.params.id);
  }

  // Réinitialisation complète → score NULL, statut a_venir, points pronos remis à NULL
  if (req.body.reset) {
    db.prepare(`
      UPDATE matchs SET score_reel_a = NULL, score_reel_b = NULL, statut = 'a_venir' WHERE id = ?
    `).run(req.params.id);
    db.prepare(`
      UPDATE pronos SET points_obtenus = NULL WHERE match_id = ?
    `).run(req.params.id);
  }

  res.json(db.prepare('SELECT * FROM matchs WHERE id = ?').get(req.params.id));
});

module.exports = router;
