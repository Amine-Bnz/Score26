const express = require('express');
const crypto  = require('crypto');
const router  = express.Router();
const db      = require('../database');
const { requireAuth } = require('../middleware/auth');
const { validateUUIDParam } = require('../middleware/validate');

// S8: valider le format UUID sur les paramètres :userId et :id (challenge UUID)
router.param('userId', validateUUIDParam);
router.param('id', validateUUIDParam);

// GET /api/challenges/:userId — mes défis (en cours + historique)
// Inclut les pronos et points des deux joueurs quand disponibles
router.get('/:userId', (req, res) => {
  const userId = req.params.userId;

  const challenges = db.prepare(`
    SELECT c.id, c.challenger_id, c.opponent_id, c.match_id, c.status, c.winner_id, c.created_at,
      m.equipe_a, m.equipe_b, m.date_coup_envoi, m.score_reel_a, m.score_reel_b, m.statut AS match_statut,
      uc.pseudo AS challenger_pseudo, uc.avatar_seed AS challenger_avatar,
      uo.pseudo AS opponent_pseudo, uo.avatar_seed AS opponent_avatar,
      p1.score_predit_a AS challenger_predit_a, p1.score_predit_b AS challenger_predit_b, p1.points_obtenus AS challenger_points,
      p2.score_predit_a AS opponent_predit_a, p2.score_predit_b AS opponent_predit_b, p2.points_obtenus AS opponent_points
    FROM challenges c
    JOIN matchs m ON m.id = c.match_id
    JOIN users uc ON uc.id = c.challenger_id
    JOIN users uo ON uo.id = c.opponent_id
    LEFT JOIN pronos p1 ON p1.user_id = c.challenger_id AND p1.match_id = c.match_id
    LEFT JOIN pronos p2 ON p2.user_id = c.opponent_id  AND p2.match_id = c.match_id
    WHERE c.challenger_id = ? OR c.opponent_id = ?
    ORDER BY c.created_at DESC
    LIMIT 50
  `).all(userId, userId);

  return res.json(challenges);
});

// POST /api/challenges — créer un défi (auth requise)
router.post('/', requireAuth, (req, res) => {
  const user_id = req.userId;
  const { opponent_id, match_id } = req.body;

  if (!opponent_id || !match_id) {
    return res.status(400).json({ error: 'opponent_id et match_id requis.' });
  }

  if (user_id === opponent_id) {
    return res.status(400).json({ error: 'Tu ne peux pas te défier toi-même.' });
  }

  // Vérifier que le match est à venir
  const match = db.prepare("SELECT id, statut FROM matchs WHERE id = ?").get(match_id);
  if (!match || match.statut !== 'a_venir') {
    return res.status(400).json({ error: 'Le match doit être à venir.' });
  }

  // Vérifier qu'ils sont amis
  const isFriend = db.prepare('SELECT 1 FROM friendships WHERE user_id = ? AND friend_id = ?').get(user_id, opponent_id);
  if (!isFriend) {
    return res.status(400).json({ error: 'Vous devez être amis.' });
  }

  // Vérifier pas de défi en double
  const existing = db.prepare(`
    SELECT 1 FROM challenges
    WHERE match_id = ? AND status IN ('pending', 'accepted')
    AND ((challenger_id = ? AND opponent_id = ?) OR (challenger_id = ? AND opponent_id = ?))
  `).get(match_id, user_id, opponent_id, opponent_id, user_id);
  if (existing) {
    return res.status(409).json({ error: 'Un défi existe déjà pour ce match.' });
  }

  const id = crypto.randomUUID();
  db.prepare('INSERT INTO challenges (id, challenger_id, opponent_id, match_id) VALUES (?, ?, ?, ?)')
    .run(id, user_id, opponent_id, match_id);

  return res.status(201).json({ id, status: 'pending' });
});

// POST /api/challenges/:id/accept — accepter un défi (auth requise)
router.post('/:id/accept', requireAuth, (req, res) => {
  const user_id = req.userId;
  const challenge = db.prepare('SELECT * FROM challenges WHERE id = ?').get(req.params.id);

  if (!challenge) return res.status(404).json({ error: 'Défi introuvable.' });
  if (challenge.opponent_id !== user_id) return res.status(403).json({ error: 'Seul l\'adversaire peut accepter.' });
  if (challenge.status !== 'pending') return res.status(400).json({ error: 'Ce défi n\'est plus en attente.' });

  db.prepare("UPDATE challenges SET status = 'accepted' WHERE id = ?").run(req.params.id);
  return res.json({ ok: true });
});

// POST /api/challenges/:id/decline — refuser un défi (auth requise)
router.post('/:id/decline', requireAuth, (req, res) => {
  const user_id = req.userId;
  const challenge = db.prepare('SELECT * FROM challenges WHERE id = ?').get(req.params.id);

  if (!challenge) return res.status(404).json({ error: 'Défi introuvable.' });
  if (challenge.opponent_id !== user_id) return res.status(403).json({ error: 'Seul l\'adversaire peut refuser.' });

  db.prepare("UPDATE challenges SET status = 'declined' WHERE id = ?").run(req.params.id);
  return res.json({ ok: true });
});

// DELETE /api/challenges/:id — annuler un défi (par le challenger uniquement, si pending, auth requise)
router.delete('/:id', requireAuth, (req, res) => {
  const user_id = req.userId;
  const challenge = db.prepare('SELECT * FROM challenges WHERE id = ?').get(req.params.id);

  if (!challenge) return res.status(404).json({ error: 'Défi introuvable.' });
  if (challenge.challenger_id !== user_id) return res.status(403).json({ error: 'Seul le créateur peut annuler.' });
  if (challenge.status !== 'pending') return res.status(400).json({ error: 'Seul un défi en attente peut être annulé.' });

  db.prepare('DELETE FROM challenges WHERE id = ?').run(req.params.id);
  return res.json({ ok: true });
});

module.exports = router;
