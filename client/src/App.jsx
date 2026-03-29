import { useState, useEffect, useRef } from 'react'
import './App.css'
import Header from './components/Header'
import Navbar from './components/Navbar'
import OfflineBanner from './components/OfflineBanner'
import Onboarding from './pages/Onboarding'
import MatchsAvenir from './pages/MatchsAvenir'
import MatchsPasses from './pages/MatchsPasses'
import Profil from './pages/Profil'
import { useOnlineStatus } from './hooks/useOnlineStatus'
import { getMatchs } from './api'

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

  const PAGE_ORDER = { avenir: 0, passes: 1, profil: 2 }
  const scrollPositions = useRef({ avenir: 0, passes: 0, profil: 0 })

  function navigateTo(next) {
    // Sauvegarder la position de scroll de la page actuelle
    scrollPositions.current[prevPageRef.current] = window.scrollY
    setSlideDir(PAGE_ORDER[next] >= PAGE_ORDER[prevPageRef.current] ? 'right' : 'left')
    prevPageRef.current = next
    setPage(next)
    // Restaurer la position de scroll de la page cible
    requestAnimationFrame(() => window.scrollTo(0, scrollPositions.current[next]))
  }
  const [theme,  setTheme]  = useState(() => lsGet('score26_theme', 'dark'))
  const [lang,   setLang]   = useState(() => lsGet('score26_lang', 'fr'))
  const isOnline = useOnlineStatus()
  const [prefetchedMatchs, setPrefetchedMatchs] = useState(null)

  // Récupération de l'identité persistée en localStorage
  useEffect(() => {
    const id = lsGet('score26_user_id', null)
    if (id) setUserId(id)
  }, [])

  // Prefetch des matchs au montage (évite le spinner au changement d'onglet)
  useEffect(() => {
    if (!userId) return
    getMatchs(userId).then(data => {
      if (!data.error && Array.isArray(data)) setPrefetchedMatchs(data)
    }).catch(() => {})
  }, [userId])

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
    return <Onboarding lang={lang} onComplete={id => setUserId(id)} />
  }

  return (
    <div className="min-h-screen max-w-md mx-auto relative">
      {!isOnline && <OfflineBanner lang={lang} />}
      <Header
        lang={lang}
        onLangToggle={() => setLang(l => l === 'fr' ? 'en' : 'fr')}
        theme={theme}
        onThemeToggle={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
      />

      <main className="pb-20 px-4 pt-4 overflow-hidden">
        {page === 'avenir' && <div key="avenir" className={`page-slide-${slideDir}`}><MatchsAvenir userId={userId} lang={lang} isOnline={isOnline} initialData={prefetchedMatchs} /></div>}
        {page === 'passes' && <div key="passes" className={`page-slide-${slideDir}`}><MatchsPasses userId={userId} lang={lang} initialData={prefetchedMatchs} /></div>}
        {page === 'profil' && <div key="profil" className={`page-slide-${slideDir}`}><Profil       userId={userId} lang={lang} /></div>}
      </main>

      <Navbar page={page} onNavigate={navigateTo} lang={lang} />
    </div>
  )
}
