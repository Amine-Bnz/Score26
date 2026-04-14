const express = require('express');
const crypto  = require('crypto');
const router  = express.Router();
const db      = require('../database');
const { requireAuth } = require('../middleware/auth');
const { validateUUIDParam } = require('../middleware/validate');

// S8: valider le format UUID sur les paramètres :userId et :groupId
router.param('userId', validateUUIDParam);
router.param('groupId', validateUUIDParam);

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

// GET /api/groups/:groupId/members — liste des membres d'un groupe
router.get('/:groupId/members', (req, res) => {
  const group = db.prepare('SELECT owner_id FROM groups_ WHERE id = ?').get(req.params.groupId);
  if (!group) return res.status(404).json({ error: 'Groupe introuvable.' });

  const members = db.prepare(`
    SELECT u.id, u.pseudo, u.avatar_seed, gm.joined_at,
      CASE WHEN u.id = ? THEN 1 ELSE 0 END AS is_owner
    FROM group_members gm
    JOIN users u ON u.id = gm.user_id
    WHERE gm.group_id = ?
    ORDER BY gm.joined_at ASC
  `).all(group.owner_id, req.params.groupId);

  return res.json(members);
});

// DELETE /api/groups/:groupId/member/:userId — expulser un membre (owner uniquement, auth requise)
router.delete('/:groupId/member/:userId', requireAuth, (req, res) => {
  const caller = req.userId;
  const { groupId, userId } = req.params;

  const group = db.prepare('SELECT owner_id FROM groups_ WHERE id = ?').get(groupId);
  if (!group) return res.status(404).json({ error: 'Groupe introuvable.' });
  if (group.owner_id !== caller) return res.status(403).json({ error: 'Seul le propriétaire peut expulser.' });
  if (userId === caller) return res.status(400).json({ error: 'Tu ne peux pas t\'expulser toi-même.' });

  const member = db.prepare('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?').get(groupId, userId);
  if (!member) return res.status(404).json({ error: 'Ce membre n\'est pas dans le groupe.' });

  db.prepare('DELETE FROM group_members WHERE group_id = ? AND user_id = ?').run(groupId, userId);
  return res.json({ ok: true });
});

// POST /api/groups/:groupId/regenerate-code — régénérer le code d'invitation (owner, auth requise)
router.post('/:groupId/regenerate-code', requireAuth, (req, res) => {
  const caller = req.userId;
  const groupId = req.params.groupId;

  const group = db.prepare('SELECT owner_id FROM groups_ WHERE id = ?').get(groupId);
  if (!group) return res.status(404).json({ error: 'Groupe introuvable.' });
  if (group.owner_id !== caller) return res.status(403).json({ error: 'Seul le propriétaire peut régénérer le code.' });

  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const existing = new Set(db.prepare('SELECT invite_code FROM groups_').all().map(r => r.invite_code));
  let invite_code;
  do {
    invite_code = '';
    for (let i = 0; i < 6; i++) invite_code += chars[crypto.randomInt(chars.length)];
  } while (existing.has(invite_code));

  db.prepare('UPDATE groups_ SET invite_code = ? WHERE id = ?').run(invite_code, groupId);
  return res.json({ invite_code });
});

// POST /api/groups — créer un groupe (auth requise)
router.post('/', requireAuth, (req, res) => {
  const user_id = req.userId;
  const { name } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'name requis.' });
  }

  // Limite de 10 groupes par utilisateur
  const groupCount = db.prepare('SELECT COUNT(*) AS c FROM group_members WHERE user_id = ?').get(user_id)?.c ?? 0;
  if (groupCount >= 10) {
    return res.status(400).json({ error: 'Limite de 10 groupes atteinte.' });
  }

  const trimmed = name.trim().slice(0, 30);
  const id = crypto.randomUUID();

  // S9: Générer un code d'invitation unique (6 chars, crypto.randomInt)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const existing = new Set(db.prepare('SELECT invite_code FROM groups_').all().map(r => r.invite_code));
  let invite_code;
  do {
    invite_code = '';
    for (let i = 0; i < 6; i++) invite_code += chars[crypto.randomInt(chars.length)];
  } while (existing.has(invite_code));

  db.transaction(() => {
    db.prepare('INSERT INTO groups_ (id, name, invite_code, owner_id) VALUES (?, ?, ?, ?)').run(id, trimmed, invite_code, user_id);
    db.prepare('INSERT INTO group_members (group_id, user_id) VALUES (?, ?)').run(id, user_id);
  })();

  return res.status(201).json({ id, name: trimmed, invite_code, owner_id: user_id, member_count: 1 });
});

