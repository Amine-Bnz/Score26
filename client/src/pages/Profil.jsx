import { useEffect, useRef, useState } from 'react'
import html2canvas from 'html2canvas'
import { getUser, getVapidPublicKey, subscribePush, unsubscribePush } from '../api'
import { t } from '../i18n'
import LegalModal from '../components/LegalModal'
import AvatarInitials, { AvatarInitialsInline } from '../components/AvatarInitials'

// Convertit la clé VAPID base64url en Uint8Array (requis par pushManager.subscribe)
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

// Statuts possibles du bouton de notification
// 'checking'     — on vérifie l'état au montage
// 'unsupported'  — le navigateur ne supporte pas les notifs push
// 'default'      — pas encore demandé
// 'granted'      — abonné et actif
// 'denied'       — l'user a refusé (irréversible sauf reset navigateur)
// 'subscribing'  — en cours d'abonnement

export default function Profil({ userId, lang }) {
  const [user, setUser]           = useState(null)
  const [loading, setLoading]     = useState(true)
  const [sharing, setSharing]     = useState(false)
  const [notifStatus, setNotifStatus] = useState('checking')
  const [showLegal, setShowLegal] = useState(false)
  const shareCardRef              = useRef(null)

  useEffect(() => {
    getUser(userId)
      .then(data => { setUser(data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [userId])

  // Vérifie l'état des notifications au montage
  useEffect(() => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      setNotifStatus('unsupported')
      return
    }
    if (Notification.permission === 'denied') {
      setNotifStatus('denied')
      return
    }
    navigator.serviceWorker.ready.then(reg => {
      reg.pushManager.getSubscription().then(sub => {
        setNotifStatus(sub ? 'granted' : 'default')
      })
    }).catch(() => setNotifStatus('unsupported'))
  }, [])

  async function handleSubscribePush() {
    if (notifStatus === 'subscribing') return
    setNotifStatus('subscribing')
    try {
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') { setNotifStatus('denied'); return }

      const { publicKey, error } = await getVapidPublicKey()
      if (error) { setNotifStatus('default'); return }

      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      })

      await subscribePush({ user_id: userId, subscription: sub.toJSON() })
      setNotifStatus('granted')
    } catch (err) {
      console.error('[push subscribe]', err)
      setNotifStatus('default')
    }
  }

  async function handleUnsubscribePush() {
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await unsubscribePush({ endpoint: sub.endpoint })
        await sub.unsubscribe()
      }
      setNotifStatus('default')
    } catch (err) {
      console.error('[push unsubscribe]', err)
    }
  }

  async function handleShare() {
    if (!shareCardRef.current || sharing) return
    setSharing(true)
    try {
      const canvas = await html2canvas(shareCardRef.current, {
        backgroundColor: null, useCORS: true, scale: 2,
      })
      const link = document.createElement('a')
      link.download = `score26-${user.pseudo}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } catch (err) {
      console.error('[share]', err)
    } finally {
      setSharing(false)
    }
  }

  if (loading) return <div className="flex justify-center py-20 text-surface-400">...</div>
  if (!user)   return <div className="flex justify-center py-20 text-surface-400">—</div>

  const stats = user.stats ?? { scores_exacts: 0, bonnes_issues: 0, rates: 0, score_total: 0 }

  return (
    <div className="flex flex-col items-center pt-8 gap-6">
      {/* Avatar */}
      <AvatarInitials pseudo={user.pseudo} size={96} />

      {/* Pseudo + score */}
      <div className="text-center">
        <p className="font-display text-xl font-bold text-surface-900 dark:text-white">{user.pseudo}</p>
        <p className="font-display text-3xl font-bold text-accent mt-1 tabular-nums">
          {stats.score_total ?? 0}
          <span className="text-base font-medium text-surface-400 dark:text-surface-500 ml-1">pt</span>
        </p>
      </div>

      {/* Stats en grille 3 colonnes */}
      <div className="w-full grid grid-cols-3 gap-3">
        <StatBlock value={stats.scores_exacts} label={t(lang, 'exactScores')}  color="text-result-exact" bg="bg-result-exact/8" />
        <StatBlock value={stats.bonnes_issues} label={t(lang, 'goodOutcomes')} color="text-accent"       bg="bg-accent/8" />
        <StatBlock value={stats.rates}         label={t(lang, 'missed')}       color="text-result-miss"  bg="bg-result-miss/8" />
      </div>

      {/* Bouton partager */}
      <button
        onClick={handleShare}
        disabled={sharing}
        className="w-full py-3 rounded-xl bg-accent hover:bg-accent-dark active:scale-[0.98] text-surface-950 font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
      >
        {sharing ? '...' : t(lang, 'share')}
      </button>

      {/* Bouton notifications push */}
      <NotifButton status={notifStatus} lang={lang}
        onEnable={handleSubscribePush}
        onDisable={handleUnsubscribePush}
      />

      {/* Lien politique de confidentialité */}
      <button
        onClick={() => setShowLegal(true)}
        className="text-xs text-surface-400 dark:text-surface-600 hover:text-surface-600 dark:hover:text-surface-400 transition-colors pb-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
      >
        {lang === 'fr' ? 'Politique de confidentialité' : 'Privacy Policy'}
      </button>

      {showLegal && <LegalModal lang={lang} onClose={() => setShowLegal(false)} />}

      {/* Card de partage hors-écran */}
      <div ref={shareCardRef} style={{ position: 'absolute', left: '-9999px', top: 0 }}>
        <ShareCard user={user} stats={stats} lang={lang} />
      </div>
    </div>
  )
}

// Bouton de gestion des notifications push
function NotifButton({ status, lang, onEnable, onDisable }) {
  if (status === 'checking' || status === 'unsupported') return null

  if (status === 'denied') {
    return (
      <div className="w-full rounded-xl bg-gold-muted border border-gold/20 p-4 flex flex-col gap-1.5">
        <p className="text-sm font-semibold text-gold-dark dark:text-gold-light">
          🔕 {t(lang, 'notifsBlocked')}
        </p>
        <p className="text-xs text-gold-dark/70 dark:text-gold-light/60 leading-relaxed">
          {t(lang, 'notifsBlockedHint')}
        </p>
      </div>
    )
  }

  if (status === 'granted') {
    return (
      <button
        onClick={onDisable}
        className="w-full py-3 rounded-xl bg-surface-100 dark:bg-surface-800 active:scale-[0.98] text-surface-600 dark:text-surface-300 font-medium text-sm transition-all flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-result-exact flex-shrink-0" />
        {t(lang, 'disableNotifs')}
      </button>
    )
  }

  return (
    <button
      onClick={onEnable}
      disabled={status === 'subscribing'}
      className="w-full py-3 rounded-xl bg-surface-100 dark:bg-surface-800 active:scale-[0.98] text-surface-600 dark:text-surface-300 font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      {status === 'subscribing' ? '...' : t(lang, 'enableNotifs')}
    </button>
  )
}

function StatBlock({ value, label, color, bg }) {
  return (
    <div className={`flex flex-col items-center gap-1 py-3 rounded-xl ${bg}`}>
      <span className={`font-display text-xl font-bold tabular-nums ${color}`}>{value}</span>
      <span className="text-[10px] font-medium text-surface-500 dark:text-surface-400 text-center leading-tight">{label}</span>
    </div>
  )
}

function ShareCard({ user, stats, lang }) {
  return (
    <div style={{ width: 360, background: '#0c0f1a', borderRadius: 20, padding: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, fontFamily: '"Space Grotesk", Inter, system-ui, sans-serif', color: '#f0f0f5' }}>
      <p style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.5px', margin: 0 }}>
        score<span style={{ color: '#d4a24e' }}>26</span>
      </p>
      <AvatarInitialsInline pseudo={user.pseudo} size={80} />
      <p style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{user.pseudo}</p>
      <p style={{ fontSize: 36, fontWeight: 700, color: '#d4a24e', margin: 0 }}>{stats.score_total}</p>
      <div style={{ width: '100%', background: '#141827', borderRadius: 12, padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[
          { n: stats.scores_exacts, label: t(lang, 'exactScores'),  color: '#34c770' },
          { n: stats.bonnes_issues, label: t(lang, 'goodOutcomes'), color: '#d4a24e' },
          { n: stats.rates,         label: t(lang, 'missed'),       color: '#e8564a' },
        ].map(({ n, label, color }) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: '#7a82a0' }}>{label}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color }}>{n}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
