import { useEffect, useRef, useState } from 'react'
import html2canvas from 'html2canvas'
import { getUser, getVapidPublicKey, subscribePush, unsubscribePush } from '../api'
import { t } from '../i18n'

// Convertit la clé VAPID base64url en Uint8Array (requis par pushManager.subscribe)
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

function avatarSvgUrl(seed) {
  return `https://api.dicebear.com/9.x/bottts/svg?seed=${encodeURIComponent(seed)}`
}
function avatarPngUrl(seed) {
  return `https://api.dicebear.com/9.x/bottts/png?seed=${encodeURIComponent(seed)}&size=96`
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
  const shareCardRef              = useRef(null)

  useEffect(() => {
    getUser(userId).then(data => { setUser(data); setLoading(false) })
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
    // Vérifie si déjà abonné via le Service Worker
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
      // 1. Demander la permission navigateur
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') { setNotifStatus('denied'); return }

      // 2. Récupérer la clé publique VAPID depuis le backend
      const { publicKey, error } = await getVapidPublicKey()
      if (error) { setNotifStatus('default'); return }

      // 3. S'abonner via le Service Worker
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      })

      // 4. Envoyer la subscription au backend
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
    const img = shareCardRef.current.querySelector('img')
    if (img && !img.complete) {
      await new Promise(resolve => { img.onload = resolve; img.onerror = resolve })
    }
    const canvas = await html2canvas(shareCardRef.current, {
      backgroundColor: null, useCORS: true, scale: 2,
    })
    const link = document.createElement('a')
    link.download = `score26-${user.pseudo}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
    setSharing(false)
  }

  if (loading) {
    return <div className="flex justify-center py-20 text-slate-400">...</div>
  }

  const stats = user.stats ?? { scores_exacts: 0, bonnes_issues: 0, rates: 0, score_total: 0 }

  return (
    <div className="flex flex-col items-center pt-8 gap-5">
      {/* Avatar */}
      <div className="relative">
        <img
          src={avatarSvgUrl(user.avatar_seed)}
          alt={user.pseudo}
          className="w-28 h-28 rounded-full bg-slate-100 dark:bg-slate-800 ring-2 ring-slate-200 dark:ring-slate-700"
        />
      </div>

      {/* Pseudo + score */}
      <div className="text-center">
        <p className="text-xl font-bold text-slate-900 dark:text-white">{user.pseudo}</p>
        <p className="text-4xl font-extrabold text-blue-500 mt-1 tabular-nums">
          {stats.score_total ?? 0}
          <span className="text-lg font-semibold text-slate-400 dark:text-slate-500 ml-1.5">pt</span>
        </p>
        <p className="text-xs text-slate-400 dark:text-slate-500 font-semibold tracking-widest uppercase mt-0.5">
          {t(lang, 'totalScore')}
        </p>
      </div>

      {/* Résumé */}
      <div className="w-full bg-slate-50 dark:bg-slate-900 rounded-2xl ring-1 ring-slate-100 dark:ring-slate-800/60 shadow-sm shadow-slate-200 dark:shadow-none p-5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-4">
          {t(lang, 'summary')}
        </p>
        <ul className="flex flex-col gap-3">
          <StatLine value={stats.scores_exacts} label={t(lang, 'exactScores')}  color="text-green-500" dot="bg-green-500" />
          <StatLine value={stats.bonnes_issues} label={t(lang, 'goodOutcomes')} color="text-blue-500"  dot="bg-blue-500"  />
          <StatLine value={stats.rates}         label={t(lang, 'missed')}       color="text-red-500"   dot="bg-red-500"   />
        </ul>
      </div>

      {/* Bouton partager */}
      <button
        onClick={handleShare}
        disabled={sharing}
        className="w-full py-3.5 rounded-2xl bg-blue-500 hover:bg-blue-600 active:bg-blue-700 active:scale-95 text-white font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-blue-500/20"
      >
        {sharing ? '...' : t(lang, 'share')}
      </button>

      {/* Bouton notifications push */}
      <NotifButton status={notifStatus} lang={lang}
        onEnable={handleSubscribePush}
        onDisable={handleUnsubscribePush}
      />

      {/* Card de partage hors-écran */}
      <div ref={shareCardRef} style={{ position: 'absolute', left: '-9999px', top: 0 }}>
        <ShareCard user={user} stats={stats} avatarUrl={avatarPngUrl(user.avatar_seed)} lang={lang} />
      </div>
    </div>
  )
}

// Bouton de gestion des notifications push
function NotifButton({ status, lang, onEnable, onDisable }) {
  if (status === 'checking' || status === 'unsupported') return null

  if (status === 'denied') {
    return (
      <div className="w-full rounded-2xl bg-amber-50 dark:bg-amber-950/30 ring-1 ring-amber-200 dark:ring-amber-800/40 p-4 flex flex-col gap-1.5">
        <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
          🔕 {t(lang, 'notifsBlocked')}
        </p>
        <p className="text-xs text-amber-600/80 dark:text-amber-500/70 leading-relaxed">
          {t(lang, 'notifsBlockedHint')}
        </p>
      </div>
    )
  }

  if (status === 'granted') {
    return (
      <button
        onClick={onDisable}
        className="w-full py-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800 active:scale-95 text-slate-600 dark:text-slate-300 font-semibold text-sm transition-all flex items-center justify-center gap-2"
      >
        <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
        {t(lang, 'disableNotifs')}
      </button>
    )
  }

  return (
    <button
      onClick={onEnable}
      disabled={status === 'subscribing'}
      className="w-full py-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800 active:scale-95 text-slate-600 dark:text-slate-300 font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {status === 'subscribing' ? '...' : t(lang, 'enableNotifs')}
    </button>
  )
}

function StatLine({ value, label, color, dot }) {
  return (
    <li className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dot}`} />
        <span className="text-sm text-slate-600 dark:text-slate-300">{label}</span>
      </div>
      <span className={`text-sm font-bold tabular-nums ${color}`}>{value}</span>
    </li>
  )
}

function ShareCard({ user, stats, avatarUrl, lang }) {
  return (
    <div style={{ width: 360, background: '#0f172a', borderRadius: 24, padding: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, fontFamily: 'Inter, system-ui, sans-serif', color: '#fff' }}>
      <p style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.5px', margin: 0 }}>
        score<span style={{ color: '#3b82f6' }}>26</span>
      </p>
      <img src={avatarUrl} alt={user.pseudo} crossOrigin="anonymous" width={88} height={88}
        style={{ borderRadius: '50%', background: '#1e293b', border: '2px solid #334155' }} />
      <p style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{user.pseudo}</p>
      <p style={{ fontSize: 40, fontWeight: 800, color: '#3b82f6', margin: 0 }}>{stats.score_total}</p>
      <div style={{ width: '100%', background: '#1e293b', borderRadius: 16, padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[
          { n: stats.scores_exacts, label: t(lang, 'exactScores'),  color: '#22c55e' },
          { n: stats.bonnes_issues, label: t(lang, 'goodOutcomes'), color: '#3b82f6' },
          { n: stats.rates,         label: t(lang, 'missed'),       color: '#ef4444' },
        ].map(({ n, label, color }) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: '#94a3b8' }}>{label}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color }}>{n}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
