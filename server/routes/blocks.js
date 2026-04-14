const express = require('express');
const router  = express.Router();
const db      = require('../database');
const { requireAuth } = require('../middleware/auth');
const { validateUUIDParam } = require('../middleware/validate');

router.param('userId', validateUUIDParam);
router.param('blockedId', validateUUIDParam);

// POST /api/blocks — bloquer un utilisateur (supprime aussi l'amitié)
router.post('/', requireAuth, (req, res) => {
  const blocker = req.userId;
  const { blocked_id } = req.body;

  if (!blocked_id) return res.status(400).json({ error: 'blocked_id requis.' });
  if (blocked_id === blocker) return res.status(400).json({ error: 'Tu ne peux pas te bloquer toi-même.' });

  const existing = db.prepare('SELECT 1 FROM blocks WHERE blocker_id = ? AND blocked_id = ?').get(blocker, blocked_id);
  if (existing) return res.status(409).json({ error: 'Déjà bloqué.' });

  db.transaction(() => {
    db.prepare('INSERT INTO blocks (blocker_id, blocked_id) VALUES (?, ?)').run(blocker, blocked_id);
    // Supprimer l'amitié dans les deux sens (si elle existe)
    db.prepare('DELETE FROM friendships WHERE user_id = ? AND friend_id = ?').run(blocker, blocked_id);
    db.prepare('DELETE FROM friendships WHERE user_id = ? AND friend_id = ?').run(blocked_id, blocker);
  })();

  return res.status(201).json({ ok: true });
});

// DELETE /api/blocks/:blockedId — débloquer un utilisateur
router.delete('/:blockedId', requireAuth, (req, res) => {
  const blocker = req.userId;
  const blockedId = req.params.blockedId;

  db.prepare('DELETE FROM blocks WHERE blocker_id = ? AND blocked_id = ?').run(blocker, blockedId);
  return res.json({ ok: true });
});

// GET /api/blocks/:userId — liste des utilisateurs bloqués
router.get('/:userId', (req, res) => {
  const blocked = db.prepare(`
    SELECT u.id, u.pseudo, u.avatar_seed
    FROM blocks b
    JOIN users u ON u.id = b.blocked_id
    WHERE b.blocker_id = ?
    ORDER BY b.created_at DESC
  `).all(req.params.userId);

  return res.json(blocked);
});

module.exports = router;
