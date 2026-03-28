const express   = require('express');
const rateLimit = require('express-rate-limit');
const router    = express.Router();
const db        = require('../database');

// 60 pronos max par IP par minute
const limiterPronos = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de requêtes. Réessaie dans 1 minute.' },
});

// POST /api/pronos — créer ou mettre à jour un prono (upsert)
// Body : { user_id, match_id, score_predit_a, score_predit_b }
router.post('/', limiterPronos, (req, res) => {
  const { user_id, match_id, score_predit_a, score_predit_b } = req.body;

  if (!user_id || !match_id || score_predit_a == null || score_predit_b == null) {
    return res.status(400).json({ error: 'Champs manquants : user_id, match_id, score_predit_a, score_predit_b requis.' });
  }

  // Sanitisation : les scores doivent être des entiers entre 0 et 99
  const a = parseInt(score_predit_a, 10);
  const b = parseInt(score_predit_b, 10);
  if (isNaN(a) || isNaN(b) || a < 0 || b < 0 || a > 99 || b > 99) {
    return res.status(400).json({ error: 'Scores invalides : entiers entre 0 et 99 requis.' });
  }

  // Vérification que le user existe
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(user_id);
  if (!user) {
    return res.status(404).json({ error: 'Utilisateur introuvable.' });
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
  `).run(user_id, match_id, a, b);

  const prono = db.prepare('SELECT * FROM pronos WHERE user_id = ? AND match_id = ?').get(user_id, match_id);

  return res.status(201).json(prono);
});

module.exports = router;