// GET /api/groups/preview/:code — aperçu d'un groupe par invite_code (sans rejoindre)
router.get('/preview/:code', (req, res) => {
  const code = (req.params.code || '').toUpperCase().trim();
  if (!code) return res.status(400).json({ error: 'Code requis.' });

  const group = db.prepare(`
    SELECT g.name, COUNT(gm.user_id) AS member_count
    FROM groups_ g
    LEFT JOIN group_members gm ON gm.group_id = g.id
    WHERE g.invite_code = ?
    GROUP BY g.id
  `).get(code);
  if (!group) return res.status(404).json({ error: 'Code de groupe invalide.' });

  return res.json({ name: group.name, member_count: group.member_count });
});

// POST /api/groups/join — rejoindre un groupe via invite_code (auth requise)
router.post('/join', requireAuth, (req, res) => {
  const user_id = req.userId;
  const { invite_code } = req.body;

  if (!invite_code) {
    return res.status(400).json({ error: 'invite_code requis.' });
  }

  const group = db.prepare('SELECT id, name FROM groups_ WHERE invite_code = ?').get(invite_code.toUpperCase().trim());
  if (!group) {
    return res.status(404).json({ error: 'Code de groupe invalide.' });
  }

  const already = db.prepare('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?').get(group.id, user_id);
  if (already) {
    return res.status(409).json({ error: 'Tu es déjà dans ce groupe.' });
  }

  // Limite de 10 groupes par utilisateur
  const groupCount = db.prepare('SELECT COUNT(*) AS c FROM group_members WHERE user_id = ?').get(user_id)?.c ?? 0;
  if (groupCount >= 10) {
    return res.status(400).json({ error: 'Limite de 10 groupes atteinte.' });
  }

  db.prepare('INSERT INTO group_members (group_id, user_id) VALUES (?, ?)').run(group.id, user_id);

  return res.status(201).json({ group_id: group.id, name: group.name });
});

// DELETE /api/groups/:groupId/leave — quitter un groupe (auth requise)
router.delete('/:groupId/leave', requireAuth, (req, res) => {
  const user_id = req.userId;
  const groupId = req.params.groupId;

  const group = db.prepare('SELECT owner_id FROM groups_ WHERE id = ?').get(groupId);
  if (!group) {
    return res.status(404).json({ error: 'Groupe introuvable.' });
  }

  db.transaction(() => {
    db.prepare('DELETE FROM group_members WHERE group_id = ? AND user_id = ?').run(groupId, user_id);

    const remaining = db.prepare('SELECT COUNT(*) AS n FROM group_members WHERE group_id = ?').get(groupId);
    if (remaining.n === 0) {
      // Groupe vide → supprimer
      db.prepare('DELETE FROM groups_ WHERE id = ?').run(groupId);
    } else if (group.owner_id === user_id) {
      // L'owner quitte → transférer au membre le plus ancien
      const newOwner = db.prepare(
        'SELECT user_id FROM group_members WHERE group_id = ? ORDER BY joined_at ASC LIMIT 1'
      ).get(groupId);
      if (newOwner) {
        db.prepare('UPDATE groups_ SET owner_id = ? WHERE id = ?').run(newOwner.user_id, groupId);
      }
    }
  })();

  return res.json({ ok: true });
});

module.exports = router;
