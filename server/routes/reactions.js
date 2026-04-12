const express = require('express');
const router = express.Router();
const db = require('../database');
const { requireAuth } = require('../middleware/auth');
const { UUID_REGEX } = require('../middleware/validate');

const ALLOWED_EMOJIS = ['🔥', '😂', '😮', '💀'];

// POST /api/reactions — toggle a reaction on a friend's prono (auth requise)
router.post('/', requireAuth, (req, res) => {
  const reactor_id = req.userId;
  const { target_user_id, match_id, emoji } = req.body;

  if (!target_user_id || !match_id || !emoji) {
    return res.status(400).json({ error: 'Champs requis: target_user_id, match_id, emoji.' });
  }
  if (!UUID_REGEX.test(target_user_id)) {
    return res.status(400).json({ error: 'Identifiant invalide.' });
  }
  if (reactor_id === target_user_id) {
    return res.status(400).json({ error: 'Tu ne peux pas réagir à ton propre prono.' });
  }
  if (!ALLOWED_EMOJIS.includes(emoji)) {
    return res.status(400).json({ error: 'Emoji non autorisé.' });
  }

  // Verify friendship
  const isFriend = db.prepare('SELECT 1 FROM friendships WHERE user_id = ? AND friend_id = ?').get(reactor_id, target_user_id);
  if (!isFriend) {
    return res.status(403).json({ error: 'Tu ne peux réagir qu\'aux pronos de tes amis.' });
  }

  // Toggle: same emoji → remove, different → update
  const existing = db.prepare(
    'SELECT emoji FROM prono_reactions WHERE reactor_id = ? AND target_user_id = ? AND match_id = ?'
  ).get(reactor_id, target_user_id, Number(match_id));

  if (existing && existing.emoji === emoji) {
    // Remove reaction
    db.prepare('DELETE FROM prono_reactions WHERE reactor_id = ? AND target_user_id = ? AND match_id = ?')
      .run(reactor_id, target_user_id, Number(match_id));
    return res.json({ action: 'removed' });
  }

  // Upsert reaction
  db.prepare(`
    INSERT INTO prono_reactions (reactor_id, target_user_id, match_id, emoji)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(reactor_id, target_user_id, match_id) DO UPDATE SET emoji = excluded.emoji
  `).run(reactor_id, target_user_id, Number(match_id), emoji);

  return res.json({ action: existing ? 'updated' : 'added', emoji });
});

module.exports = router;
