import { useState, useEffect, useRef } from 'react'
import { SunIcon, MoonIcon, InfoIcon } from './Icons'

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
            aria-label={isFr ? 'Fermer' : 'Close'}
          >
            ✕
          </button>
        </div>

        {/* Concept */}
        <p className="text-sm text-surface-600 dark:text-surface-300 leading-relaxed">
          {isFr
            ? 'La Coupe du Monde 2026 arrive et on a tous un avis sur le score. Ici tu poses tes pronos, tu défies tes potes et tu prouves que t\'es le vrai expert du groupe.'
            : 'The 2026 World Cup is coming and we all have an opinion on the score. Drop your predictions, challenge your mates and prove you\'re the real expert.'}
        </p>

        {/* Règles */}
        <div className="bg-surface-50 dark:bg-surface-800 rounded-xl p-4 flex flex-col gap-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-surface-400 dark:text-surface-500 mb-1">
            {isFr ? 'Comment ça marche' : 'How it works'}
          </p>
          <ScoreLine dotColor="bg-result-exact" label={isFr ? 'Score exact — le graal' : 'Exact score — the holy grail'} pts="50 pts" color="text-result-exact" />
          <ScoreLine dotColor="bg-accent" label={isFr ? 'Bonne issue — pas mal' : 'Right outcome — not bad'} pts="20 pts" color="text-accent" />
          <ScoreLine dotColor="bg-result-miss" label={isFr ? 'Dans les choux' : 'Way off'} pts="0 pt" color="text-result-miss" />
        </div>

        {/* Cote cachée */}
        <p className="text-xs text-surface-400 dark:text-surface-500 text-center leading-relaxed">
          {isFr
            ? 'Et petit bonus : si personne n\'a mis le même score que toi, tes points sont boostés. Les outsiders sont récompensés.'
            : "Bonus twist: if nobody picked the same score as you, your points get boosted. Underdogs are rewarded."}
        </p>
      </div>
    </div>
  )
}

function ScoreLine({ dotColor, label, pts, color }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-surface-600 dark:text-surface-300 flex items-center gap-2">
        <span className={`w-2.5 h-2.5 rounded-full ${dotColor} flex-shrink-0`} /> {label}
      </span>
      <span className={`text-sm font-bold tabular-nums ${color}`}>{pts}</span>
    </div>
  )
}

export default function Header({ lang, onLangToggle, theme, onThemeToggle, pendingCount = 0, synced = false }) {
  const [showAbout, setShowAbout] = useState(false)

  return (
    <>
      <header className="flex items-center justify-between px-5 py-3 bg-surface-100/80 dark:bg-surface-950/80 backdrop-blur-lg sticky top-0 z-10 border-b border-surface-200 dark:border-surface-800/40 safe-area-inset-top">
        {/* Toggle langue */}
        <button
          onClick={() => { navigator.vibrate?.(10); onLangToggle() }}
          className="text-[11px] font-semibold tracking-wide text-surface-500 dark:text-surface-400 hover:text-surface-800 dark:hover:text-surface-200 transition-colors px-2 py-1 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          aria-label={lang === 'fr' ? 'Changer la langue' : 'Switch language'}
        >
          {lang === 'fr' ? 'EN' : 'FR'}
        </button>

        {/* Logo */}
        <span className="font-display text-lg font-bold tracking-tight text-surface-900 dark:text-white relative">
          score<span className="text-gold">26</span>
          {pendingCount > 0 && (
            <span className="absolute -top-1 -right-4 w-2 h-2 rounded-full bg-gold animate-pulse" title={`${pendingCount} pending`} />
          )}
          {synced && (
            <span className="absolute -top-1 -right-4 w-2 h-2 rounded-full bg-result-exact" />
          )}
        </span>

        {/* Actions droite : info + thème */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => { navigator.vibrate?.(10); setShowAbout(true) }}
            className="text-surface-400 dark:text-surface-500 hover:text-surface-700 dark:hover:text-surface-300 transition-colors w-8 h-8 rounded-lg flex items-center justify-center text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label={lang === 'fr' ? 'À propos' : 'About'}
          >
            <InfoIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => { navigator.vibrate?.(10); onThemeToggle() }}
            className="text-surface-400 dark:text-surface-500 hover:text-surface-700 dark:hover:text-surface-300 transition-colors w-8 h-8 rounded-lg flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label={lang === 'fr' ? 'Changer le thème' : 'Switch theme'}
          >
            {theme === 'dark' ? <SunIcon className="w-4 h-4" /> : <MoonIcon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {showAbout && <AboutModal lang={lang} onClose={() => setShowAbout(false)} />}
    </>
  )
}
