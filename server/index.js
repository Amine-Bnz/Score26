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
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
}));

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
    setInterval(async () => {
      try { await syncResultats(db, { calculerPoints }); }
      catch (e) { logger.error({ err: e }, '[auto-sync résultats] Erreur'); }
    }, 10 * 60 * 1000);
    logger.info('Auto-sync résultats activé (football-data.org, toutes les 10 min)');
  } else {
    logger.warn('Auto-sync résultats désactivé — configurer FOOTBALL_DATA_KEY dans .env');
  }

  // ── Live scores (API-Football) — toutes les 3 min ─────────────────────────
  // La fonction syncLive vérifie d'abord si un match est en cours avant d'appeler l'API
  // → économise les 100 req/jour du tier gratuit
  if (afPret) {
    setInterval(async () => {
      try { await syncLive(db); }
      catch (e) { logger.error({ err: e }, '[auto-sync live] Erreur'); }
    }, 3 * 60 * 1000);
    logger.info('Auto-sync live activé (API-Football, toutes les 3 min)');
  } else {
    logger.warn('Auto-sync live désactivé — configurer API_FOOTBALL_KEY dans .env');
  }

  // ── Notifications push — toutes les 5 min ─────────────────────────────────
  // Envoie une notif 1h avant chaque match pour les users sans prono
  const vapidPret = process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PUBLIC_KEY !== 'your_vapid_public_key';
  if (vapidPret) {
    setInterval(async () => {
      try { await envoyerNotifAvantMatch(db); }
      catch (e) { logger.error({ err: e }, '[push notif] Erreur'); }
    }, 5 * 60 * 1000);
    logger.info('Notifications push activées (VAPID, toutes les 5 min)');
  } else {
    logger.warn('Notifications push désactivées — générer les clés avec : node generate-vapid.js');
  }
}
