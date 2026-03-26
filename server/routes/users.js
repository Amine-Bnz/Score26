const express  = require('express');
const rateLimit = require('express-rate-limit');
const router    = express.Router();
const db        = require('../database');

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
  const existing = db.prepare('SELECT id FROM users WHERE pseudo = ?').get(pseudo);
  if (existing) {
    return res.status(409).json({ error: 'Ce pseudo est déjà utilisé.' });
  }

  db.prepare('INSERT INTO users (id, pseudo, avatar_seed) VALUES (?, ?, ?)').run(id, pseudo, avatar_seed);

  return res.status(201).json({ id, pseudo, avatar_seed });
});

// GET /api/users/:id — récupération du profil + stats
router.get('/:id', (req, res) => {
  const user = db.prepare('SELECT id, pseudo, avatar_seed, created_at FROM users WHERE id = ?').get(req.params.id);

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

  return res.json({ ...user, stats });
});

module.exports = router;
