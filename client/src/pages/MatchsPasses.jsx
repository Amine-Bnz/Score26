import { useEffect, useState } from 'react'
import { getMatchs } from '../api'
import { MatchCardPasse } from '../components/MatchCard'
import { t } from '../i18n'

export default function MatchsPasses({ userId, lang }) {
  const [matchs, setMatchs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getMatchs(userId).then(data => {
      // Ne garder que les matchs terminés, du plus récent au plus ancien
      setMatchs(data.filter(m => m.statut === 'termine').reverse())
      setLoading(false)
    })
  }, [userId])

  if (loading) {
    return <div className="flex justify-center py-20 text-gray-400">...</div>
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-1">
        {t(lang, 'past')}
      </h2>
      {matchs.length === 0 && (
        <p className="text-center text-gray-400 dark:text-gray-600 py-10 text-sm">—</p>
      )}
      {matchs.map(match => (
        <MatchCardPasse key={match.id} match={match} lang={lang} />
      ))}
    </div>
  )
}
