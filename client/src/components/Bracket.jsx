import { t, splitTeam } from '../i18n'
import { ChevronIcon } from './Icons'
import { useState } from 'react'

const PHASES = ['8e', '4e', 'demi', 'finale']
const MATCH_COUNTS = { '8e': 8, '4e': 4, 'demi': 2, 'finale': 1 }
// Gap between the two children at each recursion depth (R16→QF, QF→SF, SF→Final)
const DEPTH_GAPS = [6, 16, 32]

// ─── Mini match card for bracket nodes ───────────────────────────
function BracketMatch({ match, lang, onClick }) {
  if (!match) {
    return (
      <div className="flex flex-col gap-px w-[128px] shrink-0">
        <div className="h-[22px] rounded-t bg-surface-100 dark:bg-surface-800 border border-dashed border-surface-300 dark:border-surface-700" />
        <div className="h-[22px] rounded-b bg-surface-100 dark:bg-surface-800 border border-dashed border-surface-300 dark:border-surface-700 border-t-0" />
      </div>
    )
  }

  const a = splitTeam(match.equipe_a, lang)
  const b = splitTeam(match.equipe_b, lang)
  const live = match.statut === 'en_cours'
  const done = match.score_reel_a != null
  const aW = done && match.score_reel_a > match.score_reel_b
  const bW = done && match.score_reel_b > match.score_reel_a

  return (
    <button
      className={`flex flex-col gap-px w-[128px] shrink-0 text-left transition-transform active:scale-[0.97]
        ${live ? 'ring-1 ring-result-miss/50 rounded' : ''}`}
      onClick={() => onClick?.(match)}
    >
      {/* Team A */}
      <div className={`flex items-center gap-1 px-1.5 py-[3px] rounded-t text-[10px] leading-tight
        ${aW ? 'bg-accent/15 font-bold' : 'bg-surface-100 dark:bg-surface-800'}
        border border-surface-200 dark:border-surface-700`}>
        <span className="text-xs">{a.flag}</span>
        <span className={`flex-1 truncate ${aW ? 'text-accent' : 'text-surface-700 dark:text-surface-300'}`}>{a.name}</span>
        {(done || live) && (
          <span className={`tabular-nums font-bold text-[10px] ${live ? 'text-result-miss' : aW ? 'text-accent' : 'text-surface-400'}`}>
            {live ? match.score_live_a : match.score_reel_a}
          </span>
        )}
      </div>
      {/* Team B */}
      <div className={`flex items-center gap-1 px-1.5 py-[3px] rounded-b text-[10px] leading-tight
        ${bW ? 'bg-accent/15 font-bold' : 'bg-surface-100 dark:bg-surface-800'}
        border border-surface-200 dark:border-surface-700 border-t-0`}>
        <span className="text-xs">{b.flag}</span>
        <span className={`flex-1 truncate ${bW ? 'text-accent' : 'text-surface-700 dark:text-surface-300'}`}>{b.name}</span>
        {(done || live) && (
          <span className={`tabular-nums font-bold text-[10px] ${live ? 'text-result-miss' : bW ? 'text-accent' : 'text-surface-400'}`}>
            {live ? match.score_live_b : match.score_reel_b}
          </span>
        )}
      </div>
      {/* User prediction */}
      {match.score_predit_a != null && (
        <div className={`text-[8px] text-center tabular-nums mt-px
          ${match.points_obtenus != null
            ? match.points_obtenus >= 50 ? 'text-accent font-medium' : match.points_obtenus >= 20 ? 'text-result-good' : 'text-surface-400'
            : 'text-surface-400'}`}>
          {match.score_predit_a}-{match.score_predit_b}
          {match.points_obtenus != null && ` · ${match.points_obtenus}pts`}
        </div>
      )}
      {/* Live minute */}
      {live && match.minute_live && (
        <div className="text-[8px] text-result-miss text-center font-medium animate-pulse">{match.minute_live}&apos;</div>
      )}
    </button>
  )
}

