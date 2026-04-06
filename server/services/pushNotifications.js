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
  const mail = process.env.VAPID_EMAIL || 'mailto:score26officiel@gmail.com'
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

  // Pour chaque subscription, on utilise son notif_delay personnalisé
  // Fenêtre : [delay-5min, delay+5min] avant le coup d'envoi
  const lignes = db.prepare(`
    SELECT
      ps.endpoint,
      ps.p256dh,
      ps.auth,
      ps.user_id,
      m.id        AS match_id,
      m.equipe_a,
      m.equipe_b,
      COALESCE(ps.notif_delay, 60) AS notif_delay
    FROM push_subscriptions ps
    CROSS JOIN matchs m
    LEFT JOIN pronos p
      ON p.match_id = m.id AND p.user_id = ps.user_id
    LEFT JOIN notifs_envoyees ne
      ON ne.match_id = m.id AND ne.user_id = ps.user_id
    WHERE m.statut = 'a_venir'
      AND m.date_coup_envoi >= datetime('now', '+' || (COALESCE(ps.notif_delay, 60) - 5) || ' minutes')
      AND m.date_coup_envoi <  datetime('now', '+' || (COALESCE(ps.notif_delay, 60) + 5) || ' minutes')
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

// ── Notifications de résultats ─────────────────────────────────────────────
// Envoie une notif quand un match vient de se terminer pour informer des points gagnés
async function envoyerNotifResultat(db, matchId) {
  if (!initWebPush()) return

  // Récupérer le match
  const match = db.prepare('SELECT equipe_a, equipe_b, score_reel_a, score_reel_b FROM matchs WHERE id = ?').get(matchId)
  if (!match) return

  // Récupérer tous les users qui ont pronostiqué ce match ET ont une subscription push
  // ET n'ont pas déjà reçu la notif résultat
  const lignes = db.prepare(`
    SELECT ps.endpoint, ps.p256dh, ps.auth, ps.user_id,
           p.points_obtenus, p.score_predit_a, p.score_predit_b
    FROM pronos p
    JOIN push_subscriptions ps ON ps.user_id = p.user_id
    LEFT JOIN notifs_resultats nr ON nr.user_id = p.user_id AND nr.match_id = p.match_id
    WHERE p.match_id = ? AND p.points_obtenus IS NOT NULL AND nr.user_id IS NULL
  `).all(matchId)

  if (lignes.length === 0) return

  const insertNotif = db.prepare('INSERT OR IGNORE INTO notifs_resultats (user_id, match_id) VALUES (?, ?)')
  const deleteSub   = db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?')

  const scoreStr = `${match.score_reel_a}-${match.score_reel_b}`
  const matchLabel = `${match.equipe_a} ${scoreStr} ${match.equipe_b}`

  for (const row of lignes) {
    const subscription = {
      endpoint: row.endpoint,
      keys: { p256dh: row.p256dh, auth: row.auth },
    }

    let emoji, detail
    if (row.points_obtenus >= 50) {
      emoji = '🎯'
      detail = `Score exact ! +${row.points_obtenus}pts`
    } else if (row.points_obtenus >= 20) {
      emoji = '✅'
      detail = `Bonne issue ! +${row.points_obtenus}pts`
    } else {
      emoji = '❌'
      detail = `Raté · 0pts`
    }

    const payload = JSON.stringify({
      title: `${emoji} Score26`,
      body: `${matchLabel}\n${detail}`,
    })

    try {
      await webPush.sendNotification(subscription, payload)
      insertNotif.run(row.user_id, matchId)
    } catch (err) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        deleteSub.run(row.endpoint)
      } else {
        logger.error({ err }, '[push notif résultat] erreur envoi')
      }
    }
  }

  logger.info(`[push notif résultat] ${lignes.length} notification(s) envoyée(s) pour match ${matchId}`)
}

module.exports = { envoyerNotifAvantMatch, envoyerNotifResultat }
