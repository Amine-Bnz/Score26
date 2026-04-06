const express = require('express');
const router  = express.Router();
const db      = require('../database');

// GET /api/matchs?user_id=xxx
// Retourne tous les matchs avec : prono de l'user, données live si en cours
router.get('/', (req, res) => {
  const { user_id } = req.query;

  const matchs = db.prepare(`
    SELECT
      m.id,
      m.equipe_a,
      m.equipe_b,
      m.date_coup_envoi,
      m.score_reel_a,
      m.score_reel_b,
      m.phase,
      m.journee,
      m.groupe,
      m.statut,
      m.score_live_a,
      m.score_live_b,
      m.minute_live,
      m.is_featured,
      p.id             AS prono_id,
      p.score_predit_a,
      p.score_predit_b,
      p.points_obtenus,
      p.verrouille
    FROM matchs m
    LEFT JOIN pronos p ON p.match_id = m.id AND p.user_id = ?
    ORDER BY m.date_coup_envoi ASC
  `).all(user_id ?? null);

  return res.json(matchs);
});

module.exports = router;
