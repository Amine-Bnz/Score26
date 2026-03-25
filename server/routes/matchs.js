const express = require('express');
const router = express.Router();
const db = require('../database');
const { calculerPoints } = require('../scoring');

// GET /api/matchs?user_id=xxx — tous les matchs avec le prono de l'user si existant
// Verrouille automatiquement les pronos dont le coup d'envoi est passé avant de répondre
router.get('/', (req, res) => {
  const { user_id } = req.query;

  // Verrouillage automatique : bascule verrouille=1 pour tous les pronos dont le match a démarré
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

// PATCH /api/matchs/:id — saisie du score réel (route admin)
// Body : { score_reel_a, score_reel_b }
// Déclenche automatiquement le calcul des points pour tous les pronos du match
router.patch('/:id', (req, res) => {
  const { score_reel_a, score_reel_b } = req.body;

  if (score_reel_a == null || score_reel_b == null) {
    return res.status(400).json({ error: 'Champs manquants : score_reel_a, score_reel_b requis.' });
  }

  const match = db.prepare('SELECT id FROM matchs WHERE id = ?').get(req.params.id);
  if (!match) {
    return res.status(404).json({ error: 'Match introuvable.' });
  }

  // Enregistrement du score réel
  db.prepare('UPDATE matchs SET score_reel_a = ?, score_reel_b = ? WHERE id = ?')
    .run(score_reel_a, score_reel_b, req.params.id);

  // Calcul des points pour tous les pronos de ce match
  calculerPoints(req.params.id);

  const matchMaj = db.prepare('SELECT * FROM matchs WHERE id = ?').get(req.params.id);
  return res.json(matchMaj);
});

module.exports = router;
