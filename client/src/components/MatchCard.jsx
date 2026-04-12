import { useState, useRef, useEffect, memo } from 'react'
// canvas-confetti chargé dynamiquement au premier tap (P5)
let confettiPromise = null
function getConfetti() {
  if (!confettiPromise) confettiPromise = import('canvas-confetti').then(m => m.default)
  return confettiPromise
}
import { upsertProno, getFriendPronos, toggleReaction } from '../api'
import { queueProno } from '../hooks/useOfflineSync'
import { t, splitTeam } from '../i18n'
import { ChevronIcon, FriendsIcon } from './Icons'

// Couleur de bordure gauche selon le résultat (matchs passés)
function getResultat(match) {
  if (!match.prono_id) return 'neutre'
  const { score_predit_a: pA, score_predit_b: pB, score_reel_a: rA, score_reel_b: rB } = match
  if (pA === rA && pB === rB) return 'exact'
  if (Math.sign(pA - pB) === Math.sign(rA - rB)) return 'bonne_issue'
  return 'rate'
}

const resultStyles = {
  exact:       { border: 'border-l-result-exact', badge: 'bg-result-exact/10 text-result-exact', dot: 'bg-result-exact' },
  bonne_issue: { border: 'border-l-accent',       badge: 'bg-accent/10 text-accent',             dot: 'bg-accent' },
  rate:        { border: 'border-l-result-miss',   badge: 'bg-result-miss/10 text-result-miss',   dot: 'bg-result-miss' },
  neutre:      { border: 'border-l-surface-600',   badge: 'bg-surface-500/10 text-surface-400',   dot: 'bg-surface-400' },
}

// Compteur animé 0 → valeur cible (rAF, ~600ms)
function AnimatedCount({ value }) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (value == null || value === 0) { setCount(value ?? 0); return }
    const duration = 600
    let start = null
    let raf
    function tick(ts) {
      if (!start) start = ts
      const progress = Math.min((ts - start) / duration, 1)
      setCount(Math.round(progress * value))
      if (progress < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value])
  return <>{count}</>
}

