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
