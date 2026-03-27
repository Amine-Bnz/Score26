import { useState, useRef, useEffect } from 'react'
import { upsertProno } from '../api'
import { t, splitTeam } from '../i18n'

// Couleur de bordure gauche selon le résultat (matchs passés)
function getResultat(match) {
  if (!match.prono_id) return 'neutre'
  const { score_predit_a: pA, score_predit_b: pB, score_reel_a: rA, score_reel_b: rB } = match
  if (pA === rA && pB === rB) return 'exact'
  if (Math.sign(pA - pB) === Math.sign(rA - rB)) return 'bonne_issue'
  return 'rate'
}

const resultStyles = {
  exact:       { bar: 'bg-green-500', badge: 'bg-green-500/10 text-green-500 border-green-500/20' },
  bonne_issue: { bar: 'bg-blue-500',  badge: 'bg-blue-500/10  text-blue-500  border-blue-500/20'  },
  rate:        { bar: 'bg-red-500',   badge: 'bg-red-500/10   text-red-500   border-red-500/20'   },
  neutre:      { bar: 'bg-slate-600', badge: 'bg-slate-500/10 text-slate-400 border-slate-600/20' },
}

// Compteur animé 0 → valeur cible (pour les points obtenus)
function AnimatedCount({ value }) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (value == null) return
    let current = 0
    const step = Math.max(1, Math.ceil(value / 20))
    const id = setInterval(() => {
      current += step
      if (current >= value) { setCount(value); clearInterval(id) }
      else setCount(current)
    }, 30)
    return () => clearInterval(id)
  }, [value])
  return <>{count}</>
}

// Formate la date : "15 JUN · 21:00"
function formatDate(dateStr, lang) {
  const d = new Date(dateStr)
  const day = d.getDate().toString().padStart(2, '0')
  const month = d.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US', { month: 'short' }).toUpperCase()
  const time = d.toLocaleTimeString(lang === 'fr' ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  return `${day} ${month} · ${time}`
}

// Bloc équipe : drapeau + nom
function TeamBlock({ fullName, lang }) {
  const { flag, name } = splitTeam(fullName, lang)
  return (
    <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
      <span className="text-3xl leading-none">{flag}</span>
      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 truncate w-full text-center">
        {name}
      </span>
    </div>
  )
}

// ── Card matchs à venir ──────────────────────────────────────────────────────
export function MatchCardAvenir({ match, userId, lang, isOnline = true }) {
  const [scoreA, setScoreA] = useState(match.score_predit_a ?? '')
  const [scoreB, setScoreB] = useState(match.score_predit_b ?? '')
  const [saved,  setSaved]  = useState(false)
  const debounceRef = useRef(null)
  const savedTimerRef = useRef(null)

  const isVerrouille = match.verrouille === 1 || new Date() >= new Date(match.date_coup_envoi)

  function handleChange(val, setter, autre, isA) {
    const parsed = val === '' ? '' : Math.max(0, parseInt(val) || 0)
    setter(parsed)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const a = isA ? parsed : autre
      const b = isA ? autre : parsed
      if (a === '' || b === '') return
      if (!isOnline) return
      upsertProno({ user_id: userId, match_id: match.id, score_predit_a: a, score_predit_b: b })
        .then(() => {
          setSaved(true)
          clearTimeout(savedTimerRef.current)
          savedTimerRef.current = setTimeout(() => setSaved(false), 700)
        })
    }, 600)
  }

  return (
    <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl shadow-sm shadow-slate-200 dark:shadow-none ring-1 ring-slate-100 dark:ring-slate-800/60 p-4">
      {/* Date + verrou */}
      <div className="flex items-center justify-center gap-2 mb-4">
        <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 tracking-wide">
          {formatDate(match.date_coup_envoi, lang)}
        </span>
        {isVerrouille && (
          <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 px-2 py-0.5 rounded-full">
            🔒 {t(lang, 'locked')}
          </span>
        )}
      </div>

      {/* Équipes + inputs */}
      <div className="flex items-center gap-3">
        <TeamBlock fullName={match.equipe_a} lang={lang} />

        {/* Inputs score */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <input
            type="number" min="0" max="99"
            value={scoreA}
            disabled={isVerrouille}
            onChange={e => handleChange(e.target.value, setScoreA, scoreB, true)}
            className={`w-12 h-12 rounded-xl border-2 text-center bg-transparent text-xl font-bold text-slate-800 dark:text-white focus:outline-none disabled:opacity-30 disabled:cursor-not-allowed transition-colors duration-300
              ${saved ? 'border-solid border-green-400' : 'border-dashed border-slate-300 dark:border-slate-600 focus:border-solid focus:border-blue-500'}`}
          />
          <span className="text-slate-300 dark:text-slate-600 font-bold text-lg select-none">—</span>
          <input
            type="number" min="0" max="99"
            value={scoreB}
            disabled={isVerrouille}
            onChange={e => handleChange(e.target.value, setScoreB, scoreA, false)}
            className={`w-12 h-12 rounded-xl border-2 text-center bg-transparent text-xl font-bold text-slate-800 dark:text-white focus:outline-none disabled:opacity-30 disabled:cursor-not-allowed transition-colors duration-300
              ${saved ? 'border-solid border-green-400' : 'border-dashed border-slate-300 dark:border-slate-600 focus:border-solid focus:border-blue-500'}`}
          />
        </div>

        <TeamBlock fullName={match.equipe_b} lang={lang} />
      </div>
    </div>
  )
}

