import { useState, useEffect } from 'react'
import './App.css'
import Header from './components/Header'
import Navbar from './components/Navbar'
import Onboarding from './pages/Onboarding'
import MatchsAvenir from './pages/MatchsAvenir'
import MatchsPasses from './pages/MatchsPasses'
import Profil from './pages/Profil'

export default function App() {
  const [userId, setUserId] = useState(null)
  const [page,   setPage]   = useState('avenir') // 'avenir' | 'passes' | 'profil'
  const [theme,  setTheme]  = useState('dark')
  const [lang,   setLang]   = useState('fr')

  // Récupération de l'identité persistée en localStorage
  useEffect(() => {
    const id = localStorage.getItem('score26_user_id')
    if (id) setUserId(id)
  }, [])

  // Application du thème via la classe CSS sur <html>
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  // Onboarding si pas encore de compte
  if (!userId) {
    return <Onboarding lang={lang} onComplete={id => setUserId(id)} />
  }

  return (
    <div className="min-h-screen max-w-md mx-auto relative">
      <Header
        lang={lang}
        onLangToggle={() => setLang(l => l === 'fr' ? 'en' : 'fr')}
        theme={theme}
        onThemeToggle={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
      />

      <main className="pb-20 px-4 pt-4">
        {page === 'avenir' && <MatchsAvenir userId={userId} lang={lang} />}
        {page === 'passes' && <MatchsPasses userId={userId} lang={lang} />}
        {page === 'profil' && <Profil       userId={userId} lang={lang} />}
      </main>

      <Navbar page={page} onNavigate={setPage} />
    </div>
  )
}
