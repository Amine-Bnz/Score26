import { useEffect, useState } from 'react'
import { getMatchs } from '../api'
import { MatchCardPasse } from '../components/MatchCard'
import { LastUpdated } from '../components/LastUpdated'
import { useAutoRefresh } from '../hooks/useAutoRefresh'
import { t } from '../i18n'

export default function MatchsPasses({ userId, lang, initialData = null }) {
  const [matchs, setMatchs] = useState([])
  const [loading, setLoading] = useState(true)

  function applyData(data) {
    if (data.error || !Array.isArray(data)) { setLoading(false); return }
    setMatchs(data.filter(m => m.score_reel_a != null).reverse())
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

      <h2 className="font-display text-base font-bold text-surface-800 dark:text-surface-200 mb-1">
        {t(lang, 'past')}
      </h2>
      {matchs.length === 0 && (
        <p className="text-center text-surface-400 dark:text-surface-600 py-10 text-sm">
          {t(lang, 'noPast')}
        </p>
      )}
      {(() => {
        let lastDate = null
        let cardIdx = 0
        return matchs.map(match => {
          const matchDate = new Date(match.date_coup_envoi).toLocaleDateString(
            lang === 'fr' ? 'fr-FR' : 'en-US',
            { weekday: 'long', day: 'numeric', month: 'long' }
          )
          const showSep = matchDate !== lastDate
          lastDate = matchDate
          const i = cardIdx++
          return (
            <div key={match.id}>
              {showSep && (
                <p className="text-[11px] font-semibold uppercase tracking-widest text-surface-400 dark:text-surface-500 mt-4 mb-2 pl-0.5">
                  {matchDate}
                </p>
              )}
              <div className="card-stagger mb-2.5" style={{ animationDelay: `${Math.min(i, 10) * 50}ms` }}>
                <MatchCardPasse match={match} lang={lang} />
              </div>
            </div>
          )
        })
      })()}
    </div>
  )
}
