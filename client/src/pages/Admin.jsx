import { useEffect, useState } from 'react'

const GROUPES = ['A','B','C','D','E','F','G','H','I','J','K','L']
const API_BASE = (import.meta.env.VITE_API_URL ?? '') + '/api'

const STATUT_LABEL = {
  a_venir:  { label: 'À venir',  cls: 'bg-surface-200 text-surface-700 dark:bg-surface-700 dark:text-surface-300' },
  en_cours: { label: 'En cours', cls: 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-300' },
  termine:  { label: 'Terminé',  cls: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
}

function formatDate(str) {
  const d = new Date(str + (str.endsWith('Z') ? '' : 'Z'))
  return d.toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit' })
    + ' ' + d.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' }) + ' UTC'
}

function shortName(full) {
  if (!full) return ''
  const idx = full.indexOf(' ')
  return idx === -1 ? full : full.slice(idx + 1)
}

export default function Admin() {
  // S3: lire le token depuis l'URL une seule fois, puis le retirer de l'URL (sécurité)
  const [token] = useState(() => {
    const t = new URLSearchParams(window.location.search).get('token') || ''
    if (t) window.history.replaceState({}, '', window.location.pathname)
    return t
  })
  const [matchs,  setMatchs]  = useState([])
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(true)
  // état local des inputs score par match : { [matchId]: { a: '', b: '' } }
  const [scores, setScores] = useState({})
  // feedback par match : { [matchId]: message }
  const [feedback, setFeedback] = useState({})

  async function charger() {
    setError('')
    try {
      const res = await fetch(`${API_BASE}/admin/matchs`, { headers: { 'x-admin-token': token } })
      if (res.status === 401) { setError('Token invalide — vérifier ?token= dans l\'URL'); return }
      if (!res.ok) {
        const txt = await res.text()
        setError(`Erreur ${res.status} : ${txt.slice(0, 200)}`)
        return
      }
      const data = await res.json()
      setMatchs(data)
      // Pré-remplir les inputs avec les scores réels existants
      const init = {}
      data.forEach(m => {
        init[m.id] = {
          a: m.score_reel_a != null ? String(m.score_reel_a) : '',
          b: m.score_reel_b != null ? String(m.score_reel_b) : '',
        }
      })
      setScores(init)
    } catch {
      setError('Impossible de joindre le serveur.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { charger() }, [])

  async function patcher(matchId, body, msg) {
    const res = await fetch(`${API_BASE}/admin/matchs/${matchId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
      body: JSON.stringify(body),
    })
    if (!res.ok) { setFeedback(f => ({ ...f, [matchId]: '❌ Erreur' })); return }
    const updated = await res.json()
    setMatchs(prev => prev.map(m => m.id === matchId ? { ...m, ...updated } : m))
    setFeedback(f => ({ ...f, [matchId]: msg }))
    setTimeout(() => setFeedback(f => { const n = {...f}; delete n[matchId]; return n }), 2500)
  }

  function terminer(matchId) {
    const s = scores[matchId] ?? {}
    const a = parseInt(s.a, 10)
    const b = parseInt(s.b, 10)
    if (isNaN(a) || isNaN(b) || a < 0 || b < 0) {
      setFeedback(f => ({ ...f, [matchId]: '⚠️ Score invalide' }))
      return
    }
    patcher(matchId, { score_reel_a: a, score_reel_b: b }, '✅ Score enregistré')
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-surface-100 dark:bg-surface-900 text-surface-500">
      Chargement…
    </div>
  )

  if (error) return (
    <div className="flex items-center justify-center min-h-screen bg-surface-100 dark:bg-surface-900">
      <div className="bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 rounded-xl p-6 max-w-sm text-center">
        <div className="text-2xl mb-2">⛔</div>
        <p className="font-semibold">{error}</p>
        <p className="text-sm mt-2 opacity-70">Exemple : <code>/admin?token=VOTRE_TOKEN</code></p>
      </div>
    </div>
  )

  const parGroupe = GROUPES.reduce((acc, g) => {
    acc[g] = matchs.filter(m => m.groupe === g)
    return acc
  }, {})

  return (
    <div className="min-h-screen bg-surface-100 dark:bg-surface-900 text-surface-800 dark:text-surface-200 pb-12">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white dark:bg-surface-800 shadow px-4 py-3 flex items-center justify-between">
        <span className="font-display font-bold text-lg tracking-tight">score<span className="text-gold">26</span> <span className="text-surface-400 font-normal text-sm font-sans">/ admin</span></span>
        <button
          onClick={charger}
          className="text-sm px-3 py-1.5 rounded-lg bg-surface-100 dark:bg-surface-700 hover:bg-surface-200 dark:hover:bg-surface-600 transition"
        >
          ↻ Rafraîchir
        </button>
      </div>

      <div className="max-w-3xl mx-auto px-4 pt-6 space-y-8">
        {GROUPES.map(g => {
          const liste = parGroupe[g]
          if (!liste || liste.length === 0) return null
          return (
            <section key={g}>
              <h2 className="text-xs font-bold uppercase tracking-widest text-surface-400 mb-3">
                Groupe {g}
              </h2>
              <div className="space-y-2">
                {liste.map(m => {
                  const st = STATUT_LABEL[m.statut] ?? STATUT_LABEL.a_venir
                  const sc = scores[m.id] ?? { a: '', b: '' }
                  return (
                    <div key={m.id} className="bg-white dark:bg-surface-800 rounded-xl px-4 py-3 shadow-sm">
                      {/* Ligne principale */}
                      <div className="flex items-center gap-3 flex-wrap">
                        {/* Journée + date */}
                        <span className="text-xs text-surface-400 w-[70px] shrink-0">
                          J{m.journee} · {formatDate(m.date_coup_envoi)}
                        </span>

                        {/* Équipes */}
                        <span className="flex-1 min-w-0 text-sm font-medium truncate">
                          {shortName(m.equipe_a)}
                          <span className="text-surface-400 mx-1">vs</span>
                          {shortName(m.equipe_b)}
                        </span>

                        {/* Badge statut */}
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${st.cls}`}>
                          {st.label}
                        </span>

                        {/* Score live si en cours */}
                        {m.statut === 'en_cours' && m.score_live_a != null && (
                          <span className="text-xs text-red-500 font-bold shrink-0">
                            {m.score_live_a}–{m.score_live_b}
                            {m.minute_live ? ` ${m.minute_live}'` : ''}
                          </span>
                        )}

                        {/* Score réel si terminé */}
                        {m.statut === 'termine' && m.score_reel_a != null && (
                          <span className="text-xs text-green-600 dark:text-green-400 font-bold shrink-0">
                            {m.score_reel_a}–{m.score_reel_b}
                          </span>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {/* Passer en cours */}
                        {m.statut === 'a_venir' && (
                          <button
                            onClick={() => patcher(m.id, { statut: 'en_cours' }, '🔴 En cours')}
                            className="text-xs px-2.5 py-1 rounded-lg bg-red-50 dark:bg-red-900/40 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900 transition"
                          >
                            Mettre en cours
                          </button>
                        )}

                        {/* Repasser à venir */}
                        {m.statut === 'en_cours' && (
                          <button
                            onClick={() => patcher(m.id, { statut: 'a_venir' }, '↩️ À venir')}
                            className="text-xs px-2.5 py-1 rounded-lg bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-300 hover:bg-surface-200 transition"
                          >
                            Annuler live
                          </button>
                        )}

                        {/* Inputs score + bouton terminer */}
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number" min="0" max="99"
                            value={sc.a}
                            onChange={e => setScores(s => ({ ...s, [m.id]: { ...s[m.id], a: e.target.value } }))}
                            className="w-10 text-center text-sm border border-surface-300 dark:border-surface-600 rounded-lg bg-white dark:bg-surface-700 py-0.5"
                          />
                          <span className="text-surface-400">–</span>
                          <input
                            type="number" min="0" max="99"
                            value={sc.b}
                            onChange={e => setScores(s => ({ ...s, [m.id]: { ...s[m.id], b: e.target.value } }))}
                            className="w-10 text-center text-sm border border-surface-300 dark:border-surface-600 rounded-lg bg-white dark:bg-surface-700 py-0.5"
                          />
                          <button
                            onClick={() => terminer(m.id)}
                            className="text-xs px-2.5 py-1 rounded-lg bg-green-50 dark:bg-green-900/40 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900 transition"
                          >
                            Terminer
                          </button>
                        </div>

                        {/* Recalculer les points (si terminé) */}
                        {m.statut === 'termine' && (
                          <button
                            onClick={() => patcher(m.id, { recalculer: true }, '🔄 Points recalculés')}
                            className="text-xs px-2.5 py-1 rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition"
                          >
                            Recalculer
                          </button>
                        )}

                        {/* Réinitialiser (si terminé ou en cours) */}
                        {m.statut !== 'a_venir' && (
                          <button
                            onClick={() => patcher(m.id, { reset: true }, '↩️ Réinitialisé')}
                            className="text-xs px-2.5 py-1 rounded-lg bg-orange-50 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900 transition"
                          >
                            Réinitialiser
                          </button>
                        )}

                        {/* Feedback */}
                        {feedback[m.id] && (
                          <span className="text-xs text-surface-500 dark:text-surface-400 ml-1">
                            {feedback[m.id]}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