// ─── Connector shape ─────────────────────────────────────────────
//   ────┐
//       ├────
//   ────┘
function BracketConnector() {
  const c = 'border-surface-300/70 dark:border-surface-600/50'
  return (
    <div className="self-stretch relative shrink-0" style={{ width: 20 }}>
      {/* Top horizontal: left edge → vertical bar */}
      <div className={`absolute left-0 w-1/2 border-t-[1.5px] ${c}`} style={{ top: '25%' }} />
      {/* Bottom horizontal: left edge → vertical bar */}
      <div className={`absolute left-0 w-1/2 border-t-[1.5px] ${c}`} style={{ top: '75%' }} />
      {/* Vertical bar: top → bottom */}
      <div className={`absolute left-1/2 border-l-[1.5px] ${c}`} style={{ top: '25%', bottom: '25%' }} />
      {/* Right horizontal: vertical bar → right edge */}
      <div className={`absolute left-1/2 right-0 border-t-[1.5px] ${c}`} style={{ top: '50%' }} />
    </div>
  )
}

// ─── Recursive bracket subtree ───────────────────────────────────
function BracketTree({ byPhase, depth, slot, lang, onMatchClick }) {
  // Base case: R16 leaf match
  if (depth === 0) {
    return <BracketMatch match={byPhase['8e']?.[slot] ?? null} lang={lang} onClick={onMatchClick} />
  }

  const phase = PHASES[depth]
  const match = byPhase[phase]?.[slot] ?? null

  return (
    <div className="flex">
      {/* Left column: two children from previous round */}
      <div className="flex flex-col justify-center" style={{ gap: DEPTH_GAPS[depth - 1] ?? 6 }}>
        <BracketTree byPhase={byPhase} depth={depth - 1} slot={slot * 2} lang={lang} onMatchClick={onMatchClick} />
        <BracketTree byPhase={byPhase} depth={depth - 1} slot={slot * 2 + 1} lang={lang} onMatchClick={onMatchClick} />
      </div>
      {/* Connector lines */}
      <BracketConnector />
      {/* This round's match, vertically centered */}
      <div className="flex items-center self-center">
        <BracketMatch match={match} lang={lang} onClick={onMatchClick} />
      </div>
    </div>
  )
}

// ─── Main Bracket component ──────────────────────────────────────
export default function Bracket({ matchs, lang, onMatchClick }) {
  const [open, setOpen] = useState(() => {
    try {
      const v = localStorage.getItem('score26_bracket_open')
      return v != null ? v === '1' : true // default open
    } catch { return true }
  })

  // 5.2 — Conditional activation: only render when KO matches exist
  const hasKO = matchs.some(m => PHASES.includes(m.phase))
  if (!hasKO) return null

  // Organize matches by phase, sorted by id for bracket position
  const byPhase = {}
  for (const phase of PHASES) {
    byPhase[phase] = matchs.filter(m => m.phase === phase).sort((a, b) => a.id - b.id)
    while (byPhase[phase].length < MATCH_COUNTS[phase]) byPhase[phase].push(null)
  }

  function toggleOpen() {
    const next = !open
    setOpen(next)
    try { localStorage.setItem('score26_bracket_open', next ? '1' : '0') } catch { /* ignore */ }
  }

  function handleClick(match) {
    if (!match) return
    onMatchClick?.(match.id)
  }

  // Phase labels
  const labels = [
    { key: '8e',     fr: '8es',    en: 'R16' },
    { key: '4e',     fr: '1/4',    en: 'QF' },
    { key: 'demi',   fr: '1/2',    en: 'SF' },
    { key: 'finale', fr: 'Finale', en: 'Final' },
  ]

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
        <div className="overflow-auto pb-4 -mx-4 px-4 scrollbar-none" style={{ maxHeight: '75vh' }}>
          {/* Phase column labels */}
          <div className="flex items-center min-w-max pt-1 pb-2">
            {labels.map((l, i) => (
              <div key={l.key} className="flex items-center">
                {i > 0 && <div className="shrink-0" style={{ width: 20 }} />}
                <div className="shrink-0 text-center" style={{ width: 128 }}>
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-surface-400 dark:text-surface-500">
                    {lang === 'fr' ? l.fr : l.en}
                  </span>
                </div>
              </div>
            ))}
          </div>
          {/* Bracket tree (recursive: Final ← SF ← QF ← R16) */}
          <div className="min-w-max">
            <BracketTree byPhase={byPhase} depth={3} slot={0} lang={lang} onMatchClick={handleClick} />
          </div>
        </div>
      )}
    </div>
  )
}
