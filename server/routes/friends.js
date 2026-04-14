const express = require('express');
const router  = express.Router();
const db      = require('../database');
const { requireAuth } = require('../middleware/auth');
const { validateUUIDParam } = require('../middleware/validate');

// S8: valider le format UUID sur les paramètres :userId et :friendId
router.param('userId', validateUUIDParam);
router.param('friendId', validateUUIDParam);

// GET /api/friends/:userId — liste des amis avec scores (?page=1&limit=30)
router.get('/:userId', (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 30));
  const offset = (page - 1) * limit;

  const total = db.prepare("SELECT COUNT(*) AS c FROM friendships WHERE user_id = ? AND status = 'accepted'").get(req.params.userId)?.c ?? 0;

  const friends = db.prepare(`
    SELECT u.id, u.pseudo, u.avatar_seed,
      COALESCE(SUM(p.points_obtenus), 0) AS score_total
    FROM friendships f
    JOIN users u ON u.id = f.friend_id
    LEFT JOIN pronos p ON p.user_id = u.id AND p.points_obtenus IS NOT NULL
    WHERE f.user_id = ? AND f.status = 'accepted'
    GROUP BY u.id
    ORDER BY score_total DESC
    LIMIT ? OFFSET ?
  `).all(req.params.userId, limit, offset);

  return res.json({ friends, page, limit, total, hasMore: offset + friends.length < total });
});

// GET /api/friends/:userId/ranking — classement toi + tes amis (?page=1&limit=50)
router.get('/:userId/ranking', (req, res) => {
  const userId = req.params.userId;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
  const offset = (page - 1) * limit;

  const friendIds = db.prepare("SELECT friend_id FROM friendships WHERE user_id = ? AND status = 'accepted'")
    .all(userId)
    .map(r => r.friend_id);

  const allIds = [userId, ...friendIds];
  const total = allIds.length;
  const placeholders = allIds.map(() => '?').join(',');

  const ranking = db.prepare(`
    SELECT u.id, u.pseudo, u.avatar_seed,
      COALESCE(SUM(p.points_obtenus), 0) AS score_total,
      COUNT(CASE WHEN p.points_obtenus = 50 THEN 1 END) AS scores_exacts,
      COUNT(CASE WHEN p.points_obtenus = 20 THEN 1 END) AS bonnes_issues,
      COUNT(CASE WHEN p.points_obtenus = 0  THEN 1 END) AS rates
    FROM users u
    LEFT JOIN pronos p ON p.user_id = u.id AND p.points_obtenus IS NOT NULL
    WHERE u.id IN (${placeholders})
    GROUP BY u.id
    ORDER BY score_total DESC
    LIMIT ? OFFSET ?
  `).all(...allIds, limit, offset);

  return res.json({ ranking, page, limit, total, hasMore: offset + ranking.length < total });
});

// GET /api/friends/:userId/pronos/:matchId — pronos des amis pour un match (+ réactions)
router.get('/:userId/pronos/:matchId', (req, res) => {
  const { userId, matchId } = req.params;
  const mid = Number(matchId);

  const match = db.prepare('SELECT statut FROM matchs WHERE id = ?').get(mid);
  if (!match || match.statut === 'a_venir') {
    return res.status(403).json({ error: 'Pronos non visibles avant le coup d\'envoi.' });
  }

  const pronos = db.prepare(`
    SELECT u.id as user_id, u.pseudo, u.avatar_seed,
           p.score_predit_a, p.score_predit_b, p.points_obtenus,
           pr.emoji as my_reaction
    FROM friendships f
    JOIN users u ON u.id = f.friend_id
    JOIN pronos p ON p.user_id = u.id AND p.match_id = ?
    LEFT JOIN prono_reactions pr ON pr.target_user_id = u.id AND pr.match_id = ? AND pr.reactor_id = ?
    WHERE f.user_id = ? AND f.status = 'accepted'
    ORDER BY u.pseudo
  `).all(mid, mid, userId, userId);

  // Aggregate reaction counts per friend prono
  const counts = db.prepare(`
    SELECT target_user_id, emoji, COUNT(*) as cnt
    FROM prono_reactions
    WHERE match_id = ? AND target_user_id IN (SELECT friend_id FROM friendships WHERE user_id = ? AND status = 'accepted')
    GROUP BY target_user_id, emoji
  `).all(mid, userId);

  const countMap = {};
  for (const c of counts) {
    if (!countMap[c.target_user_id]) countMap[c.target_user_id] = {};
    countMap[c.target_user_id][c.emoji] = c.cnt;
  }

  for (const p of pronos) {
    p.reactions = countMap[p.user_id] || {};
  }

  return res.json(pronos);
});

