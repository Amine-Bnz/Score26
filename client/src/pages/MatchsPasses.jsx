import { useEffect, useState } from 'react'
import { getMatchs } from '../api'
import { MatchCardPasse } from '../components/MatchCard'
import { LastUpdated } from '../components/LastUpdated'
import { useAutoRefresh } from '../hooks/useAutoRefresh'
import { t } from '../i18n'

export default function MatchsPasses({ userId, lang }) {
  const [matchs, setMatchs] = useState([])
  const [loading, setLoading] = useState(true)

  function charger() {
    return getMatchs(userId).then(data => {
      if (data.error || !Array.isArray(data)) { setLoading(false); return }
      // Terminés : score réel renseigné (source de vérité), du plus récent au plus ancien
      setMatchs(data.filter(m => m.score_reel_a != null).reverse())
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

      <h2 className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-1">
        {t(lang, 'past')}
      </h2>
      {matchs.length === 0 && (
        <p className="text-center text-slate-400 dark:text-slate-600 py-10 text-sm">
          {t(lang, 'noPast')}
        </p>
      )}
      {matchs.map((match, i) => (
        <div key={match.id} className="card-stagger" style={{ animationDelay: `${i * 50}ms` }}>
          <MatchCardPasse match={match} lang={lang} />
        </div>
      ))}
    </div>
  )
}
