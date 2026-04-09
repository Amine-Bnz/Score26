const express  = require('express');
const rateLimit = require('express-rate-limit');
const router    = express.Router();
const db        = require('../database');
const { rankingCache } = require('../cache');

// 5 créations de compte max par IP sur 15 minutes
const limiterCreation = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives. Réessaie dans 15 minutes.' },
});

// POST /api/users — création d'un compte à l'onboarding
// Body : { id, pseudo, avatar_seed }
router.post('/', limiterCreation, (req, res) => {
  const { id, pseudo, avatar_seed } = req.body;

  if (!id || !pseudo || !avatar_seed) {
    return res.status(400).json({ error: 'Champs manquants : id, pseudo, avatar_seed requis.' });
  }

  // Validation du pseudo : 1-20 caractères, lettres/chiffres/tiret/underscore uniquement
  const PSEUDO_REGEX = /^[a-zA-Z0-9_-]{1,20}$/;
  if (!PSEUDO_REGEX.test(pseudo)) {
    return res.status(400).json({ error: 'Pseudo invalide : 1-20 caractères, lettres, chiffres, - et _ uniquement.' });
  }

  // Vérification que le pseudo n'est pas déjà pris
  const existingUser = db.prepare('SELECT id FROM users WHERE pseudo = ?').get(pseudo);
  if (existingUser) {
    return res.status(409).json({ error: 'Ce pseudo est déjà utilisé.' });
  }

  // Génération d'un friend_code unique
  const existingCodes = new Set(db.prepare('SELECT friend_code FROM users WHERE friend_code IS NOT NULL').all().map(r => r.friend_code));
  let friend_code;
  do { friend_code = db.generateFriendCode(); } while (existingCodes.has(friend_code));

  db.prepare('INSERT INTO users (id, pseudo, avatar_seed, friend_code) VALUES (?, ?, ?, ?)').run(id, pseudo, avatar_seed, friend_code);

  return res.status(201).json({ id, pseudo, avatar_seed, friend_code });
});

// GET /api/users/search?pseudo=xxx — recherche d'un utilisateur par pseudo
router.get('/search', (req, res) => {
  const { pseudo } = req.query;
  if (!pseudo || pseudo.length < 1) {
    return res.status(400).json({ error: 'pseudo requis.' });
  }

  const users = db.prepare(`
    SELECT id, pseudo, avatar_seed FROM users
    WHERE pseudo LIKE ?
    LIMIT 10
  `).all(`%${pseudo}%`);

  return res.json(users);
});