// GET /api/friends/:userId/history/:friendId — historique des pronos d'un ami
router.get('/:userId/history/:friendId', (req, res) => {
  const { userId, friendId } = req.params;

  // Vérifier que c'est bien un ami
  const isFriend = db.prepare("SELECT 1 FROM friendships WHERE user_id = ? AND friend_id = ? AND status = 'accepted'").get(userId, friendId);
  if (!isFriend) {
    return res.status(403).json({ error: 'Cet utilisateur n\'est pas dans tes amis.' });
  }

  const friend = db.prepare('SELECT pseudo, avatar_seed FROM users WHERE id = ?').get(friendId);
  if (!friend) return res.status(404).json({ error: 'Utilisateur introuvable.' });

  const pronos = db.prepare(`
    SELECT m.equipe_a, m.equipe_b, m.score_reel_a, m.score_reel_b,
           p.score_predit_a, p.score_predit_b, p.points_obtenus,
           m.date_coup_envoi, m.phase, m.groupe
    FROM pronos p
    JOIN matchs m ON m.id = p.match_id
    WHERE p.user_id = ? AND m.statut = 'termine' AND p.points_obtenus IS NOT NULL
    ORDER BY m.date_coup_envoi DESC
  `).all(friendId);

  return res.json({ pseudo: friend.pseudo, avatar_seed: friend.avatar_seed, pronos });
});

// GET /api/friends/:userId/compare/:friendId — comparaison face-à-face
router.get('/:userId/compare/:friendId', (req, res) => {
  const { userId, friendId } = req.params;

  const isFriend = db.prepare("SELECT 1 FROM friendships WHERE user_id = ? AND friend_id = ? AND status = 'accepted'").get(userId, friendId);
  if (!isFriend) {
    return res.status(403).json({ error: 'Cet utilisateur n\'est pas dans tes amis.' });
  }

  const friend = db.prepare('SELECT pseudo, avatar_seed FROM users WHERE id = ?').get(friendId);
  if (!friend) return res.status(404).json({ error: 'Utilisateur introuvable.' });

  const me = db.prepare('SELECT pseudo FROM users WHERE id = ?').get(userId);

  const rows = db.prepare(`
    SELECT m.id, m.equipe_a, m.equipe_b, m.score_reel_a, m.score_reel_b, m.phase, m.groupe, m.date_coup_envoi,
           p1.score_predit_a AS my_a, p1.score_predit_b AS my_b, p1.points_obtenus AS my_pts,
           p2.score_predit_a AS fr_a, p2.score_predit_b AS fr_b, p2.points_obtenus AS fr_pts
    FROM matchs m
    JOIN pronos p1 ON p1.match_id = m.id AND p1.user_id = ?
    JOIN pronos p2 ON p2.match_id = m.id AND p2.user_id = ?
    WHERE m.statut = 'termine' AND p1.points_obtenus IS NOT NULL AND p2.points_obtenus IS NOT NULL
    ORDER BY m.date_coup_envoi DESC
  `).all(userId, friendId);

  let myWins = 0, frWins = 0, ties = 0, myTotal = 0, frTotal = 0;
  for (const r of rows) {
    myTotal += r.my_pts;
    frTotal += r.fr_pts;
    if (r.my_pts > r.fr_pts) myWins++;
    else if (r.fr_pts > r.my_pts) frWins++;
    else ties++;
  }

  return res.json({
    me: { pseudo: me?.pseudo },
    friend: { pseudo: friend.pseudo, avatar_seed: friend.avatar_seed },
    summary: { myWins, frWins, ties, myTotal, frTotal },
    matches: rows,
  });
});

// GET /api/friends/preview/:code — aperçu d'un utilisateur par friend_code (sans créer d'amitié)
router.get('/preview/:code', (req, res) => {
  const code = (req.params.code || '').toUpperCase().trim();
  if (!code) return res.status(400).json({ error: 'Code requis.' });

  const user = db.prepare('SELECT pseudo, avatar_seed FROM users WHERE friend_code = ?').get(code);
  if (!user) return res.status(404).json({ error: 'Code invalide.' });

  return res.json({ pseudo: user.pseudo, avatar_seed: user.avatar_seed });
});

// POST /api/friends — envoyer une demande d'amitié par code (auth requise)
router.post('/', requireAuth, (req, res) => {
  const user_id = req.userId;
  const { friend_code } = req.body;

  if (!friend_code) {
    return res.status(400).json({ error: 'friend_code requis.' });
  }

  const friend = db.prepare('SELECT id, pseudo FROM users WHERE friend_code = ?').get(friend_code.toUpperCase().trim());
  if (!friend) {
    return res.status(404).json({ error: 'Code invalide.' });
  }

  if (friend.id === user_id) {
    return res.status(400).json({ error: 'Tu ne peux pas t\'ajouter toi-même.' });
  }

  // Vérifier blocage (dans les deux sens) — message générique pour ne pas révéler le blocage
  const blocked = db.prepare('SELECT 1 FROM blocks WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)').get(friend.id, user_id, user_id, friend.id);
  if (blocked) {
    return res.status(404).json({ error: 'Code invalide.' });
  }

  const existing = db.prepare('SELECT status FROM friendships WHERE user_id = ? AND friend_id = ?').get(user_id, friend.id);
  if (existing) {
    if (existing.status === 'accepted') {
      return res.status(409).json({ error: 'Déjà dans tes amis.' });
    }
    if (existing.status === 'pending') {
      return res.status(409).json({ error: 'Demande déjà envoyée.' });
    }
    if (existing.status === 'pending_received') {
      // L'autre personne nous a déjà envoyé une demande → accepter automatiquement
      db.transaction(() => {
        db.prepare("UPDATE friendships SET status = 'accepted' WHERE user_id = ? AND friend_id = ?").run(user_id, friend.id);
        db.prepare("UPDATE friendships SET status = 'accepted' WHERE user_id = ? AND friend_id = ?").run(friend.id, user_id);
      })();
      return res.status(201).json({ friend_id: friend.id, pseudo: friend.pseudo, status: 'accepted' });
    }
  }

  // Limite de 100 amis (accepted + pending)
  const friendCount = db.prepare("SELECT COUNT(*) AS c FROM friendships WHERE user_id = ? AND status IN ('accepted','pending')").get(user_id)?.c ?? 0;
  if (friendCount >= 100) {
    return res.status(400).json({ error: 'Limite de 100 amis atteinte.' });
  }

  const insert = db.prepare('INSERT INTO friendships (user_id, friend_id, status) VALUES (?, ?, ?)');
  db.transaction(() => {
    insert.run(user_id, friend.id, 'pending');
    insert.run(friend.id, user_id, 'pending_received');
  })();

  return res.status(201).json({ friend_id: friend.id, pseudo: friend.pseudo, status: 'pending' });
});

