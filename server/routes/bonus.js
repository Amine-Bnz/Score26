const express = require('express');
const router  = express.Router();
const db      = require('../database');
const { requireAuth } = require('../middleware/auth');
const { validateUUIDParam } = require('../middleware/validate');

// S8: valider le format UUID sur le paramètre :userId
router.param('userId', validateUUIDParam);

// Types valides et points associés
const BONUS_TYPES = {
  winner: 100,       // Vainqueur final
  top_scorer: 80,    // Meilleur buteur
  // group_X_qualified : 30pts chaque (dynamique)
};

// GET /api/bonus/:userId — récupérer les pronos bonus d'un user
router.get('/:userId', (req, res) => {
  const pronos = db.prepare('SELECT * FROM bonus_pronos WHERE user_id = ? ORDER BY type').all(req.params.userId);
  return res.json(pronos);
});

// POST /api/bonus — sauvegarder un prono bonus (auth requise)
router.post('/', requireAuth, (req, res) => {
  const user_id = req.userId;
  const { type, value } = req.body;

  if (!type || !value) {
    return res.status(400).json({ error: 'type et value requis.' });
  }

  // Vérifier le type
  const isGroupType = /^group_[A-L]_qualified$/.test(type);
  if (!BONUS_TYPES[type] && !isGroupType) {
    return res.status(400).json({ error: 'Type de prono bonus invalide.' });
  }

  // Vérifier si déjà verrouillé
  const existing = db.prepare('SELECT id, locked FROM bonus_pronos WHERE user_id = ? AND type = ?').get(user_id, type);
  if (existing && existing.locked) {
    return res.status(403).json({ error: 'Ce prono bonus est verrouillé.' });
  }

  if (existing) {
    db.prepare('UPDATE bonus_pronos SET value = ? WHERE id = ?').run(value.trim(), existing.id);
  } else {
    db.prepare('INSERT INTO bonus_pronos (user_id, type, value) VALUES (?, ?, ?)').run(user_id, type, value.trim());
  }

  return res.json({ ok: true });
});

module.exports = router;
