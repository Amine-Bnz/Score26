import { useState, useEffect, useRef } from 'react'
import { SunIcon, MoonIcon } from './Icons'

// Focus trap : piège le Tab dans la modale et ferme sur Escape
function useFocusTrap(ref, onClose) {
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const focusable = el.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
    if (focusable.length) focusable[0].focus()

    function handleKey(e) {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key !== 'Tab' || !focusable.length) return
      const first = focusable[0], last = focusable[focusable.length - 1]
      if (e.shiftKey) { if (document.activeElement === first) { e.preventDefault(); last.focus() } }
      else            { if (document.activeElement === last)  { e.preventDefault(); first.focus() } }
    }
    el.addEventListener('keydown', handleKey)
    return () => el.removeEventListener('keydown', handleKey)
  }, [ref, onClose])
}

function AboutModal({ lang, onClose }) {
  const isFr = lang === 'fr'
  const dialogRef = useRef(null)
  useFocusTrap(dialogRef, onClose)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-5 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={isFr ? 'À propos' : 'About'}
    >
      <div
        ref={dialogRef}
        className="w-full max-w-sm bg-white dark:bg-surface-900 rounded-2xl shadow-xl p-6 flex flex-col gap-4"
        onClick={e => e.stopPropagation()}
      >
        {/* Titre + fermer */}
        <div className="flex items-center justify-between">
          <span className="font-display font-bold text-base text-surface-900 dark:text-white tracking-tight">
            score<span className="text-gold">26</span>
          </span>
          <button
            onClick={onClose}
            className="text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 transition text-lg leading-none focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>

        {/* Concept */}
        <p className="text-sm text-surface-600 dark:text-surface-300 leading-relaxed">
          {isFr
            ? 'Prédit les scores des matchs de la Coupe du Monde 2026 et suis tes performances au fil de la compétition.'
            : 'Predict the scores of the 2026 World Cup matches and track your performance throughout the competition.'}
        </p>

        {/* Règles */}
        <div className="bg-surface-50 dark:bg-surface-800 rounded-xl p-4 flex flex-col gap-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-surface-400 dark:text-surface-500 mb-1">
            {isFr ? 'Règles du scoring' : 'Scoring rules'}
          </p>
          <ScoreLine emoji="🎯" label={isFr ? 'Score exact' : 'Exact score'} pts="50 pts" color="text-result-exact" />
          <ScoreLine emoji="✅" label={isFr ? 'Bonne issue' : 'Correct outcome'} pts="20 pts" color="text-accent" />
          <ScoreLine emoji="❌" label={isFr ? 'Mauvaise issue' : 'Wrong outcome'} pts="0 pt" color="text-result-miss" />
        </div>

        {/* Cote cachée */}
        <p className="text-xs text-surface-400 dark:text-surface-500 text-center leading-relaxed">
          {isFr
            ? 'Une cote secrète est appliquée à chaque prono. Plus ton pronostic est rare, plus il rapporte.'
            : "A secret multiplier is applied to each prediction. The rarer your pick, the more it's worth."}
        </p>
      </div>
    </div>
  )
}

function ScoreLine({ emoji, label, pts, color }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-surface-600 dark:text-surface-300 flex items-center gap-2">
        <span>{emoji}</span> {label}
      </span>
      <span className={`text-sm font-bold tabular-nums ${color}`}>{pts}</span>
    </div>
  )
}

export default function Header({ lang, onLangToggle, theme, onThemeToggle }) {
  const [showAbout, setShowAbout] = useState(false)

  return (
    <>
      <header className="flex items-center justify-between px-5 py-3 bg-surface-100/80 dark:bg-surface-950/80 backdrop-blur-lg sticky top-0 z-10 border-b border-surface-200 dark:border-surface-800/40">
        {/* Toggle langue */}
        <button
          onClick={() => { navigator.vibrate?.(10); onLangToggle() }}
          className="text-[11px] font-semibold tracking-wide text-surface-500 dark:text-surface-400 hover:text-surface-800 dark:hover:text-surface-200 transition-colors px-2 py-1 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          aria-label="Changer la langue"
        >
          {lang === 'fr' ? 'EN' : 'FR'}
        </button>

        {/* Logo */}
        <span className="font-display text-lg font-bold tracking-tight text-surface-900 dark:text-white">
          score<span className="text-gold">26</span>
        </span>

        {/* Actions droite : info + thème */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => { navigator.vibrate?.(10); setShowAbout(true) }}
            className="text-surface-400 dark:text-surface-500 hover:text-surface-700 dark:hover:text-surface-300 transition-colors w-8 h-8 rounded-lg flex items-center justify-center text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label="À propos"
          >
            ℹ️
          </button>
          <button
            onClick={() => { navigator.vibrate?.(10); onThemeToggle() }}
            className="text-surface-400 dark:text-surface-500 hover:text-surface-700 dark:hover:text-surface-300 transition-colors w-8 h-8 rounded-lg flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label="Changer le thème"
          >
            {theme === 'dark' ? <SunIcon className="w-4 h-4" /> : <MoonIcon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {showAbout && <AboutModal lang={lang} onClose={() => setShowAbout(false)} />}
    </>
  )
}