// GET /api/friends/:userId/requests — demandes d'amitié reçues en attente
router.get('/:userId/requests', (req, res) => {
  const requests = db.prepare(`
    SELECT u.id, u.pseudo, u.avatar_seed, f.created_at
    FROM friendships f
    JOIN users u ON u.id = f.friend_id
    WHERE f.user_id = ? AND f.status = 'pending_received'
    ORDER BY f.created_at DESC
  `).all(req.params.userId);

  return res.json(requests);
});

// GET /api/friends/:userId/sent — demandes d'amitié envoyées en attente
router.get('/:userId/sent', (req, res) => {
  const sent = db.prepare(`
    SELECT u.id, u.pseudo, u.avatar_seed, f.created_at
    FROM friendships f
    JOIN users u ON u.id = f.friend_id
    WHERE f.user_id = ? AND f.status = 'pending'
    ORDER BY f.created_at DESC
  `).all(req.params.userId);

  return res.json(sent);
});

// POST /api/friends/:friendId/accept — accepter une demande d'amitié (auth requise)
router.post('/:friendId/accept', requireAuth, (req, res) => {
  const user_id = req.userId;
  const friendId = req.params.friendId;

  const row = db.prepare("SELECT 1 FROM friendships WHERE user_id = ? AND friend_id = ? AND status = 'pending_received'").get(user_id, friendId);
  if (!row) {
    return res.status(404).json({ error: 'Aucune demande en attente.' });
  }

  db.transaction(() => {
    db.prepare("UPDATE friendships SET status = 'accepted' WHERE user_id = ? AND friend_id = ?").run(user_id, friendId);
    db.prepare("UPDATE friendships SET status = 'accepted' WHERE user_id = ? AND friend_id = ?").run(friendId, user_id);
  })();

  return res.json({ ok: true });
});

// POST /api/friends/:friendId/decline — refuser une demande d'amitié (auth requise)
router.post('/:friendId/decline', requireAuth, (req, res) => {
  const user_id = req.userId;
  const friendId = req.params.friendId;

  const row = db.prepare("SELECT 1 FROM friendships WHERE user_id = ? AND friend_id = ? AND status = 'pending_received'").get(user_id, friendId);
  if (!row) {
    return res.status(404).json({ error: 'Aucune demande en attente.' });
  }

  db.transaction(() => {
    db.prepare('DELETE FROM friendships WHERE user_id = ? AND friend_id = ?').run(user_id, friendId);
    db.prepare('DELETE FROM friendships WHERE user_id = ? AND friend_id = ?').run(friendId, user_id);
  })();

  return res.json({ ok: true });
});

// DELETE /api/friends/:friendId/cancel — annuler une demande envoyée (auth requise)
router.delete('/:friendId/cancel', requireAuth, (req, res) => {
  const user_id = req.userId;
  const friendId = req.params.friendId;

  const row = db.prepare("SELECT 1 FROM friendships WHERE user_id = ? AND friend_id = ? AND status = 'pending'").get(user_id, friendId);
  if (!row) {
    return res.status(404).json({ error: 'Aucune demande en attente.' });
  }

  db.transaction(() => {
    db.prepare('DELETE FROM friendships WHERE user_id = ? AND friend_id = ?').run(user_id, friendId);
    db.prepare('DELETE FROM friendships WHERE user_id = ? AND friend_id = ?').run(friendId, user_id);
  })();

  return res.json({ ok: true });
});

// DELETE /api/friends/:friendId — retirer un ami (bidirectionnel, auth requise)
router.delete('/:friendId', requireAuth, (req, res) => {
  const user_id = req.userId;
  const friendId = req.params.friendId;

  const del = db.prepare('DELETE FROM friendships WHERE user_id = ? AND friend_id = ?');
  db.transaction(() => {
    del.run(user_id, friendId);
    del.run(friendId, user_id);
  })();

  return res.json({ ok: true });
});

module.exports = router;
