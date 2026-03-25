// Toutes les fonctions d'appel vers le backend Express

const BASE = '/api'

export async function createUser({ id, pseudo, avatar_seed }) {
  const res = await fetch(`${BASE}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, pseudo, avatar_seed }),
  })
  return res.json()
}

export async function getUser(id) {
  const res = await fetch(`${BASE}/users/${id}`)
  return res.json()
}

export async function getMatchs(userId) {
  const res = await fetch(`${BASE}/matchs?user_id=${userId}`)
  return res.json()
}

export async function upsertProno({ user_id, match_id, score_predit_a, score_predit_b }) {
  const res = await fetch(`${BASE}/pronos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id, match_id, score_predit_a, score_predit_b }),
  })
  return res.json()
}
