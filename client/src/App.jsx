import { useState, useEffect, useRef, lazy, Suspense } from 'react'
import './App.css'
import Header from './components/Header'
import Navbar from './components/Navbar'
import OfflineBanner from './components/OfflineBanner'
import Onboarding from './pages/Onboarding'

const MatchsAvenir = lazy(() => import('./pages/MatchsAvenir'))
const MatchsPasses = lazy(() => import('./pages/MatchsPasses'))
const Profil       = lazy(() => import('./pages/Profil'))
const Amis         = lazy(() => import('./pages/Amis'))
import { useOnlineStatus } from './hooks/useOnlineStatus'
import { useOfflineSync } from './hooks/useOfflineSync'
import { getMatchs, getUser } from './api'
import { t, tRandom } from './i18n'

// Lecture localStorage sécurisée (navigation privée Safari peut throw)
function lsGet(key, fallback) {
  try { return localStorage.getItem(key) ?? fallback } catch { return fallback }
}
function lsSet(key, value) {
  try { localStorage.setItem(key, value) } catch { /* ignore */ }
}

export default function App() {
  const [userId, setUserId] = useState(null)
  const [page,   setPage]   = useState('avenir') // 'avenir' | 'passes' | 'profil'
  const [slideDir, setSlideDir] = useState('right')
  const prevPageRef = useRef('avenir')

  const PAGE_ORDER = { avenir: 0, passes: 1, amis: 2, profil: 3 }
  const scrollPositions = useRef({ avenir: 0, passes: 0, amis: 0, profil: 0 })

  function navigateTo(next) {
    // Sauvegarder la position de scroll de la page actuelle
    scrollPositions.current[prevPageRef.current] = window.scrollY
    const dir = PAGE_ORDER[next] >= PAGE_ORDER[prevPageRef.current] ? 'right' : 'left'
    prevPageRef.current = next

    function doNavigate() {
      setSlideDir(dir)
      setPage(next)
      requestAnimationFrame(() => window.scrollTo(0, scrollPositions.current[next]))
    }

    // View Transitions API (Chrome 111+) pour des transitions fluides
    if (document.startViewTransition) {
      document.documentElement.dataset.slideDir = dir
      document.startViewTransition(doNavigate)
    } else {
      doNavigate()
    }
  }
  const [theme,  setTheme]  = useState(() => lsGet('score26_theme', 'dark'))
  const [lang,   setLang]   = useState(() => lsGet('score26_lang', 'fr'))
  const isOnline = useOnlineStatus()
  const { pendingCount, synced } = useOfflineSync(userId, isOnline)
  const [prefetchedMatchs, setPrefetchedMatchs] = useState(null)
  const [friendCode, setFriendCode] = useState(null)
  const [deepLink, setDeepLink] = useState(null) // { type: 'invite'|'group', code: '...' }
  const [resultToast, setResultToast] = useState(null) // { msg, type: 'exact'|'good'|'miss' }
  const [welcomeToast, setWelcomeToast] = useState(false)
  const resultToastQueue = useRef([])

  // Récupération de l'identité persistée en localStorage + deep-links
  // Si l'user a un ID mais pas de token, forcer re-onboarding (sécurité)
  useEffect(() => {
    const id = lsGet('score26_user_id', null)
    const token = lsGet('score26_token', null)
    if (id && token) setUserId(id)
    else if (id && !token) {
      // Ancien user sans token — supprimer et forcer re-onboarding
      try { localStorage.removeItem('score26_user_id'); localStorage.removeItem('score26_pseudo') } catch {}
    }

    // Parser les deep-links : /invite/CODE ou /group/CODE
    const path = window.location.pathname
    const inviteMatch = path.match(/^\/invite\/([A-Za-z0-9]+)$/)
    const groupMatch = path.match(/^\/group\/([A-Za-z0-9]+)$/)
    if (inviteMatch) {
      setDeepLink({ type: 'invite', code: inviteMatch[1].toUpperCase() })
      window.history.replaceState({}, '', '/')
    } else if (groupMatch) {
      setDeepLink({ type: 'group', code: groupMatch[1].toUpperCase() })
      window.history.replaceState({}, '', '/')
    }
  }, [])

  // Prefetch des matchs + récupération du friend_code au montage
  useEffect(() => {
    if (!userId) return
    getMatchs(userId).then(data => {
      if (!data.error && Array.isArray(data)) setPrefetchedMatchs(data)
    }).catch(err => console.warn('[App] Erreur prefetch matchs:', err))
    getUser(userId).then(data => {
      if (data.friend_code) setFriendCode(data.friend_code)
    }).catch(err => console.warn('[App] Erreur prefetch user:', err))
    // Si deep-link en attente, naviguer vers amis
    if (deepLink) setPage('amis')
  }, [userId])

  // Toast résultat de prono : détecte les matchs nouvellement terminés avec un prono
  useEffect(() => {
    if (!prefetchedMatchs || !userId) return
    const seenKey = 'score26_seen_results'
    let seen
    try { seen = new Set(JSON.parse(localStorage.getItem(seenKey) || '[]')) } catch { seen = new Set() }

    const newResults = prefetchedMatchs.filter(m =>
      m.statut === 'termine' && m.points_obtenus != null && !seen.has(m.id)
    )
    if (newResults.length === 0) return

    // Marquer comme vus immédiatement
    for (const m of newResults) seen.add(m.id)
    try { localStorage.setItem(seenKey, JSON.stringify([...seen])) } catch {}

    // Construire la queue de toasts
    const queue = newResults.map(m => {
      const pts = m.points_obtenus
      const isExact = m.score_predit_a === m.score_reel_a && m.score_predit_b === m.score_reel_b
      const issueOk = !isExact && Math.sign(m.score_predit_a - m.score_predit_b) === Math.sign(m.score_reel_a - m.score_reel_b)
      const teamA = m.equipe_a?.split(' ').slice(1).join(' ') ?? ''
      const teamB = m.equipe_b?.split(' ').slice(1).join(' ') ?? ''
      const matchLabel = `${teamA} ${m.score_reel_a}-${m.score_reel_b} ${teamB}`

      if (isExact) return { msg: `${matchLabel} · ${tRandom(lang, 'resultToastExact')} +${pts}`, type: 'exact' }
      if (issueOk) return { msg: `${matchLabel} · ${tRandom(lang, 'resultToastGood')} +${pts}`, type: 'good' }
      return { msg: `${matchLabel} · ${tRandom(lang, 'resultToastMiss')} +${pts}`, type: 'miss' }
    })

    // Son de notification in-app (Web Audio API)
    function playNotifSound(type) {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)()
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.type = 'sine'
        // Tonalité selon le résultat
        osc.frequency.value = type === 'exact' ? 880 : type === 'good' ? 660 : 440
        gain.gain.setValueAtTime(0.15, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
        osc.start(ctx.currentTime)
        osc.stop(ctx.currentTime + 0.4)
        // Double bip pour un exact
        if (type === 'exact') {
          const osc2 = ctx.createOscillator()
          const gain2 = ctx.createGain()
          osc2.connect(gain2)
          gain2.connect(ctx.destination)
          osc2.type = 'sine'
          osc2.frequency.value = 1100
          gain2.gain.setValueAtTime(0.12, ctx.currentTime + 0.15)
          gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
          osc2.start(ctx.currentTime + 0.15)
          osc2.stop(ctx.currentTime + 0.5)
        }
      } catch { /* Audio non supporté — silencieux */ }
    }

    // Afficher les toasts en séquence
    resultToastQueue.current = queue
    function showNext() {
      const next = resultToastQueue.current.shift()
      if (!next) { setResultToast(null); return }
      setResultToast(next)
      playNotifSound(next.type)
      setTimeout(showNext, 3500)
    }
    showNext()
  }, [prefetchedMatchs])

  // Persistance et application du thème
  useEffect(() => {
    lsSet('score26_theme', theme)
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  // Persistance de la langue
  useEffect(() => {
    lsSet('score26_lang', lang)
  }, [lang])

  // Onboarding si pas encore de compte
  if (!userId) {
    return <Onboarding lang={lang} onComplete={id => { setUserId(id); setWelcomeToast(true) }} />
  }

  return (
    <div className="min-h-screen max-w-md mx-auto relative">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-accent focus:text-surface-950 focus:rounded-lg focus:text-sm focus:font-semibold">
        {lang === 'fr' ? 'Aller au contenu' : 'Skip to content'}
      </a>
      {!isOnline && <OfflineBanner lang={lang} />}
      <Header
        lang={lang}
        onLangToggle={() => setLang(l => l === 'fr' ? 'en' : 'fr')}
        theme={theme}
        onThemeToggle={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
        pendingCount={pendingCount}
        synced={synced}
      />

      <main id="main-content" className="pb-nav px-4 pt-3 overflow-hidden">
        <Suspense fallback={<div className="flex justify-center py-20 text-surface-400">…</div>}>
          {page === 'avenir' && <div key="avenir" className={`page-slide-${slideDir}`}><MatchsAvenir userId={userId} lang={lang} isOnline={isOnline} initialData={prefetchedMatchs} /></div>}
          {page === 'passes' && <div key="passes" className={`page-slide-${slideDir}`}><MatchsPasses userId={userId} lang={lang} initialData={prefetchedMatchs} /></div>}
          {page === 'amis'   && <div key="amis"   className={`page-slide-${slideDir}`}><Amis         userId={userId} lang={lang} friendCode={friendCode} deepLink={deepLink} onDeepLinkHandled={() => setDeepLink(null)} /></div>}
          {page === 'profil' && <div key="profil" className={`page-slide-${slideDir}`}><Profil       userId={userId} lang={lang} friendCode={friendCode} theme={theme} onThemeToggle={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} /></div>}
        </Suspense>
      </main>

      <Navbar page={page} onNavigate={navigateTo} lang={lang} />

      {/* Toast bienvenue (premier lancement) */}
      {welcomeToast && (
        <WelcomeToast lang={lang} onDone={() => setWelcomeToast(false)} />
      )}

      {/* Toast résultat de prono */}
      <div aria-live="polite" aria-atomic="true">
        {resultToast && (
          <div className={`fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg animate-fade-in max-w-[90vw] text-center
            ${resultToast.type === 'exact' ? 'bg-result-exact/90 text-white' :
              resultToast.type === 'good' ? 'bg-accent/90 text-surface-950' :
              'bg-result-miss/90 text-white'}`}>
            {resultToast.msg}
          </div>
        )}
      </div>
    </div>
  )
}

function WelcomeToast({ lang, onDone }) {
  useEffect(() => {
    const id = setTimeout(onDone, 3500)
    return () => clearTimeout(id)
  }, [])
  return (
    <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg animate-fade-in max-w-[90vw] text-center bg-accent/90 text-surface-950">
      {t(lang, 'welcomeToast')}
    </div>
  )
}
