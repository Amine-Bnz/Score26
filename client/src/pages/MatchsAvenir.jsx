import { useEffect, useState } from 'react'
import { getMatchs } from '../api'
import { MatchCardAvenir, MatchCardActive } from '../components/MatchCard'
import { LastUpdated } from '../components/LastUpdated'
import OnboardingTip from '../components/OnboardingTip'
import BonusPronos from '../components/BonusPronos'
import Bracket from '../components/Bracket'
import TournamentEnded from '../components/TournamentEnded'
import { MatchCardSkeleton } from '../components/Skeleton'
import { ChevronIcon } from '../components/Icons'
import { useAutoRefresh } from '../hooks/useAutoRefresh'
import { t, phaseLabel, PHASE_ORDER } from '../i18n'

export default function MatchsAvenir({ userId, lang, isOnline = true, initialData = null }) {
  const [aVenir,  setAVenir]  = useState([])
  const [enCours, setEnCours] = useState([])
  const [allMatchs, setAllMatchs] = useState([])
  const [loading, setLoading] = useState(true)
  const [showOnlyMissing, setShowOnlyMissing] = useState(false)
  const [teamFilter, setTeamFilter] = useState('')
  const [collapsedGroups, setCollapsedGroups] = useState(() => {
    try { const s = localStorage.getItem('score26_collapsed_avenir'); return s ? JSON.parse(s) : {} } catch { return {} }
  })
  function toggleGroup(g) {
    setCollapsedGroups(prev => {
      const next = { ...prev, [g]: !prev[g] }
      try { localStorage.setItem('score26_collapsed_avenir', JSON.stringify(next)) } catch {}
      return next
    })
  }

  // Met à jour le state local quand un prono est sauvegardé (compteur temps réel)
  function handlePronoSaved(matchId, a, b) {
    setAVenir(prev => prev.map(m => m.id === matchId ? { ...m, score_predit_a: a, score_predit_b: b } : m))
  }

  // Bracket click → expand group if collapsed + scroll to match card
  function scrollToMatch(matchId) {
    const match = allMatchs.find(m => m.id === matchId)
    if (!match) return
    const group = match.phase === 'groupe' ? (match.groupe ?? '?') : (match.phase ?? '?')
    setCollapsedGroups(prev => ({ ...prev, [group]: false }))
    setTimeout(() => {
      const el = document.getElementById(`match-${matchId}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        el.classList.add('ring-2', 'ring-accent')
        setTimeout(() => el.classList.remove('ring-2', 'ring-accent'), 2000)
      }
    }, 100)
  }

  function applyData(data) {
    if (data.error || !Array.isArray(data)) { setLoading(false); return }
    setAllMatchs(data)
    setEnCours(data.filter(m => m.statut === 'en_cours'))
    setAVenir(data.filter(m => m.score_reel_a == null && m.statut !== 'en_cours'))
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

  // Tournoi terminé : tous les matchs sont "termine", aucun à venir ni en cours
  const isTournamentOver = !loading && allMatchs.length > 0 && aVenir.length === 0 && enCours.length === 0
    && allMatchs.every(m => m.statut === 'termine')

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        {[0, 1, 2, 3].map(i => <MatchCardSkeleton key={i} />)}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3" {...touchHandlers}>
      {/* Écran tournoi terminé */}
      {isTournamentOver && <TournamentEnded userId={userId} lang={lang} />}
      {/* Overlay onboarding (premier lancement uniquement) */}
      <OnboardingTip lang={lang} />

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

      {/* Section En direct */}
      {enCours.length > 0 && (
        <>
          <h2 className="text-sm font-semibold text-result-miss flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-result-miss animate-pulse inline-block" />
            {t(lang, 'liveSection')}
          </h2>
          {enCours.map((match, i) => (
            <div key={match.id} id={`match-${match.id}`} className="card-stagger" style={{ animationDelay: `${i * 50}ms` }}>
              <MatchCardActive match={match} lang={lang} userId={userId} />
            </div>
          ))}
          <div className="h-px bg-surface-200 dark:bg-surface-800 my-1" />
        </>
      )}

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

      {/* Pronos bonus */}
      <BonusPronos userId={userId} lang={lang} matchs={allMatchs} isOnline={isOnline} />

      {/* Section À venir — compteur + filtre */}
      {(() => {
        const placed = aVenir.filter(m => m.score_predit_a != null).length
        const total = aVenir.length
        return (
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-display text-base font-bold text-surface-800 dark:text-surface-200">
              {t(lang, 'upcoming')}
            </h2>
            {total > 0 && (
              <button
                onClick={() => setShowOnlyMissing(v => !v)}
                className={`text-[11px] font-medium px-2.5 py-1 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent
                  ${showOnlyMissing
                    ? 'bg-accent text-surface-950'
                    : 'bg-surface-200 dark:bg-surface-800 text-surface-500 dark:text-surface-400'}`}
              >
                {t(lang, 'pronosPlaced')} {placed}/{total}
              </button>
            )}
          </div>
        )
      })()}
      {aVenir.length === 0 && (
        <p className="text-center text-surface-400 dark:text-surface-600 py-10 text-sm">
          {t(lang, 'noUpcoming')}
        </p>
      )}
      {(() => {
        // Filtres : sans prono + par équipe
        let filtered = showOnlyMissing ? aVenir.filter(m => m.score_predit_a == null) : aVenir
        if (teamFilter.trim()) {
          const q = teamFilter.trim().toLowerCase()
          filtered = filtered.filter(m => m.equipe_a.toLowerCase().includes(q) || m.equipe_b.toLowerCase().includes(q))
        }

        // Prochain match sans prono = le plus proche dans le temps sans score prédit
        const nextId = aVenir
          .filter(m => m.score_predit_a == null)
          .sort((a, b) => new Date(a.date_coup_envoi) - new Date(b.date_coup_envoi))[0]?.id ?? null

        // Matchs < 30 min sans prono = "dernier moment"
        const now = Date.now()
        const lastChanceIds = new Set(
          aVenir
            .filter(m => m.score_predit_a == null && new Date(m.date_coup_envoi).getTime() - now < 30 * 60 * 1000 && new Date(m.date_coup_envoi).getTime() - now > 0)
            .map(m => m.id)
        )

        if (showOnlyMissing && filtered.length === 0) {
          return (
            <p className="text-center text-surface-400 dark:text-surface-600 py-8 text-sm">
              {lang === 'fr' ? 'Tous les pronos sont posés !' : 'All predictions are placed!'}
            </p>
          )
        }

        return Object.entries(
          filtered.reduce((acc, m) => {
            const g = m.phase === 'groupe' ? (m.groupe ?? '?') : (m.phase ?? '?')
            if (!acc[g]) acc[g] = []
            acc[g].push(m)
            return acc
          }, {})
        ).sort(([a], [b]) => (PHASE_ORDER[a] ?? 99) - (PHASE_ORDER[b] ?? 99)).map(([groupe, matchsGroupe]) => (
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
                {matchsGroupe.filter(m => m.score_predit_a != null).length}/{matchsGroupe.length}
              </span>
            </button>
            {!collapsedGroups[groupe] && matchsGroupe.map((match, i) => (
              <div key={match.id} id={`match-${match.id}`} className="card-stagger mb-2.5" style={{ animationDelay: `${Math.min(i, 10) * 50}ms` }}>
                <MatchCardAvenir match={match} userId={userId} lang={lang} isOnline={isOnline} highlight={match.id === nextId} lastChance={lastChanceIds.has(match.id)} onPronoSaved={handlePronoSaved} />
              </div>
            ))}
          </div>
        ))
      })()}

      {/* Bracket phases finales */}
      <Bracket matchs={allMatchs} lang={lang} onMatchClick={scrollToMatch} />
    </div>
  )
}
