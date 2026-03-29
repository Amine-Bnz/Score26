require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const logger  = require('./logger');

const app  = express();
const PORT = process.env.PORT || 3000;

const db                       = require('./database');
const { syncResultats }           = require('./services/footballData');
const { syncLive }                = require('./services/apiFootball');
const { calculerPoints }          = require('./scoring');
const { envoyerNotifAvantMatch }  = require('./services/pushNotifications');

// Sécurité : headers HTTP (X-Content-Type-Options, X-Frame-Options, etc.)
app.use(helmet());

// CORS : ouvert en dev, restreint au domaine en prod via CORS_ORIGIN dans .env
// En production sans CORS_ORIGIN configuré → warning et refus par défaut
const corsOrigin = process.env.CORS_ORIGIN || (process.env.NODE_ENV === 'production' ? false : '*');
if (process.env.NODE_ENV === 'production' && !process.env.CORS_ORIGIN) {
  logger.warn('CORS_ORIGIN non configuré en production — requêtes cross-origin refusées');
}
app.use(cors({ origin: corsOrigin }));

app.use(express.json());

app.use('/api/users',  require('./routes/users'));
app.use('/api/matchs', require('./routes/matchs'));
app.use('/api/pronos', require('./routes/pronos'));
app.use('/api/sync',   require('./routes/sync'));
app.use('/api/push',   require('./routes/push'));
app.use('/api/admin',  require('./routes/admin'));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

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
    } catch (e) { logger.error({ err: e }, '[verrouillage pronos] Erreur'); }
  }, 60 * 1000);

  const fdKey  = process.env.FOOTBALL_DATA_KEY;
  const afKey  = process.env.API_FOOTBALL_KEY;
  const fdPret = fdKey && fdKey !== 'your_key_here';
  const afPret = afKey && afKey !== 'your_key_here';

  // ── Résultats finaux (football-data.org) — toutes les 10 min ──────────────
  if (fdPret) {
    pollWithBackoff(() => syncResultats(db, { calculerPoints }), 10 * 60 * 1000, 'auto-sync résultats');
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
}
