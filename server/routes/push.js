const express   = require('express')
const rateLimit = require('express-rate-limit')
const router    = express.Router()
const db        = require('../database')

// 10 abonnements push max par IP sur 15 minutes
const limiterPush = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives. Réessaie dans 15 minutes.' },
})

// GET /api/push/vapid-public-key — retourne la clé publique VAPID au frontend
router.get('/vapid-public-key', (req, res) => {
  const key = process.env.VAPID_PUBLIC_KEY
  if (!key || key === 'your_vapid_public_key') {
    return res.status(503).json({ error: 'Push notifications non configurées sur ce serveur.' })
  }
  return res.json({ publicKey: key })
})

// POST /api/push/subscribe — enregistre ou met à jour une subscription push
// Body : { user_id, subscription: { endpoint, keys: { p256dh, auth } } }
router.post('/subscribe', limiterPush, (req, res) => {
  const { user_id, subscription } = req.body
  if (!user_id || !subscription?.endpoint || !subscription?.keys?.p256dh) {
    return res.status(400).json({ error: 'user_id et subscription (endpoint + keys) requis.' })
  }

  // UPSERT : si l'endpoint existe déjà, on met à jour les clés et le user_id
  db.prepare(`
    INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(endpoint) DO UPDATE SET
      user_id = excluded.user_id,
      p256dh  = excluded.p256dh,
      auth    = excluded.auth
  `).run(user_id, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth)

  return res.json({ ok: true })
})

// DELETE /api/push/unsubscribe — supprime une subscription push
// Body : { endpoint }
router.delete('/unsubscribe', (req, res) => {
  const { endpoint } = req.body
  if (!endpoint) return res.status(400).json({ error: 'endpoint requis.' })
  db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(endpoint)
  return res.json({ ok: true })
})

module.exports = router
