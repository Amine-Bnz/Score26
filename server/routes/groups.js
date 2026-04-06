const express = require('express');
const crypto  = require('crypto');
const router  = express.Router();
const db      = require('../database');

// GET /api/groups/:userId — mes groupes
router.get('/:userId', (req, res) => {
  const groups = db.prepare(`
    SELECT g.id, g.name, g.invite_code, g.owner_id,
      (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id) AS member_count
    FROM group_members gm
    JOIN groups_ g ON g.id = gm.group_id
    WHERE gm.user_id = ?
    ORDER BY g.created_at DESC
  `).all(req.params.userId);

  return res.json(groups);
});

// GET /api/groups/:groupId/ranking — classement d'un groupe
router.get('/:groupId/ranking', (req, res) => {
  const ranking = db.prepare(`
    SELECT u.id, u.pseudo, u.avatar_seed,
      COALESCE(SUM(p.points_obtenus), 0) AS score_total,
      COUNT(CASE WHEN p.points_obtenus = 50 THEN 1 END) AS scores_exacts,
      COUNT(CASE WHEN p.points_obtenus = 20 THEN 1 END) AS bonnes_issues,
      COUNT(CASE WHEN p.points_obtenus = 0  THEN 1 END) AS rates
    FROM group_members gm
    JOIN users u ON u.id = gm.user_id
    LEFT JOIN pronos p ON p.user_id = u.id AND p.points_obtenus IS NOT NULL
    WHERE gm.group_id = ?
    GROUP BY u.id
    ORDER BY score_total DESC
  `).all(req.params.groupId);

  return res.json(ranking);
});

// POST /api/groups — créer un groupe
router.post('/', (req, res) => {
  const { user_id, name } = req.body;

  if (!user_id || !name || !name.trim()) {
    return res.status(400).json({ error: 'user_id et name requis.' });
  }

  const trimmed = name.trim().slice(0, 30);
  const id = crypto.randomUUID();

  // Générer un code d'invitation unique (6 chars)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const existing = new Set(db.prepare('SELECT invite_code FROM groups_').all().map(r => r.invite_code));
  let invite_code;
  do {
    invite_code = '';
    for (let i = 0; i < 6; i++) invite_code += chars[Math.floor(Math.random() * chars.length)];
  } while (existing.has(invite_code));

  db.transaction(() => {
    db.prepare('INSERT INTO groups_ (id, name, invite_code, owner_id) VALUES (?, ?, ?, ?)').run(id, trimmed, invite_code, user_id);
    db.prepare('INSERT INTO group_members (group_id, user_id) VALUES (?, ?)').run(id, user_id);
  })();

  return res.status(201).json({ id, name: trimmed, invite_code, owner_id: user_id, member_count: 1 });
});

// POST /api/groups/join — rejoindre un groupe via invite_code
router.post('/join', (req, res) => {
  const { user_id, invite_code } = req.body;

  if (!user_id || !invite_code) {
    return res.status(400).json({ error: 'user_id et invite_code requis.' });
  }

  const group = db.prepare('SELECT id, name FROM groups_ WHERE invite_code = ?').get(invite_code.toUpperCase().trim());
  if (!group) {
    return res.status(404).json({ error: 'Code de groupe invalide.' });
  }

  const already = db.prepare('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?').get(group.id, user_id);
  if (already) {
    return res.status(409).json({ error: 'Tu es déjà dans ce groupe.' });
  }

  db.prepare('INSERT INTO group_members (group_id, user_id) VALUES (?, ?)').run(group.id, user_id);

  return res.status(201).json({ group_id: group.id, name: group.name });
});

// DELETE /api/groups/:groupId/leave — quitter un groupe
router.delete('/:groupId/leave', (req, res) => {
  const { user_id } = req.body;
  const groupId = req.params.groupId;

  if (!user_id) {
    return res.status(400).json({ error: 'user_id requis.' });
  }

  db.prepare('DELETE FROM group_members WHERE group_id = ? AND user_id = ?').run(groupId, user_id);

  // Si le groupe est vide, le supprimer
  const remaining = db.prepare('SELECT COUNT(*) AS n FROM group_members WHERE group_id = ?').get(groupId);
  if (remaining.n === 0) {
    db.prepare('DELETE FROM groups_ WHERE id = ?').run(groupId);
  }

  return res.json({ ok: true });
});

module.exports = router;
