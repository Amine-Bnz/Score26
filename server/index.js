require('dotenv').config();
const express = require('express');
const crypto  = require('crypto');
const fs      = require('fs');
const path    = require('path');
const cors    = require('cors');
const helmet      = require('helmet');
const compression = require('compression');
const logger      = require('./logger');

const app  = express();
const PORT = process.env.PORT || 3000;

const db                       = require('./database');
const { syncResultats }           = require('./services/footballData');
const { syncLive }                = require('./services/apiFootball');
const { calculerPoints, resoudreChallenges } = require('./scoring');
const { envoyerNotifAvantMatch, envoyerNotifResultat, envoyerRecapJournee }  = require('./services/pushNotifications');
const { createUserRateLimit }  = require('./middleware/userRateLimit');

// Lecture du template HTML au démarrage (pour injection du nonce CSP)
const clientDist = path.join(__dirname, 'public');
let indexHtmlTemplate = '';
try { indexHtmlTemplate = fs.readFileSync(path.join(clientDist, 'index.html'), 'utf-8'); }
catch { /* dev mode : le build client n'existe pas encore */ }

// S7: Nonce CSP par requête — remplace 'unsafe-inline' pour les scripts
app.use((req, res, next) => {
  res.locals.cspNonce = crypto.randomBytes(16).toString('base64');
  next();
});

// Sécurité : headers HTTP + CSP avec nonce (plus de 'unsafe-inline' sur scripts)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", (req, res) => `'nonce-${res.locals.cspNonce}'`],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
    },
  },
}));

// Compression gzip/brotli des réponses HTTP
app.use(compression());

// CORS : ouvert en dev, restreint au domaine en prod via CORS_ORIGIN dans .env
// CORS_ORIGIN peut contenir plusieurs origines séparées par des virgules
const corsRaw = process.env.CORS_ORIGIN || (process.env.NODE_ENV === 'production' ? '' : '*');
if (process.env.NODE_ENV === 'production' && !process.env.CORS_ORIGIN) {
  logger.warn('CORS_ORIGIN non configuré en production — requêtes cross-origin refusées');
}
const corsAllowed = corsRaw === '*' ? '*' : corsRaw.split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({
  origin: corsAllowed === '*' ? '*' : (origin, cb) => {
    if (!origin || corsAllowed.includes(origin)) cb(null, true);
    else cb(new Error('Not allowed by CORS'));
  }
}));

app.use(express.json());

// Rate limit global : 100 req/min par IP sur toutes les routes /api
const rateLimit = require('express-rate-limit');
app.use('/api', rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de requêtes. Réessaie dans 1 minute.' },
}));

// Rate limit strict sur les POST de mutation sociale (10 req/15min par IP)
const socialLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives. Réessaie dans 15 minutes.' },
});
app.post('/api/friends', socialLimiter);
app.post('/api/groups', socialLimiter);
app.post('/api/groups/join', socialLimiter);
app.post('/api/challenges', socialLimiter);

// Rate limit par user_id sur les routes de mutation (protège contre le spam même IP partagée)
const userPronoLimit = createUserRateLimit({ windowMs: 60 * 1000, max: 60, message: 'Trop de pronos. Réessaie dans 1 minute.' });
const userSocialLimit = createUserRateLimit({ windowMs: 15 * 60 * 1000, max: 15, message: 'Trop de tentatives. Réessaie dans 15 minutes.' });
app.post('/api/pronos', userPronoLimit);
app.post('/api/friends', userSocialLimit);
app.post('/api/groups', userSocialLimit);
app.post('/api/groups/join', userSocialLimit);
app.post('/api/challenges', userSocialLimit);

app.use('/api/auth',     require('./routes/auth'));
app.use('/api/users',    require('./routes/users'));
app.use('/api/matchs',   require('./routes/matchs'));
app.use('/api/pronos',   require('./routes/pronos'));
app.use('/api/friends',  require('./routes/friends'));
app.use('/api/groups',      require('./routes/groups'));
app.use('/api/challenges',  require('./routes/challenges'));
app.use('/api/sync',        require('./routes/sync'));
app.use('/api/push',     require('./routes/push'));
app.use('/api/bonus',    require('./routes/bonus'));
app.use('/api/admin',    require('./routes/admin'));
app.use('/api/reactions', require('./routes/reactions'));
app.use('/api/blocks',    require('./routes/blocks'));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Servir le build client (React SPA)
// P3: cache long sur les assets versionnés (hash dans le nom de fichier)
app.use('/assets', express.static(path.join(clientDist, 'assets'), {
  maxAge: '1y',
  immutable: true,
}));
// index: false → index.html toujours servi via le fallback SPA (avec nonce CSP)
app.use(express.static(clientDist, { index: false }));
// Fallback SPA : injecte le nonce CSP dans le HTML avant envoi
app.get('/{*path}', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  if (!indexHtmlTemplate) return res.status(404).send('Build client introuvable.');
  res.type('html').send(indexHtmlTemplate.replace(/__CSP_NONCE__/g, res.locals.cspNonce));
});

