const express = require('express');
const router = express.Router();
const db = require('../database');

// POST /api/pronos — créer ou mettre à jour un prono (upsert)
// Body : { user_id, match_id, score_predit_a, score_predit_b }
router.post('/', (req, res) => {
  const { user_id, match_id, score_predit_a, score_predit_b } = req.body;

  if (!user_id || !match_id || score_predit_a == null || score_predit_b == null) {
    return res.status(400).json({ error: 'Champs manquants : user_id, match_id, score_predit_a, score_predit_b requis.' });
  }

  // Vérification que le match existe et que le coup d'envoi n'est pas passé
  const match = db.prepare('SELECT id, date_coup_envoi FROM matchs WHERE id = ?').get(match_id);
  if (!match) {
    return res.status(404).json({ error: 'Match introuvable.' });
  }

  const maintenant = new Date();
  const coupDEnvoi = new Date(match.date_coup_envoi);
  if (maintenant >= coupDEnvoi) {
    return res.status(403).json({ error: 'Ce match est verrouillé, le coup d\'envoi est passé.' });
  }

  // Upsert : INSERT ou UPDATE si le prono existe déjà
  db.prepare(`
    INSERT INTO pronos (user_id, match_id, score_predit_a, score_predit_b, verrouille)
    VALUES (?, ?, ?, ?, 0)
    ON CONFLICT(user_id, match_id) DO UPDATE SET
      score_predit_a = excluded.score_predit_a,
      score_predit_b = excluded.score_predit_b
  `).run(user_id, match_id, score_predit_a, score_predit_b);

  const prono = db.prepare('SELECT * FROM pronos WHERE user_id = ? AND match_id = ?').get(user_id, match_id);

  return res.status(201).json(prono);
});

module.exports = router;
