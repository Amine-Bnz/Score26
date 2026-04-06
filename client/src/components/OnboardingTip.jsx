// Overlay d'onboarding : montre à l'user où taper son score
// Affiché une seule fois (flag localStorage), disparaît au premier tap

import { useEffect, useState } from 'react'

const LS_KEY = 'score26_onboarded'

export default function OnboardingTip({ lang }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      if (!localStorage.getItem(LS_KEY)) setVisible(true)
    } catch { /* Safari private */ }
  }, [])

  function dismiss() {
    setVisible(false)
    try { localStorage.setItem(LS_KEY, '1') } catch {}
  }

  if (!visible) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px]"
      onClick={dismiss}
    >
      <div className="flex flex-col items-center gap-3 animate-fade-in pointer-events-none">
        {/* Flèche vers le bas */}
        <div className="flex flex-col items-center gap-1">
          <span className="text-white text-sm font-medium text-center px-6 drop-shadow-lg">
            {lang === 'fr' ? 'Tape ton score ici' : 'Enter your score here'}
          </span>
          <svg className="w-7 h-7 text-white animate-bounce drop-shadow-lg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </div>

        {/* Faux input */}
        <div className="flex items-center gap-2 pointer-events-none">
          <div className="w-11 h-11 rounded-lg border border-accent/50 bg-white/10 flex items-center justify-center text-lg font-display font-bold text-white">
            0
          </div>
          <span className="text-white/40 font-medium text-sm">–</span>
          <div className="w-11 h-11 rounded-lg border border-accent/50 bg-white/10 flex items-center justify-center text-lg font-display font-bold text-white">
            0
          </div>
        </div>

        <span className="text-white/50 text-xs mt-1">
          {lang === 'fr' ? 'Appuie n\'importe où pour fermer' : 'Tap anywhere to close'}
        </span>
      </div>
    </div>
  )
}
