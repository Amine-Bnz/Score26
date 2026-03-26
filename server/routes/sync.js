const express = require('express');
const router = express.Router();
const db = require('../database');
const { syncCalendrier, syncResultats } = require('../services/footballData');
const { calculerPoints } = require('../scoring');

// Middleware : vérifie le token admin avant chaque route de sync
function adminOnly(req, res, next) {
  const token = req.query.token || req.headers['x-admin-token'];
  if (!token || token !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Token admin invalide.' });
  }
  next();
}

// POST /api/sync/calendrier?token=xxx
// Récupère les matchs CDM 2026, met à jour api_match_id et les dates officielles
router.post('/calendrier', adminOnly, async (req, res) => {
  try {
    const mis_a_jour = await syncCalendrier(db);
    return res.json({ ok: true, mis_a_jour });
  } catch (e) {
    console.error('[sync calendrier]', e.message);
    return res.status(500).json({ error: e.message });
  }
});

// POST /api/sync/resultats?token=xxx
// Récupère les scores des matchs terminés et calcule les points
router.post('/resultats', adminOnly, async (req, res) => {
  try {
    const mis_a_jour = await syncResultats(db, { calculerPoints });
    return res.json({ ok: true, mis_a_jour });
  } catch (e) {
    console.error('[sync résultats]', e.message);
    return res.status(500).json({ error: e.message });
  }
});

// GET /api/sync/status?token=xxx
// Retourne l'état de la synchro : matchs sans api_match_id, matchs terminés sans score
router.get('/status', adminOnly, (req, res) => {
  const sans_id   = db.prepare('SELECT COUNT(*) as n FROM matchs WHERE api_match_id IS NULL').get().n;
  const sans_score = db.prepare("SELECT COUNT(*) as n FROM matchs WHERE statut = 'termine' AND score_reel_a IS NULL").get().n;
  const total      = db.prepare('SELECT COUNT(*) as n FROM matchs').get().n;
  return res.json({ total, sans_api_id: sans_id, termine_sans_score: sans_score });
});

module.exports = router;
