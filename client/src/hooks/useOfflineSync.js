import { useEffect, useState, useRef } from 'react'
import { upsertProno } from '../api'

const LS_KEY = 'score26_pending_pronos'

function getPending() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '[]')
  } catch { return [] }
}

function setPending(list) {
  try {
    if (list.length === 0) localStorage.removeItem(LS_KEY)
    else localStorage.setItem(LS_KEY, JSON.stringify(list))
  } catch {}
}

// Ajoute un prono dans la file offline
export function queueProno(prono) {
  const pending = getPending()
  // Remplacer un éventuel prono existant pour le même match
  const idx = pending.findIndex(p => p.match_id === prono.match_id && p.user_id === prono.user_id)
  if (idx >= 0) pending[idx] = prono
  else pending.push(prono)
  setPending(pending)
}

// Hook : surveille le passage offline→online et synchro la file
export function useOfflineSync(userId, isOnline) {
  const [pendingCount, setPendingCount] = useState(() => getPending().length)
  const [synced, setSynced] = useState(false)
  const wasOffline = useRef(!isOnline)

  // Refresh count quand un prono est ajouté (poll léger)
  useEffect(() => {
    const id = setInterval(() => {
      setPendingCount(getPending().length)
    }, 2000)
    return () => clearInterval(id)
  }, [])

  // Sync quand on revient en ligne
  useEffect(() => {
    if (!isOnline) {
      wasOffline.current = true
      return
    }

    if (!wasOffline.current) return
    wasOffline.current = false

    const pending = getPending()
    if (pending.length === 0) return

    async function sync() {
      const remaining = []
      for (const prono of pending) {
        const res = await upsertProno(prono)
        if (res.error) remaining.push(prono)
      }
      setPending(remaining)
      setPendingCount(remaining.length)
      if (remaining.length < pending.length) {
        setSynced(true)
        setTimeout(() => setSynced(false), 3000)
      }
    }

    sync()
  }, [isOnline])

  return { pendingCount, synced }
}
