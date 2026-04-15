const express  = require('express');
const crypto   = require('crypto');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const router   = express.Router();
const db       = require('../database');
const { JWT_SECRET, JWT_EXPIRES } = require('../config/jwt');
const { requireAuth } = require('../middleware/auth');
const { sendVerificationEmail } = require('../services/email');

// Génère un token de vérification email et l'enregistre en BDD (expire dans 24h)
function generateEmailVerification(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  db.prepare('UPDATE users SET email_verification_token = ?, email_verification_expires = ? WHERE id = ?')
    .run(token, expires, userId);
  return token;
}

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

  // Envoi de l'email de vérification (non bloquant)
  const verifToken = generateEmailVerification(id);
  sendVerificationEmail({ to: email.toLowerCase(), pseudo, token: verifToken }).catch(() => {});

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
    const user = db.prepare('SELECT id, pseudo, avatar_seed, friend_code, email, email_verified FROM users WHERE id = ?').get(userId);
    if (!user) return res.status(401).json({ error: 'Utilisateur introuvable.' });
    return res.json(user);
  } catch {
    return res.status(401).json({ error: 'Token invalide ou expiré.' });
  }
});

// POST /api/auth/secure — lier email/password à un compte UUID existant (auth requise)
router.post('/secure', limiter, requireAuth, async (req, res) => {
  const user_id = req.userId;
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'email et password requis.' });
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

  // Envoi de l'email de vérification (non bloquant)
  const userInfo = db.prepare('SELECT pseudo FROM users WHERE id = ?').get(user_id);
  const verifToken = generateEmailVerification(user_id);
  sendVerificationEmail({ to: email.toLowerCase(), pseudo: userInfo.pseudo, token: verifToken }).catch(() => {});

  const token = jwt.sign({ userId: user_id }, JWT_SECRET, { expiresIn: JWT_EXPIRES });

  return res.json({ ok: true, token });
});

// GET /api/auth/verify-email?token=xxx — confirmation de l'email (lien cliqué depuis l'email)
router.get('/verify-email', (req, res) => {
  const { token } = req.query;

  if (!token || typeof token !== 'string' || token.length !== 64) {
    return res.status(400).send(htmlPage('Lien invalide', 'Ce lien de vérification est invalide.'));
  }

  const user = db.prepare('SELECT id, email_verified, email_verification_expires FROM users WHERE email_verification_token = ?').get(token);

  if (!user) {
    return res.status(404).send(htmlPage('Lien expiré', 'Ce lien a déjà été utilisé ou n\'existe pas.'));
  }

  if (user.email_verified === 1) {
    return res.send(htmlPage('Déjà confirmé ✓', 'Ton email est déjà confirmé. Tu peux fermer cette page.'));
  }

  if (user.email_verification_expires && new Date(user.email_verification_expires) < new Date()) {
    return res.status(410).send(htmlPage('Lien expiré', 'Ce lien a expiré. Renvoie un nouveau lien depuis ton profil.'));
  }

  db.prepare('UPDATE users SET email_verified = 1, email_verification_token = NULL, email_verification_expires = NULL WHERE id = ?')
    .run(user.id);

  return res.send(htmlPage('Email confirmé ✓', 'Ton adresse email est maintenant vérifiée. Tu peux fermer cette page et retourner sur Score26.'));
});

// POST /api/auth/resend-verification — renvoyer l'email de vérification (auth requise)
router.post('/resend-verification', limiter, requireAuth, async (req, res) => {
  const user = db.prepare('SELECT id, pseudo, email, email_verified FROM users WHERE id = ?').get(req.userId);

  if (!user || !user.email) {
    return res.status(400).json({ error: 'Aucun email lié à ce compte.' });
  }

  if (user.email_verified === 1) {
    return res.json({ ok: true, already_verified: true });
  }

  const verifToken = generateEmailVerification(user.id);
  const sent = await sendVerificationEmail({ to: user.email, pseudo: user.pseudo, token: verifToken });

  return res.json({ ok: true, sent });
});

// Mini page HTML pour les réponses du lien de vérification (ouvert dans un navigateur)
function htmlPage(title, message) {
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Score26 — ${title}</title>
<style>body{font-family:system-ui,sans-serif;background:#0f0f23;color:#e0e0e0;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px}
.card{background:#1a1a2e;border-radius:16px;padding:32px;max-width:400px;text-align:center}
h1{font-size:1.5rem;margin:0 0 12px;color:#4cc9f0}p{color:#a0a0b0;line-height:1.6}</style>
</head><body><div class="card"><h1>${title}</h1><p>${message}</p></div></body></html>`;
}

module.exports = router;
