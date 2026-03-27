import { useEffect, useState } from 'react'
import { getMatchs } from '../api'
import { MatchCardAvenir, MatchCardActive } from '../components/MatchCard'
import { LastUpdated } from '../components/LastUpdated'
import { useAutoRefresh } from '../hooks/useAutoRefresh'
import { t } from '../i18n'

export default function MatchsAvenir({ userId, lang, isOnline = true }) {
  const [aVenir,  setAVenir]  = useState([])
  const [enCours, setEnCours] = useState([])
  const [loading, setLoading] = useState(true)

  function charger() {
    return getMatchs(userId).then(data => {
      // En cours : statut explicitement 'en_cours'
      setEnCours(data.filter(m => m.statut === 'en_cours'))
      // À venir : pas encore de score réel ET pas en cours
      setAVenir(data.filter(m => m.score_reel_a == null && m.statut !== 'en_cours'))
      setLoading(false)
    })
  }

  const { lastUpdate, isPulling, touchHandlers, markUpdated } = useAutoRefresh(charger)

  useEffect(() => {
    charger().then(markUpdated)
  }, [userId])

  if (loading) {
    return <div className="flex justify-center py-20 text-gray-400">...</div>
  }

  return (
    <div className="flex flex-col gap-3" {...touchHandlers}>
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
      {Object.entries(
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
            <div key={match.id} className="card-stagger mb-3" style={{ animationDelay: `${i * 50}ms` }}>
              <MatchCardAvenir match={match} userId={userId} lang={lang} isOnline={isOnline} />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
