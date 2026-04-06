import { useEffect, useState } from 'react'
import { getUser, getVapidPublicKey, subscribePush, unsubscribePush, secureAccount, getNotifSettings, updateNotifDelay } from '../api'
import { t } from '../i18n'
import AvatarInitials from '../components/AvatarInitials'
import { ProfileSkeleton } from '../components/Skeleton'

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

export default function Profil({ userId, lang, friendCode, theme, onThemeToggle }) {
  const [user, setUser]           = useState(null)
  const [loading, setLoading]     = useState(true)
  const [notifStatus, setNotifStatus] = useState('checking')
  const [showSecure, setShowSecure] = useState(false)
  const [secureEmail, setSecureEmail] = useState('')
  const [securePass, setSecurePass] = useState('')
  const [secureError, setSecureError] = useState('')
  const [secureLoading, setSecureLoading] = useState(false)

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

  if (loading) return <ProfileSkeleton />
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

      {/* Code ami */}
      {friendCode && (
        <div className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-accent/5 border border-accent/15">
          <span className="text-xs font-medium text-surface-500 dark:text-surface-400">
            {lang === 'fr' ? 'Mon code ami' : 'My friend code'}
          </span>
          <span className="font-display font-bold text-accent tracking-widest flex-1">{friendCode}</span>
          <button
            onClick={() => navigator.clipboard?.writeText(friendCode)}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-accent text-surface-950 active:scale-95 transition-transform"
          >
            {lang === 'fr' ? 'Copier' : 'Copy'}
          </button>
        </div>
      )}

      {/* Sélecteur de thème */}
      <div className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-100 dark:bg-surface-800">
        <span className="text-xs font-medium text-surface-500 dark:text-surface-400 flex-shrink-0">
          {t(lang, 'themeLabel')}
        </span>
        <div className="flex gap-1.5 flex-1 justify-end">
          {['light', 'dark'].map(v => (
            <button
              key={v}
              onClick={theme !== v ? onThemeToggle : undefined}
              className={`text-[10px] font-semibold px-2.5 py-1 rounded-lg transition-colors
                ${theme === v
                  ? 'bg-accent text-surface-950'
                  : 'bg-surface-200 dark:bg-surface-700 text-surface-500 dark:text-surface-400'}`}
            >
              {t(lang, v === 'light' ? 'themeLight' : 'themeDark')}
            </button>
          ))}
        </div>
      </div>

      {/* Bouton notifications push */}
      <NotifButton status={notifStatus} lang={lang}
        onEnable={handleSubscribePush}
        onDisable={handleUnsubscribePush}
      />

      {/* Délai de rappel personnalisable */}
      {notifStatus === 'granted' && <NotifDelaySelector userId={userId} lang={lang} />}

      {/* Sécuriser le compte (pour les comptes sans email) */}
      {user && !user.email && (
        <div className="w-full">
          {!showSecure ? (
            <button
              onClick={() => setShowSecure(true)}
              className="w-full py-3 rounded-xl bg-surface-100 dark:bg-surface-800 active:scale-[0.98] text-surface-600 dark:text-surface-300 font-medium text-sm transition-all"
            >
              {t(lang, 'secureAccount')}
            </button>
          ) : (
            <div className="flex flex-col gap-2 p-4 rounded-xl bg-surface-100 dark:bg-surface-800">
              <p className="text-xs text-surface-400 mb-1">{t(lang, 'secureAccountHint')}</p>
              <input
                type="email"
                placeholder={t(lang, 'email')}
                value={secureEmail} onChange={e => setSecureEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              />
              <input
                type="password"
                placeholder={t(lang, 'password')}
                value={securePass} onChange={e => setSecurePass(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              />
              {secureError && <p className="text-result-miss text-xs">{secureError}</p>}
              <button
                disabled={secureLoading}
                onClick={async () => {
                  setSecureError('')
                  if (!secureEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(secureEmail)) { setSecureError(t(lang, 'emailInvalid')); return }
                  if (securePass.length < 6) { setSecureError(t(lang, 'passwordTooShort')); return }
                  setSecureLoading(true)
                  const res = await secureAccount({ user_id: userId, email: secureEmail, password: securePass })
                  if (res.error) { setSecureError(res.error); setSecureLoading(false); return }
                  if (res.token) localStorage.setItem('score26_token', res.token)
                  setUser({ ...user, email: secureEmail })
                  setShowSecure(false)
                  setSecureLoading(false)
                }}
                className="w-full py-2.5 rounded-lg bg-accent text-surface-950 font-semibold text-sm active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {secureLoading ? '...' : t(lang, 'validate')}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Déconnexion */}
      <button
        onClick={() => {
          localStorage.removeItem('score26_user_id')
          localStorage.removeItem('score26_pseudo')
          localStorage.removeItem('score26_token')
          window.location.reload()
        }}
        className="w-full py-3 rounded-xl bg-surface-100 dark:bg-surface-800 active:scale-[0.98] text-result-miss font-medium text-sm transition-all"
      >
        {t(lang, 'logout')}
      </button>

      {/* Lien politique de confidentialité */}
      <a
        href="/privacy.html"
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-surface-400 dark:text-surface-600 hover:text-surface-600 dark:hover:text-surface-400 transition-colors pb-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
      >
        {lang === 'fr' ? 'Politique de confidentialité' : 'Privacy Policy'}
      </a>

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
          {t(lang, 'notifsBlocked')}
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

function NotifDelaySelector({ userId, lang }) {
  const [delay, setDelay] = useState(60)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    getNotifSettings(userId).then(data => {
      if (data.notif_delay) setDelay(data.notif_delay)
      setLoaded(true)
    }).catch(() => setLoaded(true))
  }, [userId])

  async function handleChange(val) {
    const v = Number(val)
    setDelay(v)
    await updateNotifDelay({ user_id: userId, notif_delay: v })
  }

  if (!loaded) return null

  const options = [
    { value: 30, label: t(lang, 'notifDelay30') },
    { value: 60, label: t(lang, 'notifDelay60') },
    { value: 120, label: t(lang, 'notifDelay120') },
    { value: 180, label: t(lang, 'notifDelay180') },
  ]

  return (
    <div className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-100 dark:bg-surface-800">
      <span className="text-xs font-medium text-surface-500 dark:text-surface-400 flex-shrink-0">
        {t(lang, 'notifDelay')}
      </span>
      <div className="flex gap-1.5 flex-1 justify-end">
        {options.map(o => (
          <button
            key={o.value}
            onClick={() => handleChange(o.value)}
            className={`text-[10px] font-semibold px-2.5 py-1 rounded-lg transition-colors
              ${delay === o.value
                ? 'bg-accent text-surface-950'
                : 'bg-surface-200 dark:bg-surface-700 text-surface-500 dark:text-surface-400'}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