// Middleware d'erreur — log toutes les réponses 4xx/5xx
app.use((err, req, res, next) => {
  logger.error({ err, method: req.method, url: req.url }, 'Erreur Express');
  res.status(err.status || 500).json({ error: err.message || 'Erreur interne' });
});

app.listen(PORT, () => {
  logger.info(`Serveur démarré sur le port ${PORT}`);
  lancerPolling();
});

// Polling avec backoff exponentiel : délai ×2 à chaque erreur (max 30 min), reset au succès
function pollWithBackoff(fn, baseMs, label) {
  const MAX_DELAY = 30 * 60 * 1000;
  let failures = 0;
  async function tick() {
    try {
      await fn();
      failures = 0;
    } catch (e) {
      failures++;
      const delay = Math.min(baseMs * Math.pow(2, failures), MAX_DELAY);
      logger.error({ err: e, nextRetryMs: delay }, `[${label}] Erreur (tentative ${failures})`);
    }
    const nextDelay = failures === 0 ? baseMs : Math.min(baseMs * Math.pow(2, failures), MAX_DELAY);
    setTimeout(tick, nextDelay);
  }
  setTimeout(tick, baseMs);
}

function lancerPolling() {
  // ── Verrouillage automatique des pronos — toutes les 60s ─────────────────
  setInterval(() => {
    try {
      db.prepare(`
        UPDATE pronos SET verrouille = 1
        WHERE verrouille = 0 AND match_id IN (
          SELECT id FROM matchs WHERE date_coup_envoi <= datetime('now')
        )
      `).run();

      // Expirer les challenges pending dont le match a démarré
      const expired = db.prepare(`
        UPDATE challenges SET status = 'expired'
        WHERE status = 'pending' AND match_id IN (
          SELECT id FROM matchs WHERE date_coup_envoi <= datetime('now')
        )
      `).run();
      if (expired.changes > 0) {
        logger.info({ count: expired.changes }, '[challenges] Défis expirés automatiquement');
      }
    } catch (e) { logger.error({ err: e }, '[verrouillage pronos] Erreur'); }
  }, 60 * 1000);

  const fdKey  = process.env.FOOTBALL_DATA_KEY;
  const afKey  = process.env.API_FOOTBALL_KEY;
  const fdPret = fdKey && fdKey !== 'your_key_here';
  const afPret = afKey && afKey !== 'your_key_here';

  // ── Résultats finaux (football-data.org) — toutes les 10 min ──────────────
  if (fdPret) {
    pollWithBackoff(() => syncResultats(db, { calculerPoints, envoyerNotifResultat, resoudreChallenges, envoyerRecapJournee }), 10 * 60 * 1000, 'auto-sync résultats');
    logger.info('Auto-sync résultats activé (football-data.org, toutes les 10 min)');
  } else {
    logger.warn('Auto-sync résultats désactivé — configurer FOOTBALL_DATA_KEY dans .env');
  }

  // ── Live scores (API-Football) — toutes les 3 min ─────────────────────────
  if (afPret) {
    pollWithBackoff(() => syncLive(db), 3 * 60 * 1000, 'auto-sync live');
    logger.info('Auto-sync live activé (API-Football, toutes les 3 min)');
  } else {
    logger.warn('Auto-sync live désactivé — configurer API_FOOTBALL_KEY dans .env');
  }

  // ── Notifications push — toutes les 5 min ─────────────────────────────────
  const vapidPret = process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PUBLIC_KEY !== 'your_vapid_public_key';
  if (vapidPret) {
    pollWithBackoff(() => envoyerNotifAvantMatch(db), 5 * 60 * 1000, 'push notif');
    logger.info('Notifications push activées (VAPID, toutes les 5 min)');
  } else {
    logger.warn('Notifications push désactivées — générer les clés avec : node generate-vapid.js');
  }

  // ── Métriques basiques — toutes les heures ──────────────────────────────
  setInterval(() => {
    try {
      const users      = db.prepare('SELECT COUNT(*) as n FROM users').get().n;
      const pronos     = db.prepare('SELECT COUNT(*) as n FROM pronos').get().n;
      const enCours    = db.prepare("SELECT COUNT(*) as n FROM matchs WHERE statut = 'en_cours'").get().n;
      const termines   = db.prepare("SELECT COUNT(*) as n FROM matchs WHERE statut = 'termine'").get().n;
      const pushSubs   = db.prepare('SELECT COUNT(*) as n FROM push_subscriptions').get().n;
      logger.info({ users, pronos_total: pronos, matchs_en_cours: enCours, matchs_termines: termines, push_subs: pushSubs }, '[metrics] Résumé');
    } catch (e) { logger.error({ err: e }, '[metrics] Erreur'); }
  }, 60 * 60 * 1000);
}