// GET /api/users/ranking — classement global paginé (?page=1&limit=50)
router.get('/ranking', (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
  const offset = (page - 1) * limit;
  const cacheKey = `ranking:${page}:${limit}`;

  const cached = rankingCache.get(cacheKey);
  if (cached) return res.json(cached);

  const total = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;

  const ranking = db.prepare(`
    SELECT u.id, u.pseudo, u.avatar_seed,
      COALESCE(SUM(p.points_obtenus), 0) AS score_total,
      COUNT(CASE WHEN p.points_obtenus = 50 THEN 1 END) AS scores_exacts,
      COUNT(CASE WHEN p.points_obtenus = 20 THEN 1 END) AS bonnes_issues,
      COUNT(CASE WHEN p.points_obtenus = 0  THEN 1 END) AS rates
    FROM users u
    LEFT JOIN pronos p ON p.user_id = u.id AND p.points_obtenus IS NOT NULL
    GROUP BY u.id
    ORDER BY score_total DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset);

  const result = { ranking, page, limit, total, hasMore: offset + ranking.length < total };
  rankingCache.set(cacheKey, result);
  return res.json(result);
});

// GET /api/users/ranking/matchday — classement par journée
router.get('/ranking/matchday', (req, res) => {
  const { journee } = req.query;

  // Si pas de journée spécifiée, prendre la dernière journée terminée
  let targetJournee = journee ? Number(journee) : null;
  if (!targetJournee) {
    const last = db.prepare("SELECT MAX(journee) AS j FROM matchs WHERE statut = 'termine'").get();
    targetJournee = last?.j;
    if (!targetJournee) return res.json([]);
  }

  const ranking = db.prepare(`
    SELECT u.id, u.pseudo, u.avatar_seed,
      COALESCE(SUM(p.points_obtenus), 0) AS score_total,
      COUNT(CASE WHEN p.points_obtenus = 50 THEN 1 END) AS scores_exacts,
      COUNT(CASE WHEN p.points_obtenus = 20 THEN 1 END) AS bonnes_issues,
      COUNT(CASE WHEN p.points_obtenus = 0  THEN 1 END) AS rates
    FROM users u
    JOIN pronos p ON p.user_id = u.id AND p.points_obtenus IS NOT NULL
    JOIN matchs m ON m.id = p.match_id AND m.journee = ?
    GROUP BY u.id
    ORDER BY score_total DESC
    LIMIT 100
  `).all(targetJournee);

  return res.json({ journee: targetJournee, ranking });
});

// GET /api/users/ranking/matchday/list — liste des journées disponibles
router.get('/ranking/matchday/list', (req, res) => {
  const journees = db.prepare("SELECT DISTINCT journee FROM matchs WHERE statut = 'termine' AND journee IS NOT NULL ORDER BY journee DESC").all();
  return res.json(journees.map(r => r.journee));
});

// GET /api/users/:id — récupération du profil + stats
router.get('/:id', (req, res) => {
  const user = db.prepare('SELECT id, pseudo, avatar_seed, friend_code, email, created_at FROM users WHERE id = ?').get(req.params.id);

  if (!user) {
    return res.status(404).json({ error: 'Utilisateur introuvable.' });
  }

  // Calcul des stats : scores exacts, bonnes issues, ratés
  const stats = db.prepare(`
    SELECT
      COUNT(CASE WHEN p.points_obtenus = 50 THEN 1 END) AS scores_exacts,
      COUNT(CASE WHEN p.points_obtenus = 20 THEN 1 END) AS bonnes_issues,
      COUNT(CASE WHEN p.points_obtenus = 0  THEN 1 END) AS rates,
      COALESCE(SUM(p.points_obtenus), 0)                AS score_total
    FROM pronos p
    WHERE p.user_id = ? AND p.points_obtenus IS NOT NULL
  `).get(req.params.id);

  // Rang global : nombre de joueurs avec un score strictement supérieur + 1
  const userScore = stats.score_total;
  const { rank } = db.prepare(`
    SELECT COUNT(*) + 1 AS rank FROM (
      SELECT COALESCE(SUM(p.points_obtenus), 0) AS total
      FROM users u
      LEFT JOIN pronos p ON p.user_id = u.id AND p.points_obtenus IS NOT NULL
      WHERE u.id != ?
      GROUP BY u.id
      HAVING total > ?
    )
  `).get(req.params.id, userScore);

  const totalPlayers = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;

  return res.json({ ...user, stats, rank, totalPlayers });
});

// GET /api/users/:id/history — historique des pronos de l'utilisateur (?phase=groupe&result=exact)
router.get('/:id/history', (req, res) => {
  const userId = req.params.id;
  const { phase, result } = req.query;

  let query = `
    SELECT m.equipe_a, m.equipe_b, m.score_reel_a, m.score_reel_b,
           m.phase, m.groupe, m.date_coup_envoi, m.is_featured,
           p.score_predit_a, p.score_predit_b, p.points_obtenus
    FROM pronos p
    JOIN matchs m ON m.id = p.match_id
    WHERE p.user_id = ? AND m.statut = 'termine' AND p.points_obtenus IS NOT NULL
  `;
  const params = [userId];

  if (phase) {
    if (['groupe', '8e', '4e', 'demi', 'finale'].includes(phase)) {
      query += ' AND m.phase = ?';
      params.push(phase);
    }
  }

  if (result === 'exact') {
    query += ' AND p.score_predit_a = m.score_reel_a AND p.score_predit_b = m.score_reel_b';
  } else if (result === 'good') {
    query += ' AND p.points_obtenus >= 20 AND NOT (p.score_predit_a = m.score_reel_a AND p.score_predit_b = m.score_reel_b)';
  } else if (result === 'miss') {
    query += ' AND p.points_obtenus = 0';
  }

  query += ' ORDER BY m.date_coup_envoi DESC';

  const pronos = db.prepare(query).all(...params);
  return res.json(pronos);
});

// DELETE /api/users/:id — suppression de compte (RGPD)
router.delete('/:id', (req, res) => {
  const userId = req.params.id;
  const { confirm_pseudo } = req.body;

  const user = db.prepare('SELECT id, pseudo FROM users WHERE id = ?').get(userId);
  if (!user) {
    return res.status(404).json({ error: 'Utilisateur introuvable.' });
  }

  // Double vérification : le pseudo doit correspondre
  if (!confirm_pseudo || confirm_pseudo !== user.pseudo) {
    return res.status(400).json({ error: 'Confirmation du pseudo requise.' });
  }

  db.transaction(() => {
    // Transférer la propriété des groupes ou supprimer si vides
    const ownedGroups = db.prepare('SELECT id FROM groups_ WHERE owner_id = ?').all(userId);
    for (const group of ownedGroups) {
      const nextOwner = db.prepare(
        'SELECT user_id FROM group_members WHERE group_id = ? AND user_id != ? ORDER BY joined_at ASC LIMIT 1'
      ).get(group.id, userId);
      if (nextOwner) {
        db.prepare('UPDATE groups_ SET owner_id = ? WHERE id = ?').run(nextOwner.user_id, group.id);
      } else {
        db.prepare('DELETE FROM groups_ WHERE id = ?').run(group.id);
      }
    }

    // Supprimer les pronos (pas de ON DELETE CASCADE sur cette FK)
    db.prepare('DELETE FROM pronos WHERE user_id = ?').run(userId);

    // Supprimer le user — CASCADE supprime : friendships, push_subscriptions,
    // notifs_envoyees, notifs_resultats, group_members, challenges, bonus_pronos
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  })();

  return res.json({ ok: true });
});

module.exports = router;