// ── Card match en cours (live) ───────────────────────────────────────────────
export function MatchCardActive({ match, lang }) {
  const scoreA = match.score_live_a ?? '?'
  const scoreB = match.score_live_b ?? '?'
  const minute = match.minute_live

  return (
    <div className="live-ring bg-slate-50 dark:bg-slate-900 rounded-2xl overflow-hidden">
      <div className="p-4">
        {/* Badge LIVE + minute */}
        <div className="flex items-center justify-center gap-2 mb-4">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
          <span className="text-[11px] font-extrabold tracking-widest text-red-500">LIVE</span>
          {minute != null && (
            <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">
              {minute}&apos;
            </span>
          )}
        </div>

        {/* Équipes + score live */}
        <div className="flex items-center gap-3">
          <TeamBlock fullName={match.equipe_a} lang={lang} />

          <div className="flex flex-col items-center gap-2 flex-shrink-0">
            {/* Score live */}
            <div className="flex items-center gap-2">
              <span className="text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums">
                {scoreA}
              </span>
              <span className="text-slate-300 dark:text-slate-600 font-bold">—</span>
              <span className="text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums">
                {scoreB}
              </span>
            </div>

            {/* Prono grisé */}
            {match.prono_id ? (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 mr-0.5">
                  {t(lang, 'myProno')} :
                </span>
                <span className="w-6 h-6 rounded-md bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-400 dark:text-slate-500 tabular-nums">
                  {match.score_predit_a}
                </span>
                <span className="text-slate-200 dark:text-slate-700 text-xs">—</span>
                <span className="w-6 h-6 rounded-md bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-400 dark:text-slate-500 tabular-nums">
                  {match.score_predit_b}
                </span>
              </div>
            ) : (
              <span className="text-xs text-slate-400 dark:text-slate-600">{t(lang, 'noProno')}</span>
            )}
          </div>

          <TeamBlock fullName={match.equipe_b} lang={lang} />
        </div>
      </div>
    </div>
  )
}

// ── Card matchs passés ───────────────────────────────────────────────────────
export function MatchCardPasse({ match, lang }) {
  const resultat = getResultat(match)
  const style = resultStyles[resultat]

  return (
    <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl shadow-sm shadow-slate-200 dark:shadow-none ring-1 ring-slate-100 dark:ring-slate-800/60 overflow-hidden">
      {/* Barre colorée en haut selon résultat */}
      <div className={`h-1 w-full ${style.bar}`} />

      <div className="p-4">
        {/* Équipes + score */}
        <div className="flex items-center gap-3">
          <TeamBlock fullName={match.equipe_a} lang={lang} />

          {/* Score réel + prono */}
          <div className="flex flex-col items-center gap-2 flex-shrink-0">
            {/* Score réel */}
            <div className="flex items-center gap-2">
              <span className="text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums">
                {match.score_reel_a}
              </span>
              <span className="text-slate-300 dark:text-slate-600 font-bold">—</span>
              <span className="text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums">
                {match.score_reel_b}
              </span>
            </div>

            {/* Prono grisé */}
            {match.prono_id ? (
              <div className="flex items-center gap-1.5">
                <span className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-sm font-bold text-slate-400 dark:text-slate-500 tabular-nums">
                  {match.score_predit_a}
                </span>
                <span className="text-slate-200 dark:text-slate-700 text-xs">—</span>
                <span className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-sm font-bold text-slate-400 dark:text-slate-500 tabular-nums">
                  {match.score_predit_b}
                </span>
              </div>
            ) : (
              <span className="text-xs text-slate-400 dark:text-slate-600">{t(lang, 'noProno')}</span>
            )}

            {/* Badge points */}
            {match.points_obtenus != null && (
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${style.badge}`}>
                +<AnimatedCount value={match.points_obtenus} /> pts
              </span>
            )}
          </div>

          <TeamBlock fullName={match.equipe_b} lang={lang} />
        </div>
      </div>
    </div>
  )
}
