import { t } from '../i18n'
import AvatarInitials from './AvatarInitials'

// Extrait le nom court d'une équipe : "🇫🇷 France" → "France"
function shortTeam(name) {
  if (!name) return ''
  const i = name.indexOf(' ')
  return i >= 0 ? name.slice(i + 1) : name
}

// Formate la date de coup d'envoi en court
function shortDate(iso, lang) {
  try {
    const d = new Date(iso.replace(' ', 'T') + 'Z')
    return d.toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  } catch { return '' }
}

// Badge de statut
function StatusBadge({ status, winnerId, userId, lang }) {
  if (status === 'pending') {
    return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gold/15 text-gold">{t(lang, 'pendingChallenge')}</span>
  }
  if (status === 'accepted') {
    return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-accent/15 text-accent">{t(lang, 'challengeAccepted')}</span>
  }
  if (status === 'resolved') {
    if (winnerId === null) return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-surface-300/20 text-surface-500">{t(lang, 'draw')}</span>
    if (winnerId === userId) return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-result-exact/15 text-result-exact">{t(lang, 'won')}</span>
    return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-result-miss/15 text-result-miss">{t(lang, 'lost')}</span>
  }
  if (status === 'declined') {
    return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-result-miss/15 text-result-miss">{t(lang, 'challengeDeclined')}</span>
  }
  return null
}

// Carte défi — 3 variantes selon status
// Props : challenge (objet), userId, lang, onAccept, onDecline, onCancel
export default function ChallengeCard({ challenge: c, userId, lang, onAccept, onDecline, onCancel }) {
  const isChallenger = c.challenger_id === userId
  const opponentPseudo = isChallenger ? c.opponent_pseudo : c.challenger_pseudo
  const isPendingReceived = c.status === 'pending' && !isChallenger
  const isPendingSent = c.status === 'pending' && isChallenger
  const isResolved = c.status === 'resolved'

  return (
    <div className={`flex flex-col gap-2 p-3 rounded-xl border transition-colors
      ${isPendingReceived ? 'bg-gold/5 border-gold/20' : 'bg-surface-100 dark:bg-surface-800/60 border-surface-200 dark:border-surface-800'}`}>

      {/* Ligne 1 : adversaire + statut */}
      <div className="flex items-center gap-2">
        <AvatarInitials pseudo={opponentPseudo} size={28} />
        <span className="text-sm font-semibold text-surface-900 dark:text-white flex-1 truncate">{opponentPseudo}</span>
        <StatusBadge status={c.status} winnerId={c.winner_id} userId={userId} lang={lang} />
      </div>

      {/* Ligne 2 : match info */}
      <div className="flex items-center gap-2 text-xs text-surface-500 dark:text-surface-400">
        <span className="truncate">{shortTeam(c.equipe_a)} — {shortTeam(c.equipe_b)}</span>
        <span className="ml-auto flex-shrink-0 text-[10px]">{shortDate(c.date_coup_envoi, lang)}</span>
      </div>

      {/* Ligne 3 : résultat détaillé (si resolved) */}
      {isResolved && c.score_reel_a != null && (
        <div className="flex items-center gap-1 text-xs mt-0.5">
          {/* Mon prono */}
          <div className={`flex-1 text-center py-1.5 rounded-lg ${c.winner_id === userId ? 'bg-result-exact/10' : c.winner_id === null ? 'bg-surface-200/50 dark:bg-surface-700/50' : 'bg-result-miss/10'}`}>
            <p className="text-[10px] text-surface-400 truncate px-1">{isChallenger ? c.challenger_pseudo : c.opponent_pseudo}</p>
            <p className="font-bold tabular-nums text-surface-900 dark:text-white">
              {isChallenger ? `${c.challenger_predit_a ?? '?'}-${c.challenger_predit_b ?? '?'}` : `${c.opponent_predit_a ?? '?'}-${c.opponent_predit_b ?? '?'}`}
            </p>
            <p className="text-[10px] font-semibold text-accent tabular-nums">+{isChallenger ? (c.challenger_points ?? 0) : (c.opponent_points ?? 0)}</p>
          </div>

          {/* Score réel */}
          <div className="flex flex-col items-center px-2">
            <p className="text-[10px] text-surface-400">{lang === 'fr' ? 'Réel' : 'Final'}</p>
            <p className="font-display font-bold text-sm text-surface-900 dark:text-white tabular-nums">{c.score_reel_a}-{c.score_reel_b}</p>
          </div>

          {/* Prono adversaire */}
          <div className={`flex-1 text-center py-1.5 rounded-lg ${c.winner_id !== null && c.winner_id !== userId ? 'bg-result-exact/10' : c.winner_id === null ? 'bg-surface-200/50 dark:bg-surface-700/50' : 'bg-result-miss/10'}`}>
            <p className="text-[10px] text-surface-400 truncate px-1">{isChallenger ? c.opponent_pseudo : c.challenger_pseudo}</p>
            <p className="font-bold tabular-nums text-surface-900 dark:text-white">
              {isChallenger ? `${c.opponent_predit_a ?? '?'}-${c.opponent_predit_b ?? '?'}` : `${c.challenger_predit_a ?? '?'}-${c.challenger_predit_b ?? '?'}`}
            </p>
            <p className="text-[10px] font-semibold text-accent tabular-nums">+{isChallenger ? (c.opponent_points ?? 0) : (c.challenger_points ?? 0)}</p>
          </div>
        </div>
      )}

      {/* Actions : accepter/refuser (si reçu en attente) */}
      {isPendingReceived && (
        <div className="flex gap-2 mt-0.5">
          <button
            onClick={() => onAccept?.(c.id)}
            className="flex-1 py-2 rounded-lg bg-accent text-surface-950 text-xs font-semibold active:scale-[0.97] transition-transform"
          >
            {t(lang, 'accept')}
          </button>
          <button
            onClick={() => onDecline?.(c.id)}
            className="flex-1 py-2 rounded-lg bg-surface-200 dark:bg-surface-700 text-surface-600 dark:text-surface-300 text-xs font-semibold active:scale-[0.97] transition-transform"
          >
            {t(lang, 'decline')}
          </button>
        </div>
      )}

      {/* Action : annuler (si envoyé en attente) */}
      {isPendingSent && (
        <button
          onClick={() => onCancel?.(c.id)}
          className="py-1.5 rounded-lg text-[11px] font-medium text-surface-400 hover:text-result-miss transition-colors"
        >
          {t(lang, 'cancel')}
        </button>
      )}
    </div>
  )
}
