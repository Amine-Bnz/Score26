import { useEffect, useState } from 'react'
import { getMatchs } from '../api'
import { MatchCardPasse } from '../components/MatchCard'
import { LastUpdated } from '../components/LastUpdated'
import { ChevronIcon } from '../components/Icons'
import { useAutoRefresh } from '../hooks/useAutoRefresh'
import { t, phaseLabel, PHASE_ORDER } from '../i18n'
import { MatchCardSkeleton } from '../components/Skeleton'

export default function MatchsPasses({ userId, lang, initialData = null }) {
  const [matchs, setMatchs] = useState([])
  const [loading, setLoading] = useState(true)
  const [teamFilter, setTeamFilter] = useState('')
  const [collapsedGroups, setCollapsedGroups] = useState(() => {
    try { const s = localStorage.getItem('score26_collapsed_passes'); return s ? JSON.parse(s) : {} } catch { return {} }
  })
  function toggleGroup(g) {
    setCollapsedGroups(prev => {
      const next = { ...prev, [g]: !prev[g] }
      try { localStorage.setItem('score26_collapsed_passes', JSON.stringify(next)) } catch {}
      return next
    })
  }

  function applyData(data) {
    if (data.error || !Array.isArray(data)) { setLoading(false); return }
    setMatchs(data.filter(m => m.score_reel_a != null))
    setLoading(false)
  }

  function charger() {
    return getMatchs(userId).then(applyData)
  }

  const { lastUpdate, isPulling, touchHandlers, markUpdated } = useAutoRefresh(charger)

  // Utilise les données prefetchées si disponibles, sinon fetch
  useEffect(() => {
    if (initialData) { applyData(initialData); markUpdated(); return }
    charger().then(markUpdated)
  }, [userId])

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        {[0, 1, 2, 3].map(i => <MatchCardSkeleton key={i} />)}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3" {...touchHandlers}>
      {/* Indicateur pull-to-refresh */}
      {isPulling && (
        <div className="flex justify-center pb-1 text-accent text-lg animate-spin select-none">
          ↻
        </div>
      )}

      {/* Timestamp dernière MAJ */}
      <div className="flex justify-end">
        <LastUpdated timestamp={lastUpdate} lang={lang} />
      </div>

      {/* Filtre par équipe */}
      <div className="flex gap-2">
        <input
          type="text"
          value={teamFilter}
          onChange={e => setTeamFilter(e.target.value)}
          placeholder={t(lang, 'filterTeam')}
          className="flex-1 px-3 py-2 rounded-xl bg-surface-100 dark:bg-surface-800 text-surface-900 dark:text-white text-xs placeholder:text-surface-400 dark:placeholder:text-surface-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
        {teamFilter && (
          <button
            onClick={() => setTeamFilter('')}
            className="text-xs text-surface-400 hover:text-accent font-medium px-2"
          >
            {t(lang, 'clearFilter')}
          </button>
        )}
      </div>

      <h2 className="font-display text-base font-bold text-surface-800 dark:text-surface-200 mb-1">
        {t(lang, 'past')}
      </h2>
      {matchs.length === 0 && (
        <p className="text-center text-surface-400 dark:text-surface-600 py-10 text-sm">
          {t(lang, 'noPast')}
        </p>
      )}
      {(() => {
        let filtered = matchs
        if (teamFilter.trim()) {
          const q = teamFilter.trim().toLowerCase()
          filtered = filtered.filter(m => m.equipe_a.toLowerCase().includes(q) || m.equipe_b.toLowerCase().includes(q))
        }
        const groups = filtered.reduce((acc, m) => {
          const g = m.phase === 'groupe' ? (m.groupe ?? '?') : (m.phase ?? '?')
          if (!acc[g]) acc[g] = []
          acc[g].push(m)
          return acc
        }, {})
        return Object.entries(groups)
          .sort(([a], [b]) => (PHASE_ORDER[a] ?? 99) - (PHASE_ORDER[b] ?? 99))
          .map(([groupe, matchsGroupe]) => (
            <div key={groupe}>
              <button
                onClick={() => toggleGroup(groupe)}
                className="flex items-center gap-1.5 w-full mt-4 mb-2 pl-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
              >
                <ChevronIcon className={`w-3.5 h-3.5 text-surface-400 dark:text-surface-500 transition-transform duration-200 ${collapsedGroups[groupe] ? '' : 'rotate-90'}`} />
                <span className="text-[11px] font-semibold uppercase tracking-widest text-surface-400 dark:text-surface-500">
                  {phaseLabel(groupe, lang)}
                </span>
                <span className="ml-auto text-[10px] text-surface-400 dark:text-surface-500 tabular-nums">
                  {matchsGroupe.length}
                </span>
              </button>
              {!collapsedGroups[groupe] && matchsGroupe.map((match, i) => (
                <div key={match.id} className="card-stagger mb-2.5" style={{ animationDelay: `${Math.min(i, 10) * 50}ms` }}>
                  <MatchCardPasse match={match} lang={lang} userId={userId} />
                </div>
              ))}
            </div>
          ))
      })()}
    </div>
  )
}