// Formate la date : "15 JUN · 21:00 (heure locale)"
function formatDate(dateStr, lang) {
  const d = new Date(dateStr)
  const day = d.getDate().toString().padStart(2, '0')
  const month = d.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US', { month: 'short' }).toUpperCase()
  const time = d.toLocaleTimeString(lang === 'fr' ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  const tzHint = lang === 'fr' ? '(h. locale)' : '(local)'
  return `${day} ${month} · ${time} ${tzHint}`
}

// Countdown dynamique : "dans 2h30" si <24h, sinon date statique
function DateOrCountdown({ dateStr, lang }) {
  const [now, setNow] = useState(Date.now())
  const target = new Date(dateStr).getTime()
  const diff = target - now
  const isClose = diff > 0 && diff < 24 * 60 * 60 * 1000

  useEffect(() => {
    if (!isClose) return
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [isClose])

  if (!isClose) {
    return <>{formatDate(dateStr, lang)}</>
  }

  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  const countdown = h > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${m}min`
  return <>{lang === 'fr' ? `dans ${countdown}` : `in ${countdown}`}</>
}

// Bloc équipe : drapeau + nom
function TeamBlock({ fullName, lang }) {
  const { flag, name } = splitTeam(fullName, lang)
  return (
    <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
      <span className="text-2xl leading-none">{flag}</span>
      <span className="text-[11px] font-medium text-surface-500 dark:text-surface-400 truncate w-full text-center">
        {name}
      </span>
    </div>
  )
}

// ── Card matchs à venir ──────────────────────────────────────────────────────
export const MatchCardAvenir = memo(function MatchCardAvenir({ match, userId, lang, isOnline = true, highlight = false, lastChance = false, onPronoSaved }) {
  const isKO = match.phase && match.phase !== 'groupe'
  const [scoreA, setScoreA] = useState(match.score_predit_a ?? '')
  const [scoreB, setScoreB] = useState(match.score_predit_b ?? '')
  const [score90A, setScore90A] = useState(match.score_predit_90_a ?? '')
  const [score90B, setScore90B] = useState(match.score_predit_90_b ?? '')
  const [saved,  setSaved]  = useState(false)  // false | 'saving' | 'ok' | 'error'
  const debounceRef = useRef(null)
  const savedTimerRef = useRef(null)
  const prevScoreRef = useRef({ a: match.score_predit_a ?? '', b: match.score_predit_b ?? '' })
  const inputBRef = useRef(null)

  // Nettoyage des timers au démontage
  useEffect(() => {
    return () => {
      clearTimeout(debounceRef.current)
      clearTimeout(savedTimerRef.current)
    }
  }, [])

  const isVerrouille = match.verrouille === 1 || new Date() >= new Date(match.date_coup_envoi)

  function handleChange(val, setter, autre, isA) {
    const parsed = val === '' ? '' : Math.max(0, Math.min(99, parseInt(val) || 0))
    setter(parsed)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const a = isA ? parsed : autre
      const b = isA ? autre : parsed
      if (a === '' || b === '') return
      const pronoData = { user_id: userId, match_id: match.id, score_predit_a: a, score_predit_b: b }
      // Inclure score 90min si KO et renseigné
      if (isKO && score90A !== '' && score90B !== '') {
        pronoData.score_predit_90_a = score90A
        pronoData.score_predit_90_b = score90B
      }
      if (!isOnline) {
        // Sauvegarder en file offline
        queueProno(pronoData)
        navigator.vibrate?.(10)
        prevScoreRef.current = { a, b }
        onPronoSaved?.(match.id, a, b)
        setSaved('queued')
        clearTimeout(savedTimerRef.current)
        savedTimerRef.current = setTimeout(() => setSaved(false), 1200)
        return
      }
      setSaved('saving')
      upsertProno(pronoData)
        .then(res => {
          if (res.error) throw new Error(res.error)
          navigator.vibrate?.(10)
          prevScoreRef.current = { a, b }
          onPronoSaved?.(match.id, a, b)
          setSaved('ok')
          clearTimeout(savedTimerRef.current)
          savedTimerRef.current = setTimeout(() => setSaved(false), 700)
        })
        .catch(() => {
          // Réseau coupé en cours de requête → queue offline
          queueProno(pronoData)
          prevScoreRef.current = { a, b }
          onPronoSaved?.(match.id, a, b)
          setSaved('queued')
          clearTimeout(savedTimerRef.current)
          savedTimerRef.current = setTimeout(() => setSaved(false), 1200)
        })
    }, 600)
  }

  const inputClasses = (state) => {
    const base = 'w-11 h-11 rounded-lg border text-center bg-surface-50 dark:bg-surface-800 text-lg font-display font-bold text-surface-800 dark:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-25 disabled:cursor-not-allowed transition-colors duration-200'
    if (state === 'ok') return `${base} border-result-exact`
    if (state === 'queued') return `${base} border-gold`
    if (state === 'error') return `${base} border-result-miss`
    if (state === 'saving') return `${base} border-accent-light`
    return `${base} border-surface-200 dark:border-surface-700 focus:border-accent`
  }

  return (
    <div className={`bg-white dark:bg-surface-900 rounded-xl p-4 transition-shadow
      ${match.is_featured === 1 ? 'ring-2 ring-accent/40' : lastChance ? 'ring-1 ring-gold/50' : highlight ? 'ring-1 ring-accent/30' : 'border border-surface-200 dark:border-surface-800/60'}`}>
      {/* Date + verrou + badges */}
      <div className="flex items-center justify-center gap-2 mb-3">
        {match.is_featured === 1 && (
          <span className="text-[10px] font-bold bg-accent/20 text-accent px-2.5 py-0.5 rounded-full flex items-center gap-1">
            <span>★</span> {t(lang, 'matchOfDay')} · {t(lang, 'matchOfDayShort')}
          </span>
        )}
        {lastChance && (
          <span className="text-[10px] font-semibold bg-gold-muted text-gold-dark dark:text-gold-light px-2 py-0.5 rounded-full">
            {t(lang, 'lastChance')}
          </span>
        )}
        {highlight && !lastChance && (
          <span className="text-[10px] font-semibold bg-accent/10 text-accent px-2 py-0.5 rounded-full">
            {lang === 'fr' ? 'Prochain' : 'Next'}
          </span>
        )}
        <span className="text-[11px] font-medium text-surface-400 dark:text-surface-500 tracking-wide">
          <DateOrCountdown dateStr={match.date_coup_envoi} lang={lang} />
        </span>
        {isVerrouille && (
          <span className="text-[10px] font-semibold text-surface-400 dark:text-surface-500 px-1.5 py-0.5 rounded bg-surface-100 dark:bg-surface-800">
            {t(lang, 'locked')}
          </span>
        )}
      </div>

      {/* Équipes + inputs */}
      <div className="flex items-center gap-3">
        <TeamBlock fullName={match.equipe_a} lang={lang} />

        {/* Inputs score */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <input
            type="text" inputMode="numeric" pattern="[0-9]*"
            value={scoreA}
            disabled={isVerrouille}
            aria-label={`${lang === 'fr' ? 'Score' : 'Score'} ${splitTeam(match.equipe_a, lang).name}`}
            onFocus={e => e.target.select()}
            onChange={e => {
              const v = e.target.value.replace(/[^0-9]/g, '').slice(0, 2)
              handleChange(v, setScoreA, scoreB, true)
              if (v !== '') {
                setTimeout(() => { inputBRef.current?.focus(); inputBRef.current?.select() }, 0)
              }
            }}
            className={inputClasses(saved)}
          />
          <span className="text-surface-300 dark:text-surface-600 font-medium text-sm select-none" aria-hidden="true">–</span>
          <input
            ref={inputBRef}
            type="text" inputMode="numeric" pattern="[0-9]*"
            value={scoreB}
            disabled={isVerrouille}
            aria-label={`${lang === 'fr' ? 'Score' : 'Score'} ${splitTeam(match.equipe_b, lang).name}`}
            onFocus={e => e.target.select()}
            onChange={e => {
              const v = e.target.value.replace(/[^0-9]/g, '').slice(0, 2)
              handleChange(v, setScoreB, scoreA, false)
              if (v !== '') {
                setTimeout(() => e.target.blur(), 0)
              }
            }}
            className={inputClasses(saved)}
          />
        </div>

        <TeamBlock fullName={match.equipe_b} lang={lang} />
      </div>

      {/* Score 90min (phases KO uniquement) */}
      {isKO && !isVerrouille && (
        <div className="flex items-center justify-center gap-2 mt-2 pt-2 border-t border-surface-100 dark:border-surface-800/60">
          <span className="text-[10px] text-surface-400 dark:text-surface-500 mr-1">90&apos;</span>
          <input
            type="text" inputMode="numeric" pattern="[0-9]*"
            value={score90A} disabled={isVerrouille}
            placeholder="–"
            aria-label={`Score 90' ${splitTeam(match.equipe_a, lang).name}`}
            onFocus={e => e.target.select()}
            onChange={e => {
              const v = e.target.value.replace(/[^0-9]/g, '').slice(0, 2)
              const p = v === '' ? '' : Math.max(0, Math.min(99, parseInt(v) || 0))
              setScore90A(p)
            }}
            className="w-10 h-10 rounded border text-center text-xs font-bold bg-surface-50 dark:bg-surface-800 text-surface-600 dark:text-surface-300 border-surface-200 dark:border-surface-700 focus:outline-none focus:border-accent"
          />
          <span className="text-surface-300 dark:text-surface-600 text-[10px]" aria-hidden="true">–</span>
          <input
            type="text" inputMode="numeric" pattern="[0-9]*"
            value={score90B} disabled={isVerrouille}
            placeholder="–"
            aria-label={`Score 90' ${splitTeam(match.equipe_b, lang).name}`}
            onFocus={e => e.target.select()}
            onChange={e => {
              const v = e.target.value.replace(/[^0-9]/g, '').slice(0, 2)
              const p = v === '' ? '' : Math.max(0, Math.min(99, parseInt(v) || 0))
              setScore90B(p)
            }}
            className="w-10 h-10 rounded border text-center text-xs font-bold bg-surface-50 dark:bg-surface-800 text-surface-600 dark:text-surface-300 border-surface-200 dark:border-surface-700 focus:outline-none focus:border-accent"
          />
          <span className="text-[10px] text-surface-400 dark:text-surface-500 ml-1">
            {lang === 'fr' ? '(si prolongation)' : '(if extra time)'}
          </span>
        </div>
      )}
    </div>
  )
})

