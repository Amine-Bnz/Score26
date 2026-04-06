import { t, splitTeam } from '../i18n'
import { ChevronIcon } from './Icons'
import { useState } from 'react'

const PHASES = ['8e', '4e', 'demi', 'finale']
const PHASE_COUNTS = { '8e': 16, '4e': 8, 'demi': 4, 'finale': 2 }

function BracketMatch({ match, lang }) {
  if (!match) {
    return (
      <div className="flex flex-col gap-0.5 min-w-[130px]">
        <div className="h-7 rounded bg-surface-100 dark:bg-surface-800 border border-dashed border-surface-300 dark:border-surface-700" />
        <div className="h-7 rounded bg-surface-100 dark:bg-surface-800 border border-dashed border-surface-300 dark:border-surface-700" />
      </div>
    )
  }

  const aTeam = splitTeam(match.equipe_a, lang)
  const bTeam = splitTeam(match.equipe_b, lang)
  const hasResult = match.score_reel_a != null
  const aWon = hasResult && match.score_reel_a > match.score_reel_b
  const bWon = hasResult && match.score_reel_b > match.score_reel_a

  return (
    <div className="flex flex-col gap-0.5 min-w-[130px]">
      {/* Team A */}
      <div className={`flex items-center gap-1.5 px-2 py-1 rounded-t-lg text-[11px]
        ${aWon ? 'bg-accent/15 font-bold' : 'bg-surface-100 dark:bg-surface-800'}
        border border-surface-200 dark:border-surface-700`}>
        <span className="text-sm">{aTeam.flag}</span>
        <span className={`flex-1 truncate ${aWon ? 'text-accent' : 'text-surface-700 dark:text-surface-300'}`}>
          {aTeam.name}
        </span>
        {hasResult && (
          <span className={`tabular-nums font-bold ${aWon ? 'text-accent' : 'text-surface-400'}`}>
            {match.score_reel_a}
          </span>
        )}
      </div>
      {/* Team B */}
      <div className={`flex items-center gap-1.5 px-2 py-1 rounded-b-lg text-[11px]
        ${bWon ? 'bg-accent/15 font-bold' : 'bg-surface-100 dark:bg-surface-800'}
        border border-surface-200 dark:border-surface-700 border-t-0`}>
        <span className="text-sm">{bTeam.flag}</span>
        <span className={`flex-1 truncate ${bWon ? 'text-accent' : 'text-surface-700 dark:text-surface-300'}`}>
          {bTeam.name}
        </span>
        {hasResult && (
          <span className={`tabular-nums font-bold ${bWon ? 'text-accent' : 'text-surface-400'}`}>
            {match.score_reel_b}
          </span>
        )}
      </div>
      {/* Prono utilisateur */}
      {match.score_predit_a != null && (
        <div className="text-[9px] text-surface-400 text-center tabular-nums mt-0.5">
          {lang === 'fr' ? 'Prono' : 'Pred.'} {match.score_predit_a}-{match.score_predit_b}
        </div>
      )}
    </div>
  )
}

export default function Bracket({ matchs, lang }) {
  const [open, setOpen] = useState(() => {
    try { return localStorage.getItem('score26_bracket_open') === '1' } catch { return false }
  })

  // Filtrer les matchs par phase
  const byPhase = {}
  for (const phase of PHASES) {
    byPhase[phase] = matchs.filter(m => m.phase === phase)
  }

  // Toujours afficher le bracket (avec placeholders si pas encore de matchs)

  function toggleOpen() {
    const next = !open
    setOpen(next)
    try { localStorage.setItem('score26_bracket_open', next ? '1' : '0') } catch {}
  }

  return (
    <div className="mt-4">
      <button
        onClick={toggleOpen}
        className="flex items-center gap-2 w-full py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
      >
        <ChevronIcon className={`w-3.5 h-3.5 text-accent transition-transform duration-200 ${open ? 'rotate-90' : ''}`} />
        <span className="text-sm font-semibold text-accent">{t(lang, 'bracket')}</span>
      </button>

      {open && (
        <div className="overflow-x-auto pb-4 -mx-4 px-4 scrollbar-none">
          <div className="flex gap-6 items-center min-w-max pt-2">
            {PHASES.map(phase => (
              <div key={phase} className="flex flex-col gap-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-surface-400 dark:text-surface-500 text-center mb-1">
                  {phase === '8e' ? (lang === 'fr' ? '8e' : 'R16') :
                   phase === '4e' ? (lang === 'fr' ? '1/4' : 'QF') :
                   phase === 'demi' ? (lang === 'fr' ? '1/2' : 'SF') :
                   (lang === 'fr' ? 'Finale' : 'Final')}
                </p>
                {byPhase[phase].length > 0 ? (
                  byPhase[phase].map(m => <BracketMatch key={m.id} match={m} lang={lang} />)
                ) : (
                  // Placeholder slots
                  [...Array(PHASE_COUNTS[phase] / 2)].map((_, i) => <BracketMatch key={`ph-${phase}-${i}`} match={null} lang={lang} />)
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
