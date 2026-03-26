const express = require('express');
const router  = express.Router();
const db      = require('../database');
const { calculerPoints } = require('../scoring');

// GET /api/matchs?user_id=xxx
// Retourne tous les matchs avec : prono de l'user, données live si en cours
router.get('/', (req, res) => {
  const { user_id } = req.query;

  // Verrouillage automatique des pronos dont le coup d'envoi est passé
  db.prepare(`
    UPDATE pronos SET verrouille = 1
    WHERE verrouille = 0 AND match_id IN (
      SELECT id FROM matchs WHERE date_coup_envoi <= datetime('now')
    )
  `).run();

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

// PATCH /api/matchs/:id — saisie manuelle du score réel (admin / fallback)
router.patch('/:id', (req, res) => {
  const { score_reel_a, score_reel_b } = req.body;

  if (score_reel_a == null || score_reel_b == null) {
    return res.status(400).json({ error: 'score_reel_a et score_reel_b requis.' });
  }

  const match = db.prepare('SELECT id FROM matchs WHERE id = ?').get(req.params.id);
  if (!match) return res.status(404).json({ error: 'Match introuvable.' });

  db.prepare(`
    UPDATE matchs SET score_reel_a = ?, score_reel_b = ?, statut = 'termine'
    WHERE id = ?
  `).run(score_reel_a, score_reel_b, req.params.id);

  calculerPoints(req.params.id);

  return res.json(db.prepare('SELECT * FROM matchs WHERE id = ?').get(req.params.id));
});

module.exports = router;
