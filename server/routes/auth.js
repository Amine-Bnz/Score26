const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const router   = express.Router();
const db       = require('../database');

const JWT_SECRET = process.env.JWT_SECRET || 'score26-dev-secret-change-me';
const JWT_EXPIRES = '30d';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Trop de tentatives. Réessaie dans 15 minutes.' },
});

// POST /api/auth/register — création de compte avec email/password
router.post('/register', limiter, async (req, res) => {
  const { pseudo, email, password } = req.body;

  if (!pseudo || !email || !password) {
    return res.status(400).json({ error: 'pseudo, email et password requis.' });
  }

  const PSEUDO_REGEX = /^[a-zA-Z0-9_-]{1,20}$/;
  if (!PSEUDO_REGEX.test(pseudo)) {
    return res.status(400).json({ error: 'Pseudo invalide : 1-20 caractères, lettres, chiffres, - et _ uniquement.' });
  }

  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!EMAIL_REGEX.test(email)) {
    return res.status(400).json({ error: 'Email invalide.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères.' });
  }

  // Vérifier pseudo et email uniques
  const existingPseudo = db.prepare('SELECT id FROM users WHERE pseudo = ?').get(pseudo);
  if (existingPseudo) {
    return res.status(409).json({ error: 'Ce pseudo est déjà utilisé.' });
  }

  const existingEmail = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existingEmail) {
    return res.status(409).json({ error: 'Cet email est déjà utilisé.' });
  }

  const id = require('crypto').randomUUID();
  const password_hash = await bcrypt.hash(password, 10);
  const avatar_seed = pseudo;

  // Générer friend_code unique
  const existing = new Set(db.prepare('SELECT friend_code FROM users WHERE friend_code IS NOT NULL').all().map(r => r.friend_code));
  let friend_code;
  do { friend_code = db.generateFriendCode(); } while (existing.has(friend_code));

  db.prepare('INSERT INTO users (id, pseudo, email, password_hash, avatar_seed, friend_code) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, pseudo, email.toLowerCase(), password_hash, avatar_seed, friend_code);

  const token = jwt.sign({ userId: id }, JWT_SECRET, { expiresIn: JWT_EXPIRES });

  return res.status(201).json({ id, pseudo, avatar_seed, friend_code, token });
});

// POST /api/auth/login — connexion avec email/password
router.post('/login', limiter, async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'email et password requis.' });
  }

  const user = db.prepare('SELECT id, pseudo, avatar_seed, friend_code, password_hash FROM users WHERE email = ?').get(email.toLowerCase());
  if (!user || !user.password_hash) {
    return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });
  }

  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES });

  return res.json({ id: user.id, pseudo: user.pseudo, avatar_seed: user.avatar_seed, friend_code: user.friend_code, token });
});

// GET /api/auth/me — vérification du token
router.get('/me', (req, res) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token requis.' });
  }

  try {
    const { userId } = jwt.verify(auth.slice(7), JWT_SECRET);
    const user = db.prepare('SELECT id, pseudo, avatar_seed, friend_code, email FROM users WHERE id = ?').get(userId);
    if (!user) return res.status(401).json({ error: 'Utilisateur introuvable.' });
    return res.json(user);
  } catch {
    return res.status(401).json({ error: 'Token invalide ou expiré.' });
  }
});

// POST /api/auth/secure — lier email/password à un compte UUID existant
router.post('/secure', limiter, async (req, res) => {
  const { user_id, email, password } = req.body;

  if (!user_id || !email || !password) {
    return res.status(400).json({ error: 'user_id, email et password requis.' });
  }

  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!EMAIL_REGEX.test(email)) {
    return res.status(400).json({ error: 'Email invalide.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères.' });
  }

  const user = db.prepare('SELECT id, password_hash FROM users WHERE id = ?').get(user_id);
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable.' });
  if (user.password_hash) return res.status(409).json({ error: 'Ce compte a déjà un mot de passe.' });

  const existingEmail = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existingEmail) return res.status(409).json({ error: 'Cet email est déjà utilisé.' });

  const password_hash = await bcrypt.hash(password, 10);
  db.prepare('UPDATE users SET email = ?, password_hash = ? WHERE id = ?').run(email.toLowerCase(), password_hash, user_id);

  const token = jwt.sign({ userId: user_id }, JWT_SECRET, { expiresIn: JWT_EXPIRES });

  return res.json({ ok: true, token });
});

module.exports = router;
