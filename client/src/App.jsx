import { useState, useEffect } from 'react'
import './App.css'
import Header from './components/Header'
import Navbar from './components/Navbar'
import OfflineBanner from './components/OfflineBanner'
import Onboarding from './pages/Onboarding'
import MatchsAvenir from './pages/MatchsAvenir'
import MatchsPasses from './pages/MatchsPasses'
import Profil from './pages/Profil'
import { useOnlineStatus } from './hooks/useOnlineStatus'

export default function App() {
  const [userId, setUserId] = useState(null)
  const [page,   setPage]   = useState('avenir') // 'avenir' | 'passes' | 'profil'
  const [theme,  setTheme]  = useState(() => localStorage.getItem('score26_theme') || 'dark')
  const [lang,   setLang]   = useState(() => localStorage.getItem('score26_lang')  || 'fr')
  const isOnline = useOnlineStatus()

  // Récupération de l'identité persistée en localStorage
  useEffect(() => {
    const id = localStorage.getItem('score26_user_id')
    if (id) setUserId(id)
  }, [])

  // Persistance et application du thème
  useEffect(() => {
    localStorage.setItem('score26_theme', theme)
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  // Persistance de la langue
  useEffect(() => {
    localStorage.setItem('score26_lang', lang)
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

      <main className="pb-20 px-4 pt-4">
        {page === 'avenir' && <div className="page-enter"><MatchsAvenir userId={userId} lang={lang} isOnline={isOnline} /></div>}
        {page === 'passes' && <div className="page-enter"><MatchsPasses userId={userId} lang={lang} /></div>}
        {page === 'profil' && <div className="page-enter"><Profil       userId={userId} lang={lang} /></div>}
      </main>

      <Navbar page={page} onNavigate={setPage} lang={lang} />
    </div>
  )
}
