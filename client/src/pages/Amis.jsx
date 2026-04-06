import { useEffect, useState, useRef } from 'react'
import { getFriendRanking, addFriend, removeFriend, getGlobalRanking, getFriendHistory, getMyGroups, getGroupRanking, createGroup, joinGroup, leaveGroup, getMatchdayRanking, getMatchdayList } from '../api'
import { t } from '../i18n'
import AvatarInitials from '../components/AvatarInitials'

export default function Amis({ userId, lang, friendCode, deepLink, onDeepLinkHandled }) {
  const [tab, setTab] = useState(() => {
    if (deepLink?.type === 'group') return 'groupes'
    return 'amis'
  })

  return (
    <div className="flex flex-col gap-4 pt-2">
      {/* Toggle tabs */}
      <div className="flex bg-surface-100 dark:bg-surface-800 rounded-xl p-1 gap-1">
        {['amis', 'groupes', 'global'].map(key => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all
              ${tab === key
                ? 'bg-white dark:bg-surface-700 text-surface-900 dark:text-white shadow-sm'
                : 'text-surface-400 dark:text-surface-500'}`}
          >
            {t(lang, key === 'amis' ? 'friendRankingTab' : key === 'groupes' ? 'groupsTab' : 'globalRankingTab')}
          </button>
        ))}
      </div>

      {tab === 'amis' && <AmisTab userId={userId} lang={lang} friendCode={friendCode} deepLink={deepLink?.type === 'invite' ? deepLink : null} onDeepLinkHandled={onDeepLinkHandled} />}
      {tab === 'groupes' && <GroupesTab userId={userId} lang={lang} deepLink={deepLink?.type === 'group' ? deepLink : null} onDeepLinkHandled={onDeepLinkHandled} />}
      {tab === 'global' && <GlobalTab userId={userId} lang={lang} />}
    </div>
  )
}

// ── Toast réutilisable ────────────────────────────────────────────────────────
function Toast({ toast }) {
  if (!toast) return null
  return (
    <div className={`fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl text-sm font-medium shadow-lg animate-fade-in
      ${toast.isError ? 'bg-result-miss/90 text-white' : 'bg-result-exact/90 text-white'}`}>
      {toast.msg}
    </div>
  )
}

function useToast() {
  const [toast, setToast] = useState(null)
  const timerRef = useRef(null)
  function showToast(msg, isError = false) {
    clearTimeout(timerRef.current)
    setToast({ msg, isError })
    timerRef.current = setTimeout(() => setToast(null), 2500)
  }
  return { toast, showToast }
}

// ── Onglet Amis ───────────────────────────────────────────────────────────────
function AmisTab({ userId, lang, friendCode, deepLink, onDeepLinkHandled }) {
  const [code, setCode] = useState(deepLink?.code ?? '')
  const [ranking, setRanking] = useState([])
  const [loading, setLoading] = useState(true)
  const [historyFriend, setHistoryFriend] = useState(null) // { pseudo, avatar_seed, pronos }
  const [historyLoading, setHistoryLoading] = useState(false)
  const { toast, showToast } = useToast()

  useEffect(() => { loadRanking() }, [userId])

  // Auto-add from deep-link
  useEffect(() => {
    if (!deepLink?.code) return
    addFriend({ user_id: userId, friend_code: deepLink.code }).then(res => {
      if (!res.error) {
        showToast(t(lang, 'friendAdded'))
        loadRanking()
      } else {
        showToast(res.error, true)
      }
      setCode('')
      onDeepLinkHandled?.()
    })
  }, [])

  function loadRanking() {
    setLoading(true)
    getFriendRanking(userId)
      .then(data => { if (!data.error) setRanking(data) })
      .finally(() => setLoading(false))
  }

  async function handleAdd() {
    const trimmed = code.trim().toUpperCase()
    if (trimmed.length < 2) return
    const res = await addFriend({ user_id: userId, friend_code: trimmed })
    if (res.error) {
      showToast(res.error, true)
    } else {
      showToast(t(lang, 'friendAdded'))
      setCode('')
      loadRanking()
    }
  }

  async function handleRemove(friendId) {
    const res = await removeFriend({ user_id: userId, friendId })
    if (!res.error) {
      showToast(t(lang, 'friendRemoved'))
      loadRanking()
    }
  }

  async function openHistory(friendId) {
    setHistoryLoading(true)
    const data = await getFriendHistory(userId, friendId)
    if (!data.error) setHistoryFriend(data)
    setHistoryLoading(false)
  }

  if (loading) return <div className="flex justify-center py-20 text-surface-400">...</div>

  // Afficher l'historique d'un ami
  if (historyFriend) {
    return <FriendHistoryView data={historyFriend} lang={lang} onBack={() => setHistoryFriend(null)} />
  }

  return (
    <>
      <Toast toast={toast} />

      {/* Mon code ami */}
      {friendCode && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-accent/5 border border-accent/15">
          <span className="text-xs font-medium text-surface-500 dark:text-surface-400">{t(lang, 'myCode')}</span>
          <span className="font-display font-bold text-accent tracking-widest flex-1">{friendCode}</span>
          <button
            onClick={() => {
              navigator.clipboard?.writeText(friendCode)
              showToast(t(lang, 'codeCopied'))
            }}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-accent text-surface-950 active:scale-95 transition-transform"
          >
            {lang === 'fr' ? 'Copier' : 'Copy'}
          </button>
          <button
            onClick={() => {
              const url = `${window.location.origin}/invite/${friendCode}`
              if (navigator.share) {
                navigator.share({ title: 'Score26', text: lang === 'fr' ? 'Ajoute-moi sur Score26 !' : 'Add me on Score26!', url })
              } else {
                navigator.clipboard?.writeText(url)
                showToast(t(lang, 'linkCopied'))
              }
            }}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-surface-200 dark:bg-surface-700 text-surface-600 dark:text-surface-300 active:scale-95 transition-transform"
          >
            {t(lang, 'shareInviteLink')}
          </button>
        </div>
      )}

      {/* Saisie code ami */}
      <div className="flex gap-2">
        <input
          type="text"
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
          placeholder={t(lang, 'enterFriendCode')}
          maxLength={6}
          className="flex-1 px-4 py-2.5 rounded-xl bg-surface-100 dark:bg-surface-800 text-surface-900 dark:text-white text-sm font-mono tracking-widest text-center placeholder:text-surface-400 dark:placeholder:text-surface-500 placeholder:tracking-normal placeholder:font-sans focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
        <button
          onClick={handleAdd}
          disabled={code.length < 2}
          className="px-4 py-2.5 rounded-xl bg-accent text-surface-950 font-semibold text-sm active:scale-95 transition-transform disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {t(lang, 'addFriend')}
        </button>
      </div>

      {/* Classement amis */}
      <h2 className="font-display text-base font-bold text-surface-800 dark:text-surface-200">
        {t(lang, 'friendRanking')}
      </h2>

      {ranking.length <= 1 && (
        <p className="text-center text-surface-400 dark:text-surface-600 py-10 text-sm">
          {t(lang, 'noFriends')}
        </p>
      )}

      {ranking.length > 1 && (
        <RankingList ranking={ranking} userId={userId} lang={lang} onRemove={handleRemove} onHistory={openHistory} />
      )}
    </>
  )
}

// ── Onglet Global ─────────────────────────────────────────────────────────────
function GlobalTab({ userId, lang }) {
  const [ranking, setRanking] = useState([])
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState('global') // 'global' | 'matchday'
  const [journees, setJournees] = useState([])
  const [selectedJournee, setSelectedJournee] = useState(null)
  const [matchdayData, setMatchdayData] = useState(null)

  useEffect(() => {
    getGlobalRanking()
      .then(data => { if (!data.error) setRanking(data) })
      .finally(() => setLoading(false))
    getMatchdayList().then(data => { if (Array.isArray(data)) setJournees(data) })
  }, [])

  useEffect(() => {
    if (mode !== 'matchday') return
    setLoading(true)
    getMatchdayRanking(selectedJournee)
      .then(data => {
        if (!data.error) {
          setMatchdayData(data)
          if (!selectedJournee && data.journee) setSelectedJournee(data.journee)
        }
      })
      .finally(() => setLoading(false))
  }, [mode, selectedJournee])

  if (loading) return <div className="flex justify-center py-20 text-surface-400">...</div>

  const displayRanking = mode === 'global' ? ranking : (matchdayData?.ranking ?? [])

  return (
    <>
      {/* Toggle Global / Journée */}
      <div className="flex bg-surface-100 dark:bg-surface-800 rounded-lg p-0.5 gap-0.5">
        <button
          onClick={() => setMode('global')}
          className={`flex-1 py-1.5 rounded-md text-[11px] font-semibold transition-all
            ${mode === 'global' ? 'bg-white dark:bg-surface-700 text-surface-900 dark:text-white shadow-sm' : 'text-surface-400'}`}
        >
          {t(lang, 'globalRanking')}
        </button>
        <button
          onClick={() => setMode('matchday')}
          className={`flex-1 py-1.5 rounded-md text-[11px] font-semibold transition-all
            ${mode === 'matchday' ? 'bg-white dark:bg-surface-700 text-surface-900 dark:text-white shadow-sm' : 'text-surface-400'}`}
        >
          {t(lang, 'matchday')}
        </button>
      </div>

      {/* Sélecteur de journée */}
      {mode === 'matchday' && journees.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {journees.map(j => (
            <button
              key={j}
              onClick={() => setSelectedJournee(j)}
              className={`flex-shrink-0 text-[10px] font-semibold px-2.5 py-1 rounded-lg transition-colors
                ${selectedJournee === j
                  ? 'bg-accent text-surface-950'
                  : 'bg-surface-200 dark:bg-surface-700 text-surface-500 dark:text-surface-400'}`}
            >
              J{j}
            </button>
          ))}
        </div>
      )}

      {displayRanking.length === 0 ? (
        <p className="text-center text-surface-400 dark:text-surface-600 py-10 text-sm">—</p>
      ) : (
        <RankingList ranking={displayRanking} userId={userId} lang={lang} />
      )}
    </>
  )
}

// ── Onglet Groupes ────────────────────────────────────────────────────────────
function GroupesTab({ userId, lang, deepLink, onDeepLinkHandled }) {
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedGroup, setSelectedGroup] = useState(null) // { id, name, invite_code }
  const [groupRanking, setGroupRanking] = useState([])
  const [groupLoading, setGroupLoading] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [showJoin, setShowJoin] = useState(false)
  const [newName, setNewName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const { toast, showToast } = useToast()

  useEffect(() => { loadGroups() }, [userId])

  // Auto-join from deep-link
  useEffect(() => {
    if (!deepLink?.code) return
    joinGroup({ user_id: userId, invite_code: deepLink.code }).then(res => {
      if (!res.error) {
        showToast(t(lang, 'groupJoined'))
        loadGroups()
      } else {
        showToast(res.error, true)
      }
      onDeepLinkHandled?.()
    })
  }, [])

  function loadGroups() {
    setLoading(true)
    getMyGroups(userId)
      .then(data => { if (!data.error) setGroups(data) })
      .finally(() => setLoading(false))
  }

  async function openGroupRanking(group) {
    setSelectedGroup(group)
    setGroupLoading(true)
    const data = await getGroupRanking(group.id)
    if (!data.error) setGroupRanking(data)
    setGroupLoading(false)
  }

  async function handleCreate() {
    if (!newName.trim()) return
    const res = await createGroup({ user_id: userId, name: newName.trim() })
    if (res.error) {
      showToast(res.error, true)
    } else {
      showToast(t(lang, 'groupCreated'))
      setNewName('')
      setShowCreate(false)
      loadGroups()
    }
  }

  async function handleJoin() {
    if (!joinCode.trim()) return
    const res = await joinGroup({ user_id: userId, invite_code: joinCode.trim() })
    if (res.error) {
      showToast(res.error, true)
    } else {
      showToast(t(lang, 'groupJoined'))
      setJoinCode('')
      setShowJoin(false)
      loadGroups()
    }
  }

  async function handleLeave(groupId) {
    const res = await leaveGroup({ user_id: userId, groupId })
    if (!res.error) {
      showToast(t(lang, 'groupLeft'))
      setSelectedGroup(null)
      loadGroups()
    }
  }

  if (loading) return <div className="flex justify-center py-20 text-surface-400">...</div>

  // Vue classement d'un groupe
  if (selectedGroup) {
    return (
      <>
        <Toast toast={toast} />
        <button onClick={() => setSelectedGroup(null)} className="text-xs text-accent font-semibold mb-1">
          &larr; {t(lang, 'back')}
        </button>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-bold text-surface-800 dark:text-surface-200">
            {selectedGroup.name}
          </h2>
          <button
            onClick={() => handleLeave(selectedGroup.id)}
            className="text-xs text-result-miss font-medium px-2 py-1 rounded-lg hover:bg-result-miss/10 transition-colors"
          >
            {t(lang, 'leaveGroup')}
          </button>
        </div>

        {/* Code d'invitation */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-100 dark:bg-surface-800">
          <span className="text-xs text-surface-400">{t(lang, 'inviteCode')}</span>
          <span className="font-mono font-bold tracking-widest text-accent flex-1">{selectedGroup.invite_code}</span>
          <button
            onClick={() => { navigator.clipboard?.writeText(selectedGroup.invite_code); showToast(t(lang, 'codeCopied')) }}
            className="text-xs font-semibold px-2 py-1 rounded-lg bg-accent text-surface-950 active:scale-95 transition-transform"
          >
            {lang === 'fr' ? 'Copier' : 'Copy'}
          </button>
        </div>

        {groupLoading ? (
          <div className="flex justify-center py-10 text-surface-400">...</div>
        ) : (
          <RankingList ranking={groupRanking} userId={userId} lang={lang} />
        )}
      </>
    )
  }

  return (
    <>
      <Toast toast={toast} />

      {/* Boutons Créer / Rejoindre */}
      <div className="flex gap-2">
        <button
          onClick={() => { setShowCreate(!showCreate); setShowJoin(false) }}
          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-[0.98]
            ${showCreate ? 'bg-accent text-surface-950' : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-300'}`}
        >
          + {t(lang, 'createGroup')}
        </button>
        <button
          onClick={() => { setShowJoin(!showJoin); setShowCreate(false) }}
          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-[0.98]
            ${showJoin ? 'bg-accent text-surface-950' : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-300'}`}
        >
          {t(lang, 'joinGroup')}
        </button>
      </div>

      {/* Formulaire création */}
      {showCreate && (
        <div className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value.slice(0, 30))}
            placeholder={t(lang, 'groupName')}
            className="flex-1 px-4 py-2.5 rounded-xl bg-surface-100 dark:bg-surface-800 text-surface-900 dark:text-white text-sm placeholder:text-surface-400 dark:placeholder:text-surface-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
          <button
            onClick={handleCreate}
            disabled={!newName.trim()}
            className="px-4 py-2.5 rounded-xl bg-accent text-surface-950 font-semibold text-sm active:scale-95 transition-transform disabled:opacity-40"
          >
            OK
          </button>
        </div>
      )}

      {/* Formulaire rejoindre */}
      {showJoin && (
        <div className="flex gap-2">
          <input
            type="text"
            value={joinCode}
            onChange={e => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
            placeholder={t(lang, 'groupCode')}
            maxLength={6}
            className="flex-1 px-4 py-2.5 rounded-xl bg-surface-100 dark:bg-surface-800 text-surface-900 dark:text-white text-sm font-mono tracking-widest text-center placeholder:text-surface-400 dark:placeholder:text-surface-500 placeholder:tracking-normal placeholder:font-sans focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
          <button
            onClick={handleJoin}
            disabled={joinCode.length < 3}
            className="px-4 py-2.5 rounded-xl bg-accent text-surface-950 font-semibold text-sm active:scale-95 transition-transform disabled:opacity-40"
          >
            OK
          </button>
        </div>
      )}

      {/* Liste des groupes */}
      {groups.length === 0 ? (
        <p className="text-center text-surface-400 dark:text-surface-600 py-10 text-sm">
          {t(lang, 'noGroups')}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {groups.map(g => (
            <button
              key={g.id}
              onClick={() => openGroupRanking(g)}
              className="flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-100 dark:bg-surface-800/60 active:scale-[0.98] transition-transform text-left"
            >
              <span className="text-lg">👥</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-surface-900 dark:text-white truncate">{g.name}</p>
                <p className="text-[10px] text-surface-400">{g.member_count} {t(lang, 'members')}</p>
              </div>
              <svg viewBox="0 0 24 24" className="w-4 h-4 text-surface-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          ))}
        </div>
      )}
    </>
  )
}

// ── Composant Ranking partagé ─────────────────────────────────────────────────
function RankingList({ ranking, userId, lang, onRemove, onHistory }) {
  return (
    <div className="flex flex-col gap-2">
      {ranking.map((user, i) => {
        const isMe = user.id === userId
        const rank = i + 1
        return (
          <div
            key={user.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors
              ${isMe ? 'bg-accent/10 ring-1 ring-accent/20' : 'bg-surface-100 dark:bg-surface-800/60'}`}
          >
            {/* Rang */}
            <span className={`w-7 text-center font-display font-bold text-sm tabular-nums
              ${rank === 1 ? 'text-accent' : 'text-surface-400 dark:text-surface-500'}`}>
              {rank <= 3 ? ['🥇','🥈','🥉'][rank - 1] : `#${rank}`}
            </span>

            {/* Avatar + pseudo */}
            <AvatarInitials pseudo={user.pseudo} size={36} />
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold truncate ${isMe ? 'text-accent' : 'text-surface-900 dark:text-white'}`}>
                {user.pseudo} {isMe && <span className="text-xs font-normal text-surface-400">({t(lang, 'you')})</span>}
              </p>
              <p className="text-[10px] text-surface-400 dark:text-surface-500">
                {user.scores_exacts} {t(lang, 'exactScores')} · {user.bonnes_issues} {t(lang, 'goodOutcomes')}
              </p>
            </div>

            {/* Score */}
            <span className="font-display font-bold text-sm tabular-nums text-accent">
              {user.score_total}<span className="text-[10px] font-normal text-surface-400 ml-0.5">pt</span>
            </span>

            {/* Actions (amis seulement) */}
            {!isMe && onHistory && (
              <button
                onClick={() => onHistory(user.id)}
                className="text-surface-400 hover:text-accent transition-colors p-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
                aria-label={t(lang, 'friendHistory')}
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </button>
            )}
            {!isMe && onRemove && (
              <button
                onClick={() => onRemove(user.id)}
                className="text-surface-400 hover:text-result-miss transition-colors p-1 -mr-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
                aria-label={t(lang, 'removeFriend')}
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Vue historique des pronos d'un ami ─────────────────────────────────────────
function FriendHistoryView({ data, lang, onBack }) {
  const { pseudo, avatar_seed, pronos } = data

  return (
    <div className="flex flex-col gap-4">
      <button onClick={onBack} className="text-xs text-accent font-semibold">
        &larr; {t(lang, 'back')}
      </button>

      <div className="flex items-center gap-3">
        <AvatarInitials pseudo={pseudo} size={48} />
        <div>
          <p className="font-display font-bold text-surface-900 dark:text-white">{pseudo}</p>
          <p className="text-xs text-surface-400">{pronos.length} {t(lang, 'pronosPlaced')}</p>
        </div>
      </div>

      {pronos.length === 0 ? (
        <p className="text-center text-surface-400 py-10 text-sm">{t(lang, 'noHistory')}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {pronos.map((p, i) => {
            const isExact = p.score_predit_a === p.score_reel_a && p.score_predit_b === p.score_reel_b
            const goodOutcome = !isExact && Math.sign(p.score_predit_a - p.score_predit_b) === Math.sign(p.score_reel_a - p.score_reel_b)
            const borderColor = isExact ? 'border-l-result-exact' : goodOutcome ? 'border-l-accent' : 'border-l-result-miss'
            const pointsColor = isExact ? 'text-result-exact' : goodOutcome ? 'text-accent' : 'text-result-miss'

            return (
              <div key={i} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl bg-surface-100 dark:bg-surface-800/60 border-l-[3px] ${borderColor}`}>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-surface-700 dark:text-surface-200 truncate">
                    {p.equipe_a} vs {p.equipe_b}
                  </p>
                  <p className="text-[10px] text-surface-400">
                    {lang === 'fr' ? 'Réel' : 'Final'} {p.score_reel_a}-{p.score_reel_b} · {lang === 'fr' ? 'Prono' : 'Pred.'} {p.score_predit_a}-{p.score_predit_b}
                  </p>
                </div>
                <span className={`font-display font-bold text-sm tabular-nums ${pointsColor}`}>
                  +{p.points_obtenus}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
