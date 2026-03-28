// Service notifications push — Web Push API avec VAPID
// Appelé toutes les 5min depuis index.js
// Envoie une notif 1h avant chaque match pour les users sans prono

const webPush = require('web-push')
const logger  = require('../logger')

// Initialise web-push avec les clés VAPID (une seule fois)
let vapidInitialized = false
function initWebPush() {
  if (vapidInitialized) return true
  const pub  = process.env.VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  const mail = process.env.VAPID_EMAIL || 'mailto:admin@score26.app'
  if (!pub || !priv || pub === 'your_vapid_public_key') return false
  webPush.setVapidDetails(mail, pub, priv)
  vapidInitialized = true
  return true
}

// Cherche les (user, match) qui doivent recevoir une notif :
//   - match statut a_venir, coup d'envoi dans 55-65 min
//   - user a une subscription push active
//   - user n'a PAS encore de prono pour ce match
//   - notif pas encore envoyée (table notifs_envoyees)
async function envoyerNotifAvantMatch(db) {
  if (!initWebPush()) return

  const lignes = db.prepare(`
    SELECT
      ps.endpoint,
      ps.p256dh,
      ps.auth,
      ps.user_id,
      m.id        AS match_id,
      m.equipe_a,
      m.equipe_b
    FROM matchs m
    CROSS JOIN push_subscriptions ps
    LEFT JOIN pronos p
      ON p.match_id = m.id AND p.user_id = ps.user_id
    LEFT JOIN notifs_envoyees ne
      ON ne.match_id = m.id AND ne.user_id = ps.user_id
    WHERE
      m.statut = 'a_venir'
      AND m.date_coup_envoi >= datetime('now', '+55 minutes')
      AND m.date_coup_envoi <  datetime('now', '+65 minutes')
      AND p.id IS NULL
      AND ne.user_id IS NULL
  `).all()

  if (lignes.length === 0) return

  const insertNotif = db.prepare(
    'INSERT OR IGNORE INTO notifs_envoyees (user_id, match_id) VALUES (?, ?)'
  )
  const deleteSub = db.prepare(
    'DELETE FROM push_subscriptions WHERE endpoint = ?'
  )

  for (const row of lignes) {
    const subscription = {
      endpoint: row.endpoint,
      keys: { p256dh: row.p256dh, auth: row.auth },
    }
    const payload = JSON.stringify({
      title: '⚽ Score26',
      body:  `${row.equipe_a} vs ${row.equipe_b} — Coup d'envoi dans 1h ! / Kickoff in 1h!`,
    })

    try {
      await webPush.sendNotification(subscription, payload)
      insertNotif.run(row.user_id, row.match_id)
    } catch (err) {
      // 410 Gone / 404 Not Found = subscription expirée → supprimer proprement
      if (err.statusCode === 410 || err.statusCode === 404) {
        deleteSub.run(row.endpoint)
      } else {
        logger.error({ err }, '[push notif] erreur envoi')
      }
    }
  }

  logger.info(`[push notif] ${lignes.length} notification(s) envoyée(s)`)
}

module.exports = { envoyerNotifAvantMatch }
