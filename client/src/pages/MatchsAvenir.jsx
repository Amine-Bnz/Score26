import { useEffect, useState, useRef } from 'react'
import { getMatchs } from '../api'
import { MatchCardAvenir, MatchCardActive } from '../components/MatchCard'
import { t } from '../i18n'

export default function MatchsAvenir({ userId, lang }) {
  const [aVenir,  setAVenir]  = useState([])
  const [enCours, setEnCours] = useState([])
  const [loading, setLoading] = useState(true)
  const intervalRef = useRef(null)

  useEffect(() => {
    let active = true

    function charger() {
      getMatchs(userId).then(data => {
        if (!active) return

        const live    = data.filter(m => m.statut === 'en_cours')
        const upcoming = data.filter(m => m.statut === 'a_venir')

        setEnCours(live)
        setAVenir(upcoming)
        setLoading(false)

        // Démarrer le polling si match en cours et pas encore lancé
        if (live.length > 0 && !intervalRef.current) {
          intervalRef.current = setInterval(charger, 60_000)
        }
        // Stopper le polling si plus de match en cours
        if (live.length === 0 && intervalRef.current) {
          clearInterval(intervalRef.current)
          intervalRef.current = null
        }
      })
    }

    charger()

    return () => {
      active = false
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [userId])

  if (loading) {
    return <div className="flex justify-center py-20 text-gray-400">...</div>
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Section En direct */}
      {enCours.length > 0 && (
        <>
          <h2 className="text-base font-semibold text-red-500 mb-1 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse inline-block" />
            {t(lang, 'liveSection')}
          </h2>
          {enCours.map(match => (
            <MatchCardActive key={match.id} match={match} lang={lang} />
          ))}
          <div className="h-px bg-slate-200 dark:bg-slate-800 my-1" />
        </>
      )}

      {/* Section À venir */}
      <h2 className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-1">
        {t(lang, 'upcoming')}
      </h2>
      {aVenir.length === 0 && (
        <p className="text-center text-gray-400 dark:text-gray-600 py-10 text-sm">—</p>
      )}
      {aVenir.map(match => (
        <MatchCardAvenir key={match.id} match={match} userId={userId} lang={lang} />
      ))}
    </div>
  )
}
