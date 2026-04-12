// Toutes les fonctions d'appel vers le backend Express

// En dev : VITE_API_URL est vide → '/api' est intercepté par le proxy Vite → localhost:3000
// En prod : VITE_API_URL = 'https://ton-backend.fly.dev' → URL absolue vers Fly.io
const BASE = (import.meta.env.VITE_API_URL ?? '') + '/api'

// Récupère le JWT stocké en localStorage
function getToken() {
  try { return localStorage.getItem('score26_token') } catch { return null }
}

// Headers avec auth JWT
function authHeaders() {
  const token = getToken()
  const h = { 'Content-Type': 'application/json' }
  if (token) h['Authorization'] = `Bearer ${token}`
  return h
}

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

export async function secureAccount({ email, password }) {
  const res = await fetch(`${BASE}/auth/secure`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ email, password }),
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
  const token = getToken()
  const h = {}
  if (token) h['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${BASE}/users/${id}`, { headers: h })
  return handleResponse(res)
}

export async function getUserHistory(userId, { phase, result } = {}) {
  const params = new URLSearchParams()
  if (phase) params.set('phase', phase)
  if (result) params.set('result', result)
  const q = params.toString()
  const res = await fetch(`${BASE}/users/${userId}/history${q ? '?' + q : ''}`)
  return handleResponse(res)
}

export async function deleteAccount({ confirm_pseudo }) {
  const userId = localStorage.getItem('score26_user_id')
  const res = await fetch(`${BASE}/users/${userId}`, {
    method: 'DELETE',
    headers: authHeaders(),
    body: JSON.stringify({ confirm_pseudo }),
  })
  return handleResponse(res)
}

export async function getMatchs(userId) {
  const res = await fetch(`${BASE}/matchs?user_id=${userId}`)
  return handleResponse(res)
}

export async function upsertProno({ user_id, match_id, score_predit_a, score_predit_b }) {
  const res = await fetch(`${BASE}/pronos`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ match_id, score_predit_a, score_predit_b }),
  })
  return handleResponse(res)
}

export async function getVapidPublicKey() {
  const res = await fetch(`${BASE}/push/vapid-public-key`)
  return handleResponse(res)
}

export async function subscribePush({ subscription }) {
  const res = await fetch(`${BASE}/push/subscribe`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ subscription }),
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

export async function updateNotifDelay({ notif_delay }) {
  const res = await fetch(`${BASE}/push/settings`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ notif_delay }),
  })
  return handleResponse(res)
}

// ── Amis ──────────────────────────────────────────────────────────────────────

export async function getFriendRanking(userId) {
  const res = await fetch(`${BASE}/friends/${userId}/ranking`)
  return handleResponse(res)
}

export async function addFriend({ friend_code }) {
  const res = await fetch(`${BASE}/friends`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ friend_code }),
  })
  return handleResponse(res)
}

export async function getFriendPronos(userId, matchId) {
  const res = await fetch(`${BASE}/friends/${userId}/pronos/${matchId}`)
  return handleResponse(res)
}

export async function toggleReaction(targetUserId, matchId, emoji) {
  const res = await fetch(`${BASE}/reactions`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ target_user_id: targetUserId, match_id: matchId, emoji }),
  })
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

export async function removeFriend({ friendId }) {
  const res = await fetch(`${BASE}/friends/${friendId}`, {
    method: 'DELETE',
    headers: authHeaders(),
    body: JSON.stringify({}),
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

export async function createChallenge({ opponent_id, match_id }) {
  const res = await fetch(`${BASE}/challenges`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ opponent_id, match_id }),
  })
  return handleResponse(res)
}

export async function acceptChallenge({ challengeId }) {
  const res = await fetch(`${BASE}/challenges/${challengeId}/accept`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({}),
  })
  return handleResponse(res)
}

export async function declineChallenge({ challengeId }) {
  const res = await fetch(`${BASE}/challenges/${challengeId}/decline`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({}),
  })
  return handleResponse(res)
}

export async function cancelChallenge({ challengeId }) {
  const res = await fetch(`${BASE}/challenges/${challengeId}`, {
    method: 'DELETE',
    headers: authHeaders(),
    body: JSON.stringify({}),
  })
  return handleResponse(res)
}

// ── Pronos bonus ──────────────────────────────────────────────────────────────

export async function getBonusPronos(userId) {
  const res = await fetch(`${BASE}/bonus/${userId}`)
  return handleResponse(res)
}

export async function saveBonusProno({ type, value }) {
  const res = await fetch(`${BASE}/bonus`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ type, value }),
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

export async function createGroup({ name }) {
  const res = await fetch(`${BASE}/groups`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ name }),
  })
  return handleResponse(res)
}

export async function joinGroup({ invite_code }) {
  const res = await fetch(`${BASE}/groups/join`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ invite_code }),
  })
  return handleResponse(res)
}

export async function leaveGroup({ groupId }) {
  const res = await fetch(`${BASE}/groups/${groupId}/leave`, {
    method: 'DELETE',
    headers: authHeaders(),
    body: JSON.stringify({}),
  })
  return handleResponse(res)
}
