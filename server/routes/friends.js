const express = require('express');
const router  = express.Router();
const db      = require('../database');

// GET /api/friends/:userId — liste des amis avec scores
router.get('/:userId', (req, res) => {
  const friends = db.prepare(`
    SELECT u.id, u.pseudo, u.avatar_seed,
      COALESCE(SUM(p.points_obtenus), 0) AS score_total
    FROM friendships f
    JOIN users u ON u.id = f.friend_id
    LEFT JOIN pronos p ON p.user_id = u.id AND p.points_obtenus IS NOT NULL
    WHERE f.user_id = ?
    GROUP BY u.id
    ORDER BY score_total DESC
  `).all(req.params.userId);

  return res.json(friends);
});

// GET /api/friends/:userId/ranking — classement toi + tes amis
router.get('/:userId/ranking', (req, res) => {
  const userId = req.params.userId;

  const friendIds = db.prepare('SELECT friend_id FROM friendships WHERE user_id = ?')
    .all(userId)
    .map(r => r.friend_id);

  const allIds = [userId, ...friendIds];
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
  `).all(...allIds);

  return res.json(ranking);
});

// GET /api/friends/:userId/pronos/:matchId — pronos des amis pour un match
router.get('/:userId/pronos/:matchId', (req, res) => {
  const { userId, matchId } = req.params;

  const match = db.prepare('SELECT statut FROM matchs WHERE id = ?').get(Number(matchId));
  if (!match || match.statut === 'a_venir') {
    return res.status(403).json({ error: 'Pronos non visibles avant le coup d\'envoi.' });
  }

  const pronos = db.prepare(`
    SELECT u.pseudo, u.avatar_seed, p.score_predit_a, p.score_predit_b, p.points_obtenus
    FROM friendships f
    JOIN users u ON u.id = f.friend_id
    JOIN pronos p ON p.user_id = u.id AND p.match_id = ?
    WHERE f.user_id = ?
    ORDER BY u.pseudo
  `).all(Number(matchId), userId);

  return res.json(pronos);
});

// GET /api/friends/:userId/history/:friendId — historique des pronos d'un ami
router.get('/:userId/history/:friendId', (req, res) => {
  const { userId, friendId } = req.params;

  // Vérifier que c'est bien un ami
  const isFriend = db.prepare('SELECT 1 FROM friendships WHERE user_id = ? AND friend_id = ?').get(userId, friendId);
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

// POST /api/friends — ajouter un ami par code (bidirectionnel)
router.post('/', (req, res) => {
  const { user_id, friend_code } = req.body;

  if (!user_id || !friend_code) {
    return res.status(400).json({ error: 'user_id et friend_code requis.' });
  }

  const friend = db.prepare('SELECT id, pseudo FROM users WHERE friend_code = ?').get(friend_code.toUpperCase().trim());
  if (!friend) {
    return res.status(404).json({ error: 'Code invalide.' });
  }

  if (friend.id === user_id) {
    return res.status(400).json({ error: 'Tu ne peux pas t\'ajouter toi-même.' });
  }

  const existing = db.prepare('SELECT 1 FROM friendships WHERE user_id = ? AND friend_id = ?').get(user_id, friend.id);
  if (existing) {
    return res.status(409).json({ error: 'Déjà dans tes amis.' });
  }

  const insert = db.prepare('INSERT INTO friendships (user_id, friend_id) VALUES (?, ?)');
  db.transaction(() => {
    insert.run(user_id, friend.id);
    insert.run(friend.id, user_id);
  })();

  return res.status(201).json({ friend_id: friend.id, pseudo: friend.pseudo });
});

// DELETE /api/friends/:friendId — retirer un ami (bidirectionnel)
router.delete('/:friendId', (req, res) => {
  const { user_id } = req.body;
  const friendId = req.params.friendId;

  if (!user_id) {
    return res.status(400).json({ error: 'user_id requis.' });
  }

  const del = db.prepare('DELETE FROM friendships WHERE user_id = ? AND friend_id = ?');
  db.transaction(() => {
    del.run(user_id, friendId);
    del.run(friendId, user_id);
  })();

  return res.json({ ok: true });
});

module.exports = router;
