import { useState, useRef } from 'react'
import { upsertProno } from '../api'
import { t } from '../i18n'

// Détermine la couleur de bordure d'une card passée selon le résultat
function getBorderClass(match) {
  if (!match.prono_id) return 'border-gray-300 dark:border-gray-700'
  const { score_predit_a: pA, score_predit_b: pB, score_reel_a: rA, score_reel_b: rB } = match
  if (pA === rA && pB === rB) return 'border-green-500'
  if (Math.sign(pA - pB) === Math.sign(rA - rB)) return 'border-blue-500'
  return 'border-red-500'
}

// Formate la date d'un match
function formatDate(dateStr) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

// Card pour les matchs à venir — inputs éditables
export function MatchCardAvenir({ match, userId, lang }) {
  const [scoreA, setScoreA] = useState(match.score_predit_a ?? '')
  const [scoreB, setScoreB] = useState(match.score_predit_b ?? '')
  const debounceRef = useRef(null)

  const isVerrouille = match.verrouille === 1 || new Date() >= new Date(match.date_coup_envoi)

  function handleChange(val, setter, autre, isA) {
    const parsed = val === '' ? '' : Math.max(0, parseInt(val) || 0)
    setter(parsed)

    // Sauvegarde automatique après 600ms d'inactivité
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const a = isA ? parsed : autre
      const b = isA ? autre : parsed
      if (a === '' || b === '') return
      upsertProno({ user_id: userId, match_id: match.id, score_predit_a: a, score_predit_b: b })
    }, 600)
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 shadow-sm">
      {/* Date centré en haut */}
      <p className="text-center text-xs text-gray-400 dark:text-gray-500 mb-3">
        {formatDate(match.date_coup_envoi)}
        {isVerrouille && (
          <span className="ml-2 text-gray-400 dark:text-gray-600">🔒 {t(lang, 'locked')}</span>
        )}
      </p>

      {/* Ligne principale : équipe A | inputs | équipe B */}
      <div className="flex items-center justify-between gap-2">
        {/* Équipe A */}
        <div className="flex flex-col items-center flex-1 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-2xl mb-1">
            {match.equipe_a.split(' ')[0]}
          </div>
          <span className="text-xs text-center text-gray-700 dark:text-gray-300 font-medium truncate w-full text-center">
            {match.equipe_a.split(' ').slice(1).join(' ')}
          </span>
        </div>

        {/* Inputs score */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <input
            type="number"
            min="0"
            max="99"
            value={scoreA}
            disabled={isVerrouille}
            onChange={e => handleChange(e.target.value, setScoreA, scoreB, true)}
            className="w-11 h-11 rounded-full border-2 border-dashed border-gray-400 dark:border-gray-600 text-center bg-transparent text-lg font-bold focus:border-solid focus:border-blue-500 focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed dark:text-white"
          />
          <span className="text-gray-400 dark:text-gray-500 font-bold">—</span>
          <input
            type="number"
            min="0"
            max="99"
            value={scoreB}
            disabled={isVerrouille}
            onChange={e => handleChange(e.target.value, setScoreB, scoreA, false)}
            className="w-11 h-11 rounded-full border-2 border-dashed border-gray-400 dark:border-gray-600 text-center bg-transparent text-lg font-bold focus:border-solid focus:border-blue-500 focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed dark:text-white"
          />
        </div>

        {/* Équipe B */}
        <div className="flex flex-col items-center flex-1 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-2xl mb-1">
            {match.equipe_b.split(' ')[0]}
          </div>
          <span className="text-xs text-center text-gray-700 dark:text-gray-300 font-medium truncate w-full text-center">
            {match.equipe_b.split(' ').slice(1).join(' ')}
          </span>
        </div>
      </div>
    </div>
  )
}

// Card pour les matchs passés — score réel + prono grisé + bordure colorée
export function MatchCardPasse({ match, lang }) {
  const borderClass = getBorderClass(match)

  return (
    <div className={`bg-white dark:bg-gray-900 rounded-2xl border-2 ${borderClass} p-4 shadow-sm`}>
      {/* Ligne principale : équipe A | score réel | équipe B */}
      <div className="flex items-center justify-between gap-2">
        {/* Équipe A */}
        <div className="flex flex-col items-center flex-1 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-2xl mb-1">
            {match.equipe_a.split(' ')[0]}
          </div>
          <span className="text-xs text-center text-gray-700 dark:text-gray-300 font-medium truncate w-full text-center">
            {match.equipe_a.split(' ').slice(1).join(' ')}
          </span>
        </div>

        {/* Score réel en grand */}
        <div className="flex flex-col items-center flex-shrink-0 gap-1">
          <div className="flex items-center gap-2">
            <span className="text-3xl font-bold text-gray-900 dark:text-white">{match.score_reel_a}</span>
            <span className="text-gray-400 dark:text-gray-500 font-bold text-xl">—</span>
            <span className="text-3xl font-bold text-gray-900 dark:text-white">{match.score_reel_b}</span>
          </div>

          {/* Prono du user en dessous, grisé */}
          {match.prono_id ? (
            <div className="flex items-center gap-1.5 mt-1">
              <span className="w-7 h-7 rounded-md border border-gray-300 dark:border-gray-600 flex items-center justify-center text-sm font-semibold text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800">
                {match.score_predit_a}
              </span>
              <span className="text-gray-300 dark:text-gray-600 text-xs">—</span>
              <span className="w-7 h-7 rounded-md border border-gray-300 dark:border-gray-600 flex items-center justify-center text-sm font-semibold text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800">
                {match.score_predit_b}
              </span>
            </div>
          ) : (
            <span className="text-xs text-gray-400 dark:text-gray-600 mt-1">{t(lang, 'noProno')}</span>
          )}

          {match.points_obtenus != null && (
            <span className="text-xs text-gray-500 dark:text-gray-400">{match.points_obtenus} pts</span>
          )}
        </div>

        {/* Équipe B */}
        <div className="flex flex-col items-center flex-1 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-2xl mb-1">
            {match.equipe_b.split(' ')[0]}
          </div>
          <span className="text-xs text-center text-gray-700 dark:text-gray-300 font-medium truncate w-full text-center">
            {match.equipe_b.split(' ').slice(1).join(' ')}
          </span>
        </div>
      </div>
    </div>
  )
}