// ── Card match en cours (live) ───────────────────────────────────────────────
export const MatchCardActive = memo(function MatchCardActive({ match, lang, userId }) {
  const scoreA = match.score_live_a ?? '?'
  const scoreB = match.score_live_b ?? '?'
  const minute = match.minute_live

  return (
    <div className={`live-ring bg-white dark:bg-surface-900 rounded-xl overflow-hidden ${match.is_featured === 1 ? 'ring-2 ring-accent/40' : ''}`}>
      <div className="p-4">
        {/* Badge match du jour */}
        {match.is_featured === 1 && (
          <div className="flex justify-center mb-2">
            <span className="text-[10px] font-bold bg-accent/20 text-accent px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <span>★</span> {t(lang, 'matchOfDay')} · {t(lang, 'matchOfDayShort')}
            </span>
          </div>
        )}
        {/* Badge LIVE + minute */}
        <div className="flex items-center justify-center gap-2 mb-3">
          <span className="w-1.5 h-1.5 rounded-full bg-result-miss animate-pulse flex-shrink-0" />
          <span className="text-[11px] font-bold tracking-widest text-result-miss">LIVE</span>
          {minute != null && (
            <span className="text-[11px] font-medium text-surface-400 dark:text-surface-500">
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
              <span className="text-3xl font-display font-bold text-surface-900 dark:text-white tabular-nums">
                {scoreA}
              </span>
              <span className="text-surface-300 dark:text-surface-600 font-medium text-sm">–</span>
              <span className="text-3xl font-display font-bold text-surface-900 dark:text-white tabular-nums">
                {scoreB}
              </span>
            </div>

            {/* Prono grisé */}
            {match.prono_id ? (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-medium text-surface-400 dark:text-surface-500 mr-0.5">
                  {t(lang, 'myProno')}
                </span>
                <span className="w-6 h-6 rounded bg-surface-100 dark:bg-surface-800 flex items-center justify-center text-xs font-bold text-surface-400 dark:text-surface-500 tabular-nums">
                  {match.score_predit_a}
                </span>
                <span className="text-surface-300 dark:text-surface-700 text-[10px]">–</span>
                <span className="w-6 h-6 rounded bg-surface-100 dark:bg-surface-800 flex items-center justify-center text-xs font-bold text-surface-400 dark:text-surface-500 tabular-nums">
                  {match.score_predit_b}
                </span>
              </div>
            ) : (
              <span className="text-[11px] text-surface-400 dark:text-surface-600">{t(lang, 'noProno')}</span>
            )}
          </div>

          <TeamBlock fullName={match.equipe_b} lang={lang} />
        </div>
        {userId && <FriendPronosSection matchId={match.id} userId={userId} lang={lang} />}
      </div>
    </div>
  )
})

// ── Section pronos amis (lazy-loaded, expandable) ───────────────────────────��
const REACTION_EMOJIS = ['🔥', '😂', '😮', '💀']

function FriendPronosSection({ matchId, userId, lang }) {
  const [open, setOpen] = useState(false)
  const [pronos, setPronos] = useState(null)
  const [loading, setLoading] = useState(false)

  async function toggle(e) {
    e.stopPropagation()
    const willOpen = !open
    setOpen(willOpen)
    if (willOpen && !pronos && !loading) {
      setLoading(true)
      const data = await getFriendPronos(userId, matchId)
      if (!data.error) setPronos(data)
      setLoading(false)
    }
  }

  async function handleReaction(targetUserId, emoji) {
    const res = await toggleReaction(targetUserId, matchId, emoji)
    if (res.error) return
    // Optimistic update
    setPronos(prev => prev.map(p => {
      if (p.user_id !== targetUserId) return p
      const reactions = { ...p.reactions }
      if (res.action === 'removed') {
        if (reactions[emoji]) reactions[emoji]--
        if (reactions[emoji] <= 0) delete reactions[emoji]
        return { ...p, my_reaction: null, reactions }
      }
      // added or updated
      if (p.my_reaction && p.my_reaction !== emoji && reactions[p.my_reaction]) {
        reactions[p.my_reaction]--
        if (reactions[p.my_reaction] <= 0) delete reactions[p.my_reaction]
      }
      reactions[emoji] = (reactions[emoji] || 0) + (p.my_reaction === emoji ? 0 : 1)
      return { ...p, my_reaction: emoji, reactions }
    }))
  }

  return (
    <div className="mt-2 pt-2 border-t border-surface-100 dark:border-surface-800/60">
      <button onClick={toggle} className="flex items-center gap-1.5 w-full min-h-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded">
        <FriendsIcon className="w-3.5 h-3.5 text-surface-400 dark:text-surface-500" />
        <span className="text-[10px] font-medium text-surface-400 dark:text-surface-500">{t(lang, 'friendPronos')}</span>
        <ChevronIcon className={`w-3 h-3 ml-auto text-surface-400 dark:text-surface-500 transition-transform duration-200 ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && (
        <div className="mt-2 flex flex-col gap-2">
          {loading && <span className="spinner-btn text-surface-400" style={{ width: 12, height: 12, borderWidth: 1.5 }} />}
          {pronos?.length === 0 && <span className="text-[10px] text-surface-400 dark:text-surface-500">{lang === 'fr' ? 'Personne n\'a joué ce match' : 'No one played this match'}</span>}
          {pronos?.map(p => (
            <div key={p.user_id} className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-surface-500 dark:text-surface-400 truncate flex-1">{p.pseudo}</span>
                <span className="text-[11px] font-bold tabular-nums text-surface-600 dark:text-surface-300">
                  {p.score_predit_a} – {p.score_predit_b}
                </span>
                {p.points_obtenus != null && (
                  <span className={`text-[10px] font-semibold tabular-nums ${
                    p.points_obtenus >= 50 ? 'text-result-exact' : p.points_obtenus >= 20 ? 'text-accent' : 'text-result-miss'
                  }`}>
                    +{p.points_obtenus}
                  </span>
                )}
              </div>
              {/* Emoji reactions */}
              <div className="flex items-center gap-1">
                {REACTION_EMOJIS.map(emoji => {
                  const count = p.reactions?.[emoji] || 0
                  const isMine = p.my_reaction === emoji
                  return (
                    <button
                      key={emoji}
                      onClick={(e) => { e.stopPropagation(); handleReaction(p.user_id, emoji) }}
                      className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[11px] transition-all active:scale-90
                        ${isMine
                          ? 'bg-accent/20 ring-1 ring-accent/40'
                          : 'bg-surface-100 dark:bg-surface-800 hover:bg-surface-200 dark:hover:bg-surface-700'}`}
                    >
                      <span>{emoji}</span>
                      {count > 0 && <span className="text-[9px] tabular-nums text-surface-500 dark:text-surface-400">{count}</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Card matchs passés ───────────────────────────────────────────────────────
export const MatchCardPasse = memo(function MatchCardPasse({ match, lang, userId }) {
  const resultat = getResultat(match)
  const style = resultStyles[resultat]
  const firedRef = useRef(false)
  const [hintVisible, setHintVisible] = useState(() => {
    if (resultat !== 'exact') return false
    try { return !localStorage.getItem('score26_confetti_seen') } catch { return false }
  })

  // Confetti au tap sur une card "score exact" (une seule fois par session)
  function handleClick(e) {
    if (resultat !== 'exact' || firedRef.current) return
    firedRef.current = true
    if (hintVisible) {
      setHintVisible(false)
      try { localStorage.setItem('score26_confetti_seen', '1') } catch {}
    }
    const rect = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX || rect.left + rect.width / 2) / window.innerWidth
    const y = (e.clientY || rect.top + rect.height / 2) / window.innerHeight
    getConfetti().then(fn => fn({ particleCount: 60, spread: 55, origin: { x, y }, disableForReducedMotion: true }))
    navigator.vibrate?.(15)
  }

  return (
    <div
      className={`bg-white dark:bg-surface-900 rounded-xl overflow-hidden border border-surface-200 dark:border-surface-800/60 border-l-[3px] ${style.border} ${resultat === 'exact' ? 'cursor-pointer' : ''}`}
      onClick={handleClick}
    >
      <div className="p-4">
        {/* Badge match du jour */}
        {match.is_featured === 1 && (
          <div className="flex justify-center mb-2">
            <span className="text-[10px] font-bold bg-accent/20 text-accent px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <span>★</span> {t(lang, 'matchOfDay')} · {t(lang, 'matchOfDayShort')}
            </span>
          </div>
        )}
        {/* Équipes + score */}
        <div className="flex items-center gap-3">
          <TeamBlock fullName={match.equipe_a} lang={lang} />

          {/* Score réel + prono */}
          <div className="flex flex-col items-center gap-2 flex-shrink-0">
            {/* Score réel */}
            <div className="flex items-center gap-2">
              <span className="text-2xl font-display font-bold text-surface-900 dark:text-white tabular-nums">
                {match.score_reel_a}
              </span>
              <span className="text-surface-300 dark:text-surface-600 font-medium text-sm">–</span>
              <span className="text-2xl font-display font-bold text-surface-900 dark:text-white tabular-nums">
                {match.score_reel_b}
              </span>
            </div>

            {/* Prono grisé */}
            {match.prono_id ? (
              <div className="flex items-center gap-1.5">
                <span className="w-6 h-6 rounded bg-surface-100 dark:bg-surface-800 flex items-center justify-center text-xs font-bold text-surface-400 dark:text-surface-500 tabular-nums">
                  {match.score_predit_a}
                </span>
                <span className="text-surface-300 dark:text-surface-700 text-[10px]">–</span>
                <span className="w-6 h-6 rounded bg-surface-100 dark:bg-surface-800 flex items-center justify-center text-xs font-bold text-surface-400 dark:text-surface-500 tabular-nums">
                  {match.score_predit_b}
                </span>
              </div>
            ) : (
              <span className="text-[11px] text-surface-400 dark:text-surface-600">{t(lang, 'noProno')}</span>
            )}

            {/* Badge points */}
            {match.points_obtenus != null && (
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${style.badge} flex items-center gap-1`}>
                <span className={`w-1.5 h-1.5 rounded-full ${style.dot} inline-block`} />
                +<AnimatedCount value={match.points_obtenus} /> pts
              </span>
            )}
            {/* Hint "Tap !" */}
            {hintVisible && (
              <span className="text-[10px] text-result-exact animate-bounce">
                Tap !
              </span>
            )}
          </div>

          <TeamBlock fullName={match.equipe_b} lang={lang} />
        </div>
        {userId && <FriendPronosSection matchId={match.id} userId={userId} lang={lang} />}
      </div>
    </div>
  )
})
