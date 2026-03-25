import { useEffect, useState } from 'react'
import { getUser } from '../api'
import { t } from '../i18n'

// URL DiceBear — style "bottts" lié au avatar_seed permanent
function avatarUrl(seed) {
  return `https://api.dicebear.com/9.x/bottts/svg?seed=${encodeURIComponent(seed)}`
}

export default function Profil({ userId, lang }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getUser(userId).then(data => {
      setUser(data)
      setLoading(false)
    })
  }, [userId])

  if (loading) {
    return <div className="flex justify-center py-20 text-gray-400">...</div>
  }

  const stats = user.stats ?? { scores_exacts: 0, bonnes_issues: 0, rates: 0, score_total: 0 }

  return (
    <div className="flex flex-col items-center pt-6 gap-5">
      {/* Avatar */}
      <img
        src={avatarUrl(user.avatar_seed)}
        alt={user.pseudo}
        className="w-28 h-28 rounded-full bg-gray-100 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700"
      />

      {/* Pseudo + score total */}
      <div className="text-center">
        <p className="text-xl font-bold text-gray-900 dark:text-white">@{user.pseudo}</p>
        <p className="text-3xl font-bold text-blue-500 mt-1">{stats.score_total} pts</p>
      </div>

      {/* Bloc résumé */}
      <div className="w-full bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">
          {t(lang, 'summary')}
        </p>
        <ul className="flex flex-col gap-2">
          <li className="flex justify-between text-sm">
            <span className="text-gray-700 dark:text-gray-300">{t(lang, 'exactScores')}</span>
            <span className="font-bold text-green-500">{stats.scores_exacts}</span>
          </li>
          <li className="flex justify-between text-sm">
            <span className="text-gray-700 dark:text-gray-300">{t(lang, 'goodOutcomes')}</span>
            <span className="font-bold text-blue-500">{stats.bonnes_issues}</span>
          </li>
          <li className="flex justify-between text-sm">
            <span className="text-gray-700 dark:text-gray-300">{t(lang, 'missed')}</span>
            <span className="font-bold text-red-500">{stats.rates}</span>
          </li>
        </ul>
      </div>

      {/* Bouton partager — html2canvas à implémenter */}
      <button className="w-full py-3 rounded-xl border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
        {t(lang, 'share')}
      </button>
    </div>
  )
}
