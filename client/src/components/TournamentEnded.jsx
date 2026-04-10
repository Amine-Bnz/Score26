import { useEffect, useState } from 'react'
import { getGlobalRanking } from '../api'
import AvatarInitials from './AvatarInitials'
import { t } from '../i18n'

const PODIUM_STYLES = [
  { ring: 'ring-yellow-400', bg: 'bg-yellow-400/15', label: 'text-yellow-400', medal: '🥇', h: 'h-28' },
  { ring: 'ring-surface-300', bg: 'bg-surface-300/10', label: 'text-surface-300', medal: '🥈', h: 'h-22' },
  { ring: 'ring-amber-600', bg: 'bg-amber-600/10', label: 'text-amber-600', medal: '🥉', h: 'h-18' },
]

export default function TournamentEnded({ userId, lang }) {
  const [top3, setTop3] = useState(null)
  const [myRank, setMyRank] = useState(null)
  const [totalPlayers, setTotalPlayers] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getGlobalRanking(1, 3).then(data => {
      if (data.ranking) {
        setTop3(data.ranking)
        setTotalPlayers(data.total || 0)
        // Find current user rank
        const me = data.ranking.find(r => r.id === userId)
        if (me) {
          setMyRank(data.ranking.indexOf(me) + 1)
        } else {
          // User not in top 3, fetch more to find rank
          getGlobalRanking(1, 100).then(full => {
            if (full.ranking) {
              const idx = full.ranking.findIndex(r => r.id === userId)
              if (idx !== -1) setMyRank(idx + 1)
            }
          }).catch(() => {})
        }
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [userId])

  async function handleShare() {
    const text = lang === 'fr'
      ? `Coupe du Monde 2026 terminée ! J'ai fini ${myRank ? `#${myRank}` : ''} sur Score26 ⚽🏆`
      : `World Cup 2026 is over! I finished ${myRank ? `#${myRank}` : ''} on Score26 ⚽🏆`
    if (navigator.share) {
      navigator.share({ title: 'Score26', text, url: window.location.origin }).catch(() => {})
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(text)
    }
  }

  if (loading) return null

  // Reorder for podium: [2nd, 1st, 3rd]
  const podiumOrder = top3 && top3.length >= 3 ? [top3[1], top3[0], top3[2]] : top3
  const styleOrder = [PODIUM_STYLES[1], PODIUM_STYLES[0], PODIUM_STYLES[2]]

  return (
    <div className="flex flex-col items-center gap-6 py-6 animate-fade-in">
      {/* Trophy header */}
      <div className="text-center">
        <div className="text-5xl mb-2 animate-bounce" style={{ animationDuration: '2s' }}>🏆</div>
        <h2 className="font-display text-xl font-bold text-surface-800 dark:text-white">
          {lang === 'fr' ? 'Tournoi terminé !' : 'Tournament Over!'}
        </h2>
        <p className="text-sm text-surface-400 mt-1">
          {lang === 'fr' ? 'Coupe du Monde 2026' : '2026 FIFA World Cup'}
        </p>
      </div>

      {/* Podium */}
      {podiumOrder && podiumOrder.length >= 3 && (
        <div className="flex items-end justify-center gap-3 w-full max-w-xs">
          {podiumOrder.map((player, i) => {
            const s = styleOrder[i]
            return (
              <div key={player.id} className="flex flex-col items-center gap-1.5 flex-1">
                <span className="text-2xl">{s.medal}</span>
                <div className={`ring-2 ${s.ring} rounded-full p-0.5`}>
                  <AvatarInitials pseudo={player.pseudo} seed={player.avatar_seed} size={i === 1 ? 52 : 40} />
                </div>
                <span className="text-[11px] font-bold text-surface-700 dark:text-surface-200 truncate max-w-full">
                  {player.pseudo}
                </span>
                <div className={`w-full ${s.bg} rounded-t-lg flex items-end justify-center pb-2 ${s.h}`}>
                  <span className={`text-sm font-bold tabular-nums ${s.label}`}>
                    {player.score_total}
                    <span className="text-[9px] font-normal ml-0.5">pts</span>
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* My rank */}
      {myRank && (
        <div className="text-center px-4 py-3 rounded-xl bg-accent/10 border border-accent/20 w-full max-w-xs">
          <p className="text-xs text-surface-400 mb-1">
            {lang === 'fr' ? 'Ton classement final' : 'Your final rank'}
          </p>
          <p className="font-display text-2xl font-bold text-accent">
            #{myRank}
            <span className="text-sm font-normal text-surface-400 ml-2">
              {t(lang, 'rankLabel')} {totalPlayers} {t(lang, 'rankPlayers')}
            </span>
          </p>
        </div>
      )}

      {/* Global stats */}
      {top3 && top3.length > 0 && (
        <div className="flex gap-4 text-center">
          <div>
            <p className="font-display text-lg font-bold text-surface-700 dark:text-surface-200">{totalPlayers}</p>
            <p className="text-[10px] text-surface-400">{t(lang, 'rankPlayers')}</p>
          </div>
          <div>
            <p className="font-display text-lg font-bold text-result-exact">{top3[0]?.score_total ?? 0}</p>
            <p className="text-[10px] text-surface-400">{lang === 'fr' ? 'Meilleur score' : 'Top score'}</p>
          </div>
          <div>
            <p className="font-display text-lg font-bold text-accent">{top3[0]?.scores_exacts ?? 0}</p>
            <p className="text-[10px] text-surface-400">{lang === 'fr' ? 'Exacts #1' : '#1 Exacts'}</p>
          </div>
        </div>
      )}

      {/* Share button */}
      <button
        onClick={handleShare}
        className="px-6 py-2.5 rounded-xl bg-accent text-surface-950 text-sm font-bold active:scale-95 transition-transform"
      >
        {lang === 'fr' ? 'Partager mon résultat' : 'Share my result'}
      </button>
    </div>
  )
}
