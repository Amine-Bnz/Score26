import { useEffect, useState, useRef } from 'react'
import { getFriendRanking, addFriend, removeFriend, getGlobalRanking, getFriendHistory, compareFriend, getMyGroups, getGroupRanking, createGroup, joinGroup, leaveGroup, getMatchdayRanking, getMatchdayList, getMyChallenges, createChallenge, acceptChallenge, declineChallenge, cancelChallenge, getMatchs, previewFriend, previewGroup, getFriendRequests, getSentRequests, acceptFriendRequest, declineFriendRequest, cancelFriendRequest, getGroupMembers, kickGroupMember, regenerateGroupCode, blockUser } from '../api'
import { t } from '../i18n'
import AvatarInitials from '../components/AvatarInitials'
import ChallengeCard from '../components/ChallengeCard'
import { RankingRowSkeleton } from '../components/Skeleton'
import { QRCodeSVG } from 'qrcode.react'

export default function Amis({ userId, lang, friendCode, deepLink, onDeepLinkHandled }) {
  const [tab, setTab] = useState(() => {
    if (deepLink?.type === 'group') return 'groupes'
    return 'amis'
  })
  const [requestCount, setRequestCount] = useState(0)
  // Tabs visitées : ne monte un onglet qu'au premier clic, puis le garde monté (pas de re-fetch)
  const [visited, setVisited] = useState(() => {
    const init = new Set(['amis'])
    if (deepLink?.type === 'group') init.add('groupes')
    return init
  })
  function switchTab(key) {
    setTab(key)
    setVisited(prev => { const n = new Set(prev); n.add(key); return n })
  }

  return (
    <div className="flex flex-col gap-4 pt-2">
      {/* Toggle tabs */}
      <div className="flex bg-surface-100 dark:bg-surface-800 rounded-xl p-1 gap-1">
        {['amis', 'groupes', 'global'].map(key => (
          <button
            key={key}
            onClick={() => switchTab(key)}
            className={`relative flex-1 py-2 rounded-lg text-xs font-semibold transition-all
              ${tab === key
                ? 'bg-white dark:bg-surface-700 text-surface-900 dark:text-white shadow-sm'
                : 'text-surface-400 dark:text-surface-500'}`}
          >
            {t(lang, key === 'amis' ? 'friendRankingTab' : key === 'groupes' ? 'groupsTab' : 'globalRankingTab')}
            {key === 'amis' && requestCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-result-miss text-white text-[9px] font-bold flex items-center justify-center">
                {requestCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Monte au premier clic, reste monte ensuite (hidden quand pas actif) */}
      <div className={`flex flex-col gap-4 ${tab !== 'amis' ? 'hidden' : ''}`}>
        <AmisTab userId={userId} lang={lang} friendCode={friendCode} deepLink={deepLink?.type === 'invite' ? deepLink : null} onDeepLinkHandled={onDeepLinkHandled} onRequestCountChange={setRequestCount} />
      </div>
      {visited.has('groupes') && (
        <div className={`flex flex-col gap-4 ${tab !== 'groupes' ? 'hidden' : ''}`}>
          <GroupesTab userId={userId} lang={lang} deepLink={deepLink?.type === 'group' ? deepLink : null} onDeepLinkHandled={onDeepLinkHandled} />
        </div>
      )}
      {visited.has('global') && (
        <div className={`flex flex-col gap-4 ${tab !== 'global' ? 'hidden' : ''}`}>
          <GlobalTab userId={userId} lang={lang} />
        </div>
      )}
    </div>
  )
}

// ── Toast réutilisable ────────────────────────────────────────────────────────
function Toast({ toast }) {
  return (
    <div aria-live="polite" aria-atomic="true">
      {toast && (
        <div className={`fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl text-sm font-medium shadow-lg animate-fade-in
          ${toast.isError ? 'bg-result-miss/90 text-white' : 'bg-result-exact/90 text-white'}`}>
          {toast.msg}
        </div>
      )}
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

// ── Modale de confirmation ──────────────────────────────────────────────────
function ConfirmModal({ title, children, lang, onConfirm, onCancel, loading }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onCancel}>
      <div className="bg-white dark:bg-surface-800 rounded-2xl shadow-xl p-6 mx-4 max-w-sm w-full flex flex-col gap-4" onClick={e => e.stopPropagation()}>
        <h3 className="font-display font-bold text-base text-surface-900 dark:text-white text-center">{title}</h3>
        <div className="flex flex-col items-center gap-2">{children}</div>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-300 text-sm font-semibold active:scale-[0.98] transition-transform"
          >
            {t(lang, 'cancelBtn')}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-accent text-surface-950 text-sm font-semibold active:scale-[0.98] transition-transform disabled:opacity-50"
          >
            {loading ? <span className="spinner-btn" /> : t(lang, 'confirmBtn')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Onglet Amis ───────────────────────────────────────────────────────────────
function AmisTab({ userId, lang, friendCode, deepLink, onDeepLinkHandled, onRequestCountChange }) {
  const [code, setCode] = useState(deepLink?.code ?? '')
  const [ranking, setRanking] = useState([])
  const [loading, setLoading] = useState(true)
  const [historyFriend, setHistoryFriend] = useState(null) // { pseudo, avatar_seed, pronos }
  const [historyLoading, setHistoryLoading] = useState(false)
  const [compareData, setCompareData] = useState(null)
  const [compareLoading, setCompareLoading] = useState(false)
  const [challenges, setChallenges] = useState([])
  const [challengeFriend, setChallengeFriend] = useState(null) // { id, pseudo }
  const [deepLinkConfirm, setDeepLinkConfirm] = useState(null) // { code, pseudo, avatar_seed }
  const [deepLinkLoading, setDeepLinkLoading] = useState(false)
  const [friendRequests, setFriendRequests] = useState([])
  const [sentRequests, setSentRequests] = useState([])
  const [blockConfirm, setBlockConfirm] = useState(null) // { id, pseudo }
  const { toast, showToast } = useToast()

  useEffect(() => { loadRanking(); loadChallenges(); loadRequests() }, [userId])

  function loadChallenges() {
    getMyChallenges(userId).then(data => { if (Array.isArray(data)) setChallenges(data) })
  }

  function loadRequests() {
    getFriendRequests(userId).then(data => {
      if (Array.isArray(data)) {
        setFriendRequests(data)
        onRequestCountChange?.(data.length)
      }
    })
    getSentRequests(userId).then(data => {
      if (Array.isArray(data)) setSentRequests(data)
    })
  }

  // Deep-link : afficher la modale de confirmation au lieu d'ajouter directement
  useEffect(() => {
    if (!deepLink?.code) return
    previewFriend(deepLink.code).then(res => {
      if (!res.error) {
        setDeepLinkConfirm({ code: deepLink.code, pseudo: res.pseudo, avatar_seed: res.avatar_seed })
      } else {
        showToast(res.error, true)
        onDeepLinkHandled?.()
      }
    })
  }, [])

  function confirmDeepLinkAdd() {
    if (!deepLinkConfirm) return
    setDeepLinkLoading(true)
    addFriend({ friend_code: deepLinkConfirm.code }).then(res => {
      if (!res.error) {
        if (res.status === 'accepted') {
          showToast(t(lang, 'mutualAccepted'))
          loadRanking()
        } else {
          showToast(t(lang, 'friendRequestSent'))
        }
        loadRequests()
      } else {
        showToast(res.error, true)
      }
      setCode('')
      setDeepLinkConfirm(null)
      setDeepLinkLoading(false)
      onDeepLinkHandled?.()
    })
  }

  function cancelDeepLinkAdd() {
    setDeepLinkConfirm(null)
    setCode('')
    onDeepLinkHandled?.()
  }

  function loadRanking() {
    setLoading(true)
    getFriendRanking(userId)
      .then(data => { if (!data.error) setRanking(data.ranking ?? data) })
      .finally(() => setLoading(false))
  }

  async function handleAdd() {
    const trimmed = code.trim().toUpperCase()
    if (trimmed.length < 2) return
    const res = await addFriend({ friend_code: trimmed })
    if (res.error) {
      showToast(res.error, true)
    } else if (res.status === 'accepted') {
      showToast(t(lang, 'mutualAccepted'))
      setCode('')
      loadRanking()
      loadRequests()
    } else {
      showToast(t(lang, 'friendRequestSent'))
      setCode('')
      loadRequests()
    }
  }

  async function handleRemove(friendId) {
    const res = await removeFriend({ friendId })
    if (!res.error) {
      showToast(t(lang, 'friendRemoved'))
      loadRanking()
    }
  }

  async function handleBlock(userId) {
    const res = await blockUser({ blockedId: userId })
    if (!res.error) {
      showToast(t(lang, 'userBlocked'))
      setBlockConfirm(null)
      loadRanking()
      loadRequests()
    } else {
      showToast(res.error, true)
    }
  }

  async function openHistory(friendId) {
    setHistoryLoading(true)
    const data = await getFriendHistory(userId, friendId)
    if (!data.error) setHistoryFriend(data)
    setHistoryLoading(false)
  }

  async function openCompare(friendId) {
    setCompareLoading(true)
    const data = await compareFriend(userId, friendId)
    if (!data.error) setCompareData(data)
    setCompareLoading(false)
  }

  if (loading) return <div className="flex flex-col gap-2">{[0,1,2,3,4].map(i => <RankingRowSkeleton key={i} />)}</div>

  // Afficher les défis avec un ami
  if (challengeFriend) {
    return (
      <ChallengesWithFriendView
        userId={userId}
        friend={challengeFriend}
        challenges={challenges}
        lang={lang}
        onBack={() => setChallengeFriend(null)}
        onRefresh={loadChallenges}
        showToast={showToast}
      />
    )
  }

  // Afficher la comparaison
  if (compareData) {
    return <CompareView data={compareData} lang={lang} onBack={() => setCompareData(null)} />
  }

  // Afficher l'historique d'un ami
  if (historyFriend) {
    return <FriendHistoryView data={historyFriend} lang={lang} onBack={() => setHistoryFriend(null)} />
  }

  const pendingReceived = challenges.filter(c => c.status === 'pending' && c.opponent_id === userId)

  return (
    <>
      <Toast toast={toast} />

      {/* Modale de confirmation blocage */}
      {blockConfirm && (
        <ConfirmModal
          title={t(lang, 'blockConfirm')}
          lang={lang}
          onConfirm={() => handleBlock(blockConfirm.id)}
          onCancel={() => setBlockConfirm(null)}
        >
          <AvatarInitials pseudo={blockConfirm.pseudo} size={40} />
          <p className="text-sm font-semibold text-surface-900 dark:text-white">{blockConfirm.pseudo}</p>
        </ConfirmModal>
      )}

      {/* Modale de confirmation deep link ami */}
      {deepLinkConfirm && (
        <ConfirmModal
          title={t(lang, 'confirmAddFriend')}
          lang={lang}
          onConfirm={confirmDeepLinkAdd}
          onCancel={cancelDeepLinkAdd}
          loading={deepLinkLoading}
        >
          <AvatarInitials pseudo={deepLinkConfirm.pseudo} size={48} />
          <p className="text-sm font-semibold text-surface-900 dark:text-white">{deepLinkConfirm.pseudo}</p>
        </ConfirmModal>
      )}

      {/* Demandes d'amitié reçues */}
      {friendRequests.length > 0 && (
        <FriendRequestsBanner
          requests={friendRequests}
          lang={lang}
          onAccept={async id => {
            const res = await acceptFriendRequest(id)
            if (!res.error) { showToast(t(lang, 'friendRequestAccepted')); loadRanking(); loadRequests() }
            else showToast(res.error, true)
          }}
          onDecline={async id => {
            const res = await declineFriendRequest(id)
            if (!res.error) { showToast(t(lang, 'friendRequestDeclined')); loadRequests() }
            else showToast(res.error, true)
          }}
        />
      )}

      {/* Demandes envoyées en attente */}
      {sentRequests.length > 0 && (
        <SentRequestsBanner
          requests={sentRequests}
          lang={lang}
          onCancel={async id => {
            const res = await cancelFriendRequest(id)
            if (!res.error) { showToast(t(lang, 'friendRequestCancelled')); loadRequests() }
            else showToast(res.error, true)
          }}
        />
      )}

      {/* Bannière défis reçus en attente */}
      {pendingReceived.length > 0 && (
        <PendingChallengesBanner
          challenges={pendingReceived}
          userId={userId}
          lang={lang}
          onAccept={async id => {
            const res = await acceptChallenge({ challengeId: id })
            if (!res.error) { showToast(t(lang, 'challengeAccepted')); loadChallenges() }
            else showToast(res.error, true)
          }}
          onDecline={async id => {
            const res = await declineChallenge({ challengeId: id })
            if (!res.error) { showToast(t(lang, 'challengeDeclined')); loadChallenges() }
            else showToast(res.error, true)
          }}
        />
      )}

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

      {/* Séparateur */}
      <div className="h-px bg-surface-200 dark:bg-surface-800" />

      {/* Saisie code ami */}
      <div className="flex gap-2">
        <input
          type="text"
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
          placeholder={t(lang, 'enterFriendCode')}
          aria-label={t(lang, 'enterFriendCode')}
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
        <RankingList ranking={ranking} userId={userId} lang={lang} onRemove={handleRemove} onHistory={openHistory} onCompare={openCompare} onChallenge={friend => setChallengeFriend(friend)} onBlock={friend => setBlockConfirm(friend)} />
      )}
    </>
  )
}

// ── Onglet Global ─────────────────────────────────────────────────────────────
function GlobalTab({ userId, lang }) {
  const [ranking, setRanking] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [page, setPage] = useState(1)
  const [mode, setMode] = useState('global') // 'global' | 'matchday'
  const [journees, setJournees] = useState([])
  const [selectedJournee, setSelectedJournee] = useState(null)
  const [matchdayData, setMatchdayData] = useState(null)

  useEffect(() => {
    getGlobalRanking(1)
      .then(data => {
        if (!data.error) {
          setRanking(data.ranking ?? data)
          setHasMore(data.hasMore ?? false)
          setPage(1)
        }
      })
      .finally(() => setLoading(false))
    getMatchdayList().then(data => { if (Array.isArray(data)) setJournees(data) })
  }, [])

  function loadMore() {
    const next = page + 1
    setLoadingMore(true)
    getGlobalRanking(next)
      .then(data => {
        if (!data.error) {
          setRanking(prev => [...prev, ...(data.ranking ?? [])])
          setHasMore(data.hasMore ?? false)
          setPage(next)
        }
      })
      .finally(() => setLoadingMore(false))
  }

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

  if (loading) return <div className="flex flex-col gap-2">{[0,1,2,3,4].map(i => <RankingRowSkeleton key={i} />)}</div>

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
        <>
          <RankingList ranking={displayRanking} userId={userId} lang={lang} />
          {mode === 'global' && hasMore && (
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="w-full py-2.5 rounded-xl bg-surface-100 dark:bg-surface-800 text-surface-500 dark:text-surface-400 text-xs font-semibold active:scale-[0.98] transition-all disabled:opacity-50 mt-2"
            >
              {loadingMore ? <span className="spinner-btn" /> : (lang === 'fr' ? 'Voir plus' : 'Load more')}
            </button>
          )}
        </>
      )}
    </>
  )
}

// ── Onglet Groupes ────────────────────────────────────────────────────────────
function GroupesTab({ userId, lang, deepLink, onDeepLinkHandled }) {
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedGroup, setSelectedGroup] = useState(null) // { id, name, invite_code, owner_id }
  const [groupRanking, setGroupRanking] = useState([])
  const [groupLoading, setGroupLoading] = useState(false)
  const [groupMembers, setGroupMembers] = useState([])
  const [showMembers, setShowMembers] = useState(false)
  const [kickConfirm, setKickConfirm] = useState(null) // { id, pseudo }
  const [regenConfirm, setRegenConfirm] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [showJoin, setShowJoin] = useState(false)
  const [newName, setNewName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [deepLinkConfirm, setDeepLinkConfirm] = useState(null) // { code, name, member_count }
  const [deepLinkLoading, setDeepLinkLoading] = useState(false)
  const { toast, showToast } = useToast()

  useEffect(() => { loadGroups() }, [userId])

  // Deep-link : afficher la modale de confirmation au lieu de rejoindre directement
  useEffect(() => {
    if (!deepLink?.code) return
    previewGroup(deepLink.code).then(res => {
      if (!res.error) {
        setDeepLinkConfirm({ code: deepLink.code, name: res.name, member_count: res.member_count })
      } else {
        showToast(res.error, true)
        onDeepLinkHandled?.()
      }
    })
  }, [])

  function confirmDeepLinkJoin() {
    if (!deepLinkConfirm) return
    setDeepLinkLoading(true)
    joinGroup({ invite_code: deepLinkConfirm.code }).then(res => {
      if (!res.error) {
        showToast(t(lang, 'groupJoined'))
        loadGroups()
      } else {
        showToast(res.error, true)
      }
      setDeepLinkConfirm(null)
      setDeepLinkLoading(false)
      onDeepLinkHandled?.()
    })
  }

  function cancelDeepLinkJoin() {
    setDeepLinkConfirm(null)
    onDeepLinkHandled?.()
  }

  function loadGroups() {
    setLoading(true)
    getMyGroups(userId)
      .then(data => { if (!data.error) setGroups(data) })
      .finally(() => setLoading(false))
  }

  async function openGroupRanking(group) {
    setSelectedGroup(group)
    setGroupLoading(true)
    setShowMembers(false)
    setKickConfirm(null)
    setRegenConfirm(false)
    const [rankData, membersData] = await Promise.all([
      getGroupRanking(group.id),
      getGroupMembers(group.id),
    ])
    if (!rankData.error) setGroupRanking(rankData)
    if (Array.isArray(membersData)) setGroupMembers(membersData)
    setGroupLoading(false)
  }

  async function handleCreate() {
    if (!newName.trim()) return
    const res = await createGroup({ name: newName.trim() })
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
    const res = await joinGroup({ invite_code: joinCode.trim() })
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
    const res = await leaveGroup({ groupId })
    if (!res.error) {
      showToast(t(lang, 'groupLeft'))
      setSelectedGroup(null)
      loadGroups()
    }
  }

  if (loading) return <div className="flex flex-col gap-2">{[0,1,2,3,4].map(i => <RankingRowSkeleton key={i} />)}</div>

  const isOwner = selectedGroup?.owner_id === userId

  async function handleKick(memberId) {
    const res = await kickGroupMember({ groupId: selectedGroup.id, userId: memberId })
    if (!res.error) {
      showToast(t(lang, 'memberKicked'))
      setKickConfirm(null)
      // Refresh members + ranking
      const [rankData, membersData] = await Promise.all([
        getGroupRanking(selectedGroup.id),
        getGroupMembers(selectedGroup.id),
      ])
      if (!rankData.error) setGroupRanking(rankData)
      if (Array.isArray(membersData)) setGroupMembers(membersData)
    } else {
      showToast(res.error, true)
    }
  }

  async function handleRegenCode() {
    const res = await regenerateGroupCode({ groupId: selectedGroup.id })
    if (!res.error) {
      showToast(t(lang, 'codeRegenerated'))
      setSelectedGroup(prev => ({ ...prev, invite_code: res.invite_code }))
      setRegenConfirm(false)
    } else {
      showToast(res.error, true)
    }
  }

  // Vue classement d'un groupe
  if (selectedGroup) {
    return (
      <>
        <Toast toast={toast} />

        {/* Modale confirmation kick */}
        {kickConfirm && (
          <ConfirmModal
            title={t(lang, 'kickConfirm')}
            lang={lang}
            onConfirm={() => handleKick(kickConfirm.id)}
            onCancel={() => setKickConfirm(null)}
          >
            <AvatarInitials pseudo={kickConfirm.pseudo} size={40} />
            <p className="text-sm font-semibold text-surface-900 dark:text-white">{kickConfirm.pseudo}</p>
          </ConfirmModal>
        )}

        {/* Modale confirmation régénération code */}
        {regenConfirm && (
          <ConfirmModal
            title={t(lang, 'regenerateConfirm')}
            lang={lang}
            onConfirm={handleRegenCode}
            onCancel={() => setRegenConfirm(false)}
          />
        )}

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

        {/* Code d'invitation + QR */}
        <div className="flex flex-col gap-2 px-3 py-2 rounded-lg bg-surface-100 dark:bg-surface-800">
          <div className="flex items-center gap-2">
            <span className="text-xs text-surface-400">{t(lang, 'inviteCode')}</span>
            <span className="font-mono font-bold tracking-widest text-accent flex-1">{selectedGroup.invite_code}</span>
            <button
              onClick={() => { navigator.clipboard?.writeText(selectedGroup.invite_code); showToast(t(lang, 'codeCopied')) }}
              className="text-xs font-semibold px-2 py-1 rounded-lg bg-accent text-surface-950 active:scale-95 transition-transform"
            >
              {lang === 'fr' ? 'Copier' : 'Copy'}
            </button>
            {isOwner && (
              <button
                onClick={() => setRegenConfirm(true)}
                className="text-xs font-semibold px-2 py-1 rounded-lg bg-surface-200 dark:bg-surface-700 text-surface-500 dark:text-surface-400 active:scale-95 transition-transform"
              >
                {t(lang, 'regenerateCode')}
              </button>
            )}
          </div>
          <div className="flex justify-center py-1">
            <div className="bg-white p-2 rounded-lg">
              <QRCodeSVG
                value={`${window.location.origin}/group/${selectedGroup.invite_code}`}
                size={100}
                level="M"
                bgColor="#ffffff"
                fgColor="#1a1a2e"
              />
            </div>
          </div>
          <p className="text-[10px] text-surface-400 text-center">
            {lang === 'fr' ? 'Scanne pour rejoindre' : 'Scan to join'}
          </p>
        </div>

        {/* Liste des membres */}
        <div className="rounded-xl bg-surface-100 dark:bg-surface-800/60 overflow-hidden">
          <button
            onClick={() => setShowMembers(!showMembers)}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-left"
          >
            <span className="text-sm font-semibold text-surface-700 dark:text-surface-300 flex-1">
              {t(lang, 'groupMembers')} ({groupMembers.length})
            </span>
            <svg viewBox="0 0 24 24" className={`w-4 h-4 text-surface-400 transition-transform ${showMembers ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {showMembers && (
            <div className="flex flex-col gap-1 px-3 pb-3">
              {groupMembers.map(m => (
                <div key={m.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white dark:bg-surface-900">
                  <AvatarInitials pseudo={m.pseudo} size={32} />
                  <p className="flex-1 text-sm text-surface-800 dark:text-surface-200 truncate">
                    {m.pseudo}
                    {m.is_owner === 1 && (
                      <span className="ml-1.5 text-[9px] font-bold text-accent bg-accent/10 px-1.5 py-0.5 rounded-full">
                        {t(lang, 'ownerBadge')}
                      </span>
                    )}
                    {m.id === userId && (
                      <span className="ml-1 text-[10px] text-surface-400">({t(lang, 'you')})</span>
                    )}
                  </p>
                  {isOwner && m.id !== userId && (
                    <button
                      onClick={() => setKickConfirm({ id: m.id, pseudo: m.pseudo })}
                      className="text-surface-400 hover:text-result-miss transition-colors p-1"
                      aria-label={t(lang, 'kickMember')}
                    >
                      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {groupLoading ? (
          <div className="flex flex-col gap-2">{[0,1,2,3].map(i => <RankingRowSkeleton key={i} />)}</div>
        ) : (
          <RankingList ranking={groupRanking} userId={userId} lang={lang} />
        )}
      </>
    )
  }

  return (
    <>
      <Toast toast={toast} />

      {/* Modale de confirmation deep link groupe */}
      {deepLinkConfirm && (
        <ConfirmModal
          title={t(lang, 'confirmJoinGroup')}
          lang={lang}
          onConfirm={confirmDeepLinkJoin}
          onCancel={cancelDeepLinkJoin}
          loading={deepLinkLoading}
        >
          <p className="text-sm font-semibold text-surface-900 dark:text-white">{deepLinkConfirm.name}</p>
          <p className="text-xs text-surface-400">{deepLinkConfirm.member_count} {t(lang, 'membersCount')}</p>
        </ConfirmModal>
      )}

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
            aria-label={t(lang, 'groupName')}
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
            aria-label={t(lang, 'groupCode')}
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
              <span className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-xs font-bold text-accent">{g.member_count}</span>
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
function RankingList({ ranking, userId, lang, onRemove, onHistory, onCompare, onChallenge, onBlock }) {
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
              ${rank <= 3 ? 'text-accent' : 'text-surface-400 dark:text-surface-500'}`}>
              #{rank}
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
            {!isMe && (onChallenge || onCompare || onHistory || onRemove || onBlock) && (
              <div className="flex items-center gap-1">
                {onChallenge && (
                  <button
                    onClick={() => onChallenge({ id: user.id, pseudo: user.pseudo })}
                    className="flex flex-col items-center gap-0.5 text-surface-400 hover:text-gold transition-colors p-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
                    aria-label={t(lang, 'challenge')}
                  >
                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                    </svg>
                    <span className="text-[9px] leading-none">{t(lang, 'challenge')}</span>
                  </button>
                )}
                {onCompare && (
                  <button
                    onClick={() => onCompare(user.id)}
                    className="flex flex-col items-center gap-0.5 text-surface-400 hover:text-accent transition-colors p-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
                    aria-label={t(lang, 'compare')}
                  >
                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <polyline points="18 8 22 12 18 16" />
                      <polyline points="6 8 2 12 6 16" />
                      <line x1="2" y1="12" x2="22" y2="12" />
                    </svg>
                    <span className="text-[9px] leading-none">{t(lang, 'compare')}</span>
                  </button>
                )}
                {onHistory && (
                  <button
                    onClick={() => onHistory(user.id)}
                    className="flex flex-col items-center gap-0.5 text-surface-400 hover:text-accent transition-colors p-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
                    aria-label={t(lang, 'friendHistory')}
                  >
                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    <span className="text-[9px] leading-none">{t(lang, 'friendHistory')}</span>
                  </button>
                )}
                {onRemove && (
                  <button
                    onClick={() => onRemove(user.id)}
                    className="flex flex-col items-center gap-0.5 text-surface-400 hover:text-result-miss transition-colors p-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
                    aria-label={t(lang, 'removeFriend')}
                  >
                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                    <span className="text-[9px] leading-none">{t(lang, 'removeFriend')}</span>
                  </button>
                )}
                {onBlock && (
                  <button
                    onClick={() => onBlock({ id: user.id, pseudo: user.pseudo })}
                    className="flex flex-col items-center gap-0.5 text-surface-400 hover:text-result-miss transition-colors p-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
                    aria-label={t(lang, 'blockUser')}
                  >
                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                    </svg>
                    <span className="text-[9px] leading-none">{t(lang, 'blockUser')}</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Vue comparaison face-à-face ──────────────────────────────────────────────
function CompareView({ data, lang, onBack }) {
  const { me, friend, summary, matches } = data

  return (
    <div className="flex flex-col gap-4">
      <button onClick={onBack} className="text-xs text-accent font-semibold">
        &larr; {t(lang, 'back')}
      </button>

      <h2 className="font-display text-base font-bold text-surface-800 dark:text-surface-200 text-center">
        {t(lang, 'compareTitle')}
      </h2>

      {/* Résumé */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-accent/10 rounded-xl py-3">
          <p className="font-display text-lg font-bold text-accent">{summary.myWins}</p>
          <p className="text-[10px] text-surface-400 truncate px-1">{me.pseudo}</p>
        </div>
        <div className="bg-surface-100 dark:bg-surface-800 rounded-xl py-3">
          <p className="font-display text-lg font-bold text-surface-500">{summary.ties}</p>
          <p className="text-[10px] text-surface-400">{t(lang, 'compareTies')}</p>
        </div>
        <div className="bg-result-miss/10 rounded-xl py-3">
          <p className="font-display text-lg font-bold text-result-miss">{summary.frWins}</p>
          <p className="text-[10px] text-surface-400 truncate px-1">{friend.pseudo}</p>
        </div>
      </div>

      {/* Score total */}
      <div className="flex items-center justify-between px-4 py-2 rounded-xl bg-surface-100 dark:bg-surface-800">
        <span className="font-display font-bold text-accent tabular-nums">{summary.myTotal} pt</span>
        <span className="text-[10px] text-surface-400">{t(lang, 'totalScore')}</span>
        <span className="font-display font-bold text-result-miss tabular-nums">{summary.frTotal} pt</span>
      </div>

      {/* Matchs */}
      {matches.length === 0 ? (
        <p className="text-center text-surface-400 py-10 text-sm">{t(lang, 'noHistory')}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {matches.map(m => {
            const myBetter = m.my_pts > m.fr_pts
            const frBetter = m.fr_pts > m.my_pts
            return (
              <div key={m.id} className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-surface-100 dark:bg-surface-800/60">
                {/* Mon prono */}
                <div className={`flex items-center gap-1 flex-1 justify-start ${myBetter ? 'text-accent' : 'text-surface-500'}`}>
                  <span className="text-xs font-bold tabular-nums">{m.my_a}-{m.my_b}</span>
                  <span className="text-[10px] font-semibold tabular-nums">+{m.my_pts}</span>
                </div>

                {/* Match info */}
                <div className="flex flex-col items-center flex-shrink-0 min-w-0">
                  <p className="text-[10px] text-surface-400 dark:text-surface-500 truncate max-w-[120px] text-center">
                    {m.equipe_a.split(' ').slice(1).join(' ')} - {m.equipe_b.split(' ').slice(1).join(' ')}
                  </p>
                  <p className="text-[10px] font-bold text-surface-600 dark:text-surface-300 tabular-nums">
                    {m.score_reel_a}-{m.score_reel_b}
                  </p>
                </div>

                {/* Son prono */}
                <div className={`flex items-center gap-1 flex-1 justify-end ${frBetter ? 'text-result-miss' : 'text-surface-500'}`}>
                  <span className="text-[10px] font-semibold tabular-nums">+{m.fr_pts}</span>
                  <span className="text-xs font-bold tabular-nums">{m.fr_a}-{m.fr_b}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Bannière demandes d'amitié reçues ───────────────────────────────────────
function FriendRequestsBanner({ requests, lang, onAccept, onDecline }) {
  const [expanded, setExpanded] = useState(true)

  return (
    <div className="rounded-xl bg-accent/5 border border-accent/20 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-left"
      >
        <span className="w-5 h-5 rounded-full bg-result-miss/20 flex items-center justify-center text-[10px] font-bold text-result-miss flex-shrink-0">
          {requests.length}
        </span>
        <span className="text-sm font-semibold text-surface-800 dark:text-surface-200 flex-1">
          {t(lang, 'friendRequests')} ({requests.length})
        </span>
        <svg viewBox="0 0 24 24" className={`w-4 h-4 text-surface-400 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {expanded && (
        <div className="flex flex-col gap-2 px-3 pb-3">
          {requests.map(r => (
            <div key={r.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white dark:bg-surface-800">
              <AvatarInitials pseudo={r.pseudo} size={36} />
              <p className="flex-1 text-sm font-semibold text-surface-900 dark:text-white truncate">{r.pseudo}</p>
              <button
                onClick={() => onAccept(r.id)}
                className="px-3 py-1.5 rounded-lg bg-result-exact text-white text-xs font-semibold active:scale-95 transition-transform"
              >
                {t(lang, 'accept')}
              </button>
              <button
                onClick={() => onDecline(r.id)}
                className="px-3 py-1.5 rounded-lg bg-result-miss/10 text-result-miss text-xs font-semibold active:scale-95 transition-transform"
              >
                {t(lang, 'decline')}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Bannière demandes envoyées en attente ──────────────────────────────────
function SentRequestsBanner({ requests, lang, onCancel }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-xl bg-surface-100 dark:bg-surface-800/60 border border-surface-200 dark:border-surface-700 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-left"
      >
        <span className="w-5 h-5 rounded-full bg-surface-300 dark:bg-surface-600 flex items-center justify-center text-[10px] font-bold text-surface-600 dark:text-surface-300 flex-shrink-0">
          {requests.length}
        </span>
        <span className="text-sm font-medium text-surface-500 dark:text-surface-400 flex-1">
          {t(lang, 'pendingSent')} ({requests.length})
        </span>
        <svg viewBox="0 0 24 24" className={`w-4 h-4 text-surface-400 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {expanded && (
        <div className="flex flex-col gap-2 px-3 pb-3">
          {requests.map(r => (
            <div key={r.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white dark:bg-surface-900">
              <AvatarInitials pseudo={r.pseudo} size={32} />
              <p className="flex-1 text-sm text-surface-600 dark:text-surface-300 truncate">{r.pseudo}</p>
              <button
                onClick={() => onCancel(r.id)}
                className="px-3 py-1.5 rounded-lg bg-surface-200 dark:bg-surface-700 text-surface-500 dark:text-surface-400 text-xs font-semibold active:scale-95 transition-transform"
              >
                {t(lang, 'cancelRequest')}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Bannière défis reçus en attente ─────────────────────────────────────────
function PendingChallengesBanner({ challenges, userId, lang, onAccept, onDecline }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-xl bg-gold/5 border border-gold/20 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-left"
      >
        <span className="w-5 h-5 rounded-full bg-gold/20 flex items-center justify-center text-[10px] font-bold text-gold flex-shrink-0">
          {challenges.length}
        </span>
        <span className="text-sm font-semibold text-gold flex-1">
          {challenges.length} {t(lang, 'pendingChallengesCount')}
        </span>
        <svg viewBox="0 0 24 24" className={`w-4 h-4 text-gold transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {expanded && (
        <div className="flex flex-col gap-2 px-3 pb-3">
          {challenges.map(c => (
            <ChallengeCard key={c.id} challenge={c} userId={userId} lang={lang} onAccept={onAccept} onDecline={onDecline} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Vue défis avec un ami ───────────────────────────────────────────────────
function ChallengesWithFriendView({ userId, friend, challenges, lang, onBack, onRefresh, showToast }) {
  const [showMatchPicker, setShowMatchPicker] = useState(false)
  const [upcomingMatchs, setUpcomingMatchs] = useState([])
  const [loadingMatchs, setLoadingMatchs] = useState(false)

  // Filtre les défis entre userId et friend.id
  const friendChallenges = challenges.filter(c =>
    (c.challenger_id === friend.id && c.opponent_id === userId) ||
    (c.challenger_id === userId && c.opponent_id === friend.id)
  )

  // Sépare en catégories
  const pending = friendChallenges.filter(c => c.status === 'pending' || c.status === 'accepted')
  const resolved = friendChallenges.filter(c => c.status === 'resolved')
  const declined = friendChallenges.filter(c => c.status === 'declined')

  async function openMatchPicker() {
    setLoadingMatchs(true)
    setShowMatchPicker(true)
    const data = await getMatchs(userId)
    if (Array.isArray(data)) {
      // Matchs à venir uniquement, sans défi actif entre nous deux
      const activeMatchIds = new Set(
        friendChallenges.filter(c => c.status === 'pending' || c.status === 'accepted').map(c => c.match_id)
      )
      setUpcomingMatchs(data.filter(m => m.statut === 'a_venir' && !activeMatchIds.has(m.id)))
    }
    setLoadingMatchs(false)
  }

  async function handleCreate(matchId) {
    const res = await createChallenge({ opponent_id: friend.id, match_id: matchId })
    if (res.error) { showToast(res.error, true); return }
    showToast(t(lang, 'challengeSent'))
    setShowMatchPicker(false)
    onRefresh()
  }

  async function handleAccept(id) {
    const res = await acceptChallenge({ challengeId: id })
    if (!res.error) { showToast(t(lang, 'challengeAccepted')); onRefresh() }
    else showToast(res.error, true)
  }

  async function handleDecline(id) {
    const res = await declineChallenge({ challengeId: id })
    if (!res.error) { showToast(t(lang, 'challengeDeclined')); onRefresh() }
    else showToast(res.error, true)
  }

  async function handleCancel(id) {
    const res = await cancelChallenge({ challengeId: id })
    if (!res.error) { showToast(t(lang, 'challengeCancelled')); onRefresh() }
    else showToast(res.error, true)
  }

  // Extraire le nom court de l'équipe
  function shortTeam(name) {
    if (!name) return ''
    const i = name.indexOf(' ')
    return i >= 0 ? name.slice(i + 1) : name
  }

  return (
    <div className="flex flex-col gap-4">
      <button onClick={onBack} className="text-xs text-accent font-semibold">
        &larr; {t(lang, 'back')}
      </button>

      {/* En-tête */}
      <div className="flex items-center gap-3">
        <AvatarInitials pseudo={friend.pseudo} size={40} />
        <div className="flex-1 min-w-0">
          <p className="font-display font-bold text-surface-900 dark:text-white truncate">{t(lang, 'challengesWith')} {friend.pseudo}</p>
        </div>
        <button
          onClick={openMatchPicker}
          className="px-3 py-2 rounded-xl bg-accent text-surface-950 text-xs font-semibold active:scale-95 transition-transform flex items-center gap-1.5"
        >
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          {t(lang, 'newChallenge')}
        </button>
      </div>

      {/* Sélecteur de match */}
      {showMatchPicker && (
        <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-semibold text-surface-600 dark:text-surface-300">{t(lang, 'selectMatch')}</p>
            <button onClick={() => setShowMatchPicker(false)} className="text-surface-400 hover:text-surface-600 text-xs">✕</button>
          </div>
          {loadingMatchs ? (
            <p className="text-xs text-surface-400 py-4 text-center">...</p>
          ) : upcomingMatchs.length === 0 ? (
            <p className="text-xs text-surface-400 py-4 text-center">{t(lang, 'noUpcoming')}</p>
          ) : (
            <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
              {upcomingMatchs.map(m => (
                <button
                  key={m.id}
                  onClick={() => handleCreate(m.id)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-surface-900 hover:bg-accent/5 dark:hover:bg-accent/5 transition-colors text-left"
                >
                  <span className="text-xs text-surface-700 dark:text-surface-200 flex-1 truncate">
                    {shortTeam(m.equipe_a)} — {shortTeam(m.equipe_b)}
                  </span>
                  <span className="text-[10px] text-surface-400 flex-shrink-0">
                    {new Date(m.date_coup_envoi.replace(' ', 'T') + 'Z').toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short' })}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Défis en cours / en attente */}
      {pending.length > 0 && (
        <div className="flex flex-col gap-2">
          {pending.map(c => (
            <ChallengeCard key={c.id} challenge={c} userId={userId} lang={lang} onAccept={handleAccept} onDecline={handleDecline} onCancel={handleCancel} />
          ))}
        </div>
      )}

      {/* Défis terminés */}
      {resolved.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-surface-400 dark:text-surface-500">
            {lang === 'fr' ? 'Terminés' : 'Completed'}
          </p>
          {resolved.map(c => (
            <ChallengeCard key={c.id} challenge={c} userId={userId} lang={lang} />
          ))}
        </div>
      )}

      {/* Vide */}
      {friendChallenges.length === 0 && !showMatchPicker && (
        <p className="text-center text-surface-400 dark:text-surface-600 py-10 text-sm">
          {t(lang, 'noChallengesWithFriend')}
        </p>
      )}
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
