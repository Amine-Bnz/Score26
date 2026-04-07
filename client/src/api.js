// Toutes les fonctions d'appel vers le backend Express

// En dev : VITE_API_URL est vide → '/api' est intercepté par le proxy Vite → localhost:3000
// En prod : VITE_API_URL = 'https://ton-backend.fly.dev' → URL absolue vers Fly.io
const BASE = (import.meta.env.VITE_API_URL ?? '') + '/api'

// Wrapper : parse le JSON et retourne { error, status } si la réponse n'est pas OK
async function handleResponse(res) {
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    return { error: data.error || `Erreur ${res.status}`, status: res.status }
  }
  return data
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function register({ pseudo, email, password }) {
  const res = await fetch(`${BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pseudo, email, password }),
  })
  return handleResponse(res)
}

export async function login({ email, password }) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  return handleResponse(res)
}

export async function verifyToken(token) {
  const res = await fetch(`${BASE}/auth/me`, {
    headers: { 'Authorization': `Bearer ${token}` },
  })
  return handleResponse(res)
}

export async function secureAccount({ user_id, email, password }) {
  const res = await fetch(`${BASE}/auth/secure`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id, email, password }),
  })
  return handleResponse(res)
}

export async function createUser({ id, pseudo, avatar_seed }) {
  const res = await fetch(`${BASE}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, pseudo, avatar_seed }),
  })
  return handleResponse(res)
}

export async function getUser(id) {
  const res = await fetch(`${BASE}/users/${id}`)
  return handleResponse(res)
}

export async function getMatchs(userId) {
  const res = await fetch(`${BASE}/matchs?user_id=${userId}`)
  return handleResponse(res)
}

export async function upsertProno({ user_id, match_id, score_predit_a, score_predit_b }) {
  const res = await fetch(`${BASE}/pronos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id, match_id, score_predit_a, score_predit_b }),
  })
  return handleResponse(res)
}

export async function getVapidPublicKey() {
  const res = await fetch(`${BASE}/push/vapid-public-key`)
  return handleResponse(res)
}

export async function subscribePush({ user_id, subscription }) {
  const res = await fetch(`${BASE}/push/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id, subscription }),
  })
  return handleResponse(res)
}

export async function unsubscribePush({ endpoint }) {
  const res = await fetch(`${BASE}/push/unsubscribe`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint }),
  })
  return handleResponse(res)
}

export async function getNotifSettings(userId) {
  const res = await fetch(`${BASE}/push/settings/${userId}`)
  return handleResponse(res)
}

export async function updateNotifDelay({ user_id, notif_delay }) {
  const res = await fetch(`${BASE}/push/settings`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id, notif_delay }),
  })
  return handleResponse(res)
}

// ── Amis ──────────────────────────────────────────────────────────────────────

export async function getFriendRanking(userId) {
  const res = await fetch(`${BASE}/friends/${userId}/ranking`)
  return handleResponse(res)
}

export async function addFriend({ user_id, friend_code }) {
  const res = await fetch(`${BASE}/friends`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id, friend_code }),
  })
  return handleResponse(res)
}

export async function getFriendPronos(userId, matchId) {
  const res = await fetch(`${BASE}/friends/${userId}/pronos/${matchId}`)
  return handleResponse(res)
}

export async function getFriendHistory(userId, friendId) {
  const res = await fetch(`${BASE}/friends/${userId}/history/${friendId}`)
  return handleResponse(res)
}

export async function compareFriend(userId, friendId) {
  const res = await fetch(`${BASE}/friends/${userId}/compare/${friendId}`)
  return handleResponse(res)
}

export async function removeFriend({ user_id, friendId }) {
  const res = await fetch(`${BASE}/friends/${friendId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id }),
  })
  return handleResponse(res)
}

// ── Classement global ─────────────────────────────────────────────────────────

export async function getGlobalRanking(page = 1, limit = 50) {
  const res = await fetch(`${BASE}/users/ranking?page=${page}&limit=${limit}`)
  return handleResponse(res)
}

export async function getMatchdayRanking(journee) {
  const q = journee ? `?journee=${journee}` : ''
  const res = await fetch(`${BASE}/users/ranking/matchday${q}`)
  return handleResponse(res)
}

export async function getMatchdayList() {
  const res = await fetch(`${BASE}/users/ranking/matchday/list`)
  return handleResponse(res)
}

// ── Défis 1v1 ────────────────────────────────────────────────────────────────

export async function getMyChallenges(userId) {
  const res = await fetch(`${BASE}/challenges/${userId}`)
  return handleResponse(res)
}

export async function createChallenge({ user_id, opponent_id, match_id }) {
  const res = await fetch(`${BASE}/challenges`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id, opponent_id, match_id }),
  })
  return handleResponse(res)
}

export async function acceptChallenge({ challengeId, user_id }) {
  const res = await fetch(`${BASE}/challenges/${challengeId}/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id }),
  })
  return handleResponse(res)
}

export async function declineChallenge({ challengeId, user_id }) {
  const res = await fetch(`${BASE}/challenges/${challengeId}/decline`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id }),
  })
  return handleResponse(res)
}

export async function cancelChallenge({ challengeId, user_id }) {
  const res = await fetch(`${BASE}/challenges/${challengeId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id }),
  })
  return handleResponse(res)
}

// ── Pronos bonus ──────────────────────────────────────────────────────────────

export async function getBonusPronos(userId) {
  const res = await fetch(`${BASE}/bonus/${userId}`)
  return handleResponse(res)
}

export async function saveBonusProno({ user_id, type, value }) {
  const res = await fetch(`${BASE}/bonus`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id, type, value }),
  })
  return handleResponse(res)
}

// ── Groupes ───────────────────────────────────────────────────────────────────

export async function getMyGroups(userId) {
  const res = await fetch(`${BASE}/groups/${userId}`)
  return handleResponse(res)
}

export async function getGroupRanking(groupId) {
  const res = await fetch(`${BASE}/groups/${groupId}/ranking`)
  return handleResponse(res)
}

export async function createGroup({ user_id, name }) {
  const res = await fetch(`${BASE}/groups`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id, name }),
  })
  return handleResponse(res)
}

export async function joinGroup({ user_id, invite_code }) {
  const res = await fetch(`${BASE}/groups/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id, invite_code }),
  })
  return handleResponse(res)
}

export async function leaveGroup({ user_id, groupId }) {
  const res = await fetch(`${BASE}/groups/${groupId}/leave`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id }),
  })
  return handleResponse(res)
}
