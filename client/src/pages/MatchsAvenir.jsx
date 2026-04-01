import { useEffect, useState } from 'react'
import { getMatchs } from '../api'
import { MatchCardAvenir, MatchCardActive } from '../components/MatchCard'
import { LastUpdated } from '../components/LastUpdated'
import OnboardingTip from '../components/OnboardingTip'
import { useAutoRefresh } from '../hooks/useAutoRefresh'
import { t } from '../i18n'

export default function MatchsAvenir({ userId, lang, isOnline = true, initialData = null }) {
  const [aVenir,  setAVenir]  = useState([])
  const [enCours, setEnCours] = useState([])
  const [loading, setLoading] = useState(true)
  const [showOnlyMissing, setShowOnlyMissing] = useState(false)

  // Met à jour le state local quand un prono est sauvegardé (compteur temps réel)
  function handlePronoSaved(matchId, a, b) {
    setAVenir(prev => prev.map(m => m.id === matchId ? { ...m, score_predit_a: a, score_predit_b: b } : m))
  }

  function applyData(data) {
    if (data.error || !Array.isArray(data)) { setLoading(false); return }
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

  if (loading) {
    return <div className="flex justify-center py-20 text-surface-400">...</div>
  }

  return (
    <div className="flex flex-col gap-3" {...touchHandlers}>
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
            <div key={match.id} className="card-stagger" style={{ animationDelay: `${i * 50}ms` }}>
              <MatchCardActive match={match} lang={lang} />
            </div>
          ))}
          <div className="h-px bg-surface-200 dark:bg-surface-800 my-1" />
        </>
      )}

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
        // Filtre : si actif, n'affiche que les matchs sans prono
        const filtered = showOnlyMissing ? aVenir.filter(m => m.score_predit_a == null) : aVenir

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
            const g = m.groupe ?? '?'
            if (!acc[g]) acc[g] = []
            acc[g].push(m)
            return acc
          }, {})
        ).sort(([a], [b]) => a.localeCompare(b)).map(([groupe, matchsGroupe]) => (
          <div key={groupe}>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-surface-400 dark:text-surface-500 mt-4 mb-2 pl-0.5">
              {t(lang, 'groupLabel')} {groupe}
            </p>
            {matchsGroupe.map((match, i) => (
              <div key={match.id} className="card-stagger mb-2.5" style={{ animationDelay: `${Math.min(i, 10) * 50}ms` }}>
                <MatchCardAvenir match={match} userId={userId} lang={lang} isOnline={isOnline} highlight={match.id === nextId} lastChance={lastChanceIds.has(match.id)} onPronoSaved={handlePronoSaved} />
              </div>
            ))}
          </div>
        ))
      })()}
    </div>
  )
}
