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
    return <div className="flex justify-center py-20 text-gray-400">...</div>
  }

  return (
    <div className="flex flex-col gap-3" {...touchHandlers}>
      {/* Overlay onboarding (premier lancement uniquement) */}
      <OnboardingTip lang={lang} />

      {/* Indicateur pull-to-refresh */}
      {isPulling && (
        <div className="flex justify-center pb-1 text-blue-400 text-lg animate-spin select-none">
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
          <h2 className="text-base font-semibold text-red-500 mb-1 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse inline-block" />
            {t(lang, 'liveSection')}
          </h2>
          {enCours.map((match, i) => (
            <div key={match.id} className="card-stagger" style={{ animationDelay: `${i * 50}ms` }}>
              <MatchCardActive match={match} lang={lang} />
            </div>
          ))}
          <div className="h-px bg-slate-200 dark:bg-slate-800 my-1" />
        </>
      )}

      {/* Section À venir */}
      <h2 className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-1">
        {t(lang, 'upcoming')}
      </h2>
      {aVenir.length === 0 && (
        <p className="text-center text-slate-400 dark:text-slate-600 py-10 text-sm">
          {t(lang, 'noUpcoming')}
        </p>
      )}
      {(() => {
        // Prochain match sans prono = le plus proche dans le temps sans score prédit
        const nextId = aVenir
          .filter(m => m.score_predit_a == null)
          .sort((a, b) => new Date(a.date_coup_envoi) - new Date(b.date_coup_envoi))[0]?.id ?? null

        return Object.entries(
          aVenir.reduce((acc, m) => {
            const g = m.groupe ?? '?'
            if (!acc[g]) acc[g] = []
            acc[g].push(m)
            return acc
          }, {})
        ).sort(([a], [b]) => a.localeCompare(b)).map(([groupe, matchsGroupe]) => (
          <div key={groupe}>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mt-3 mb-1 pl-1">
              {t(lang, 'groupLabel')} {groupe}
            </p>
            {matchsGroupe.map((match, i) => (
              <div key={match.id} className="card-stagger mb-3" style={{ animationDelay: `${Math.min(i, 10) * 50}ms` }}>
                <MatchCardAvenir match={match} userId={userId} lang={lang} isOnline={isOnline} highlight={match.id === nextId} />
              </div>
            ))}
          </div>
        ))
      })()}
    </div>
  )
}
