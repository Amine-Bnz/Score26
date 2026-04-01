import { useState } from 'react'
import { createUser } from '../api'
import { t } from '../i18n'

export default function Onboarding({ lang, onComplete }) {
  const [pseudo, setPseudo] = useState('')
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)

  const PSEUDO_REGEX = /^[a-zA-Z0-9_-]{1,20}$/

  async function handleSubmit(e) {
    e.preventDefault()
    const trimmed = pseudo.trim()
    if (!trimmed) {
      setError(t(lang, 'pseudoEmpty'))
      return
    }
    if (!PSEUDO_REGEX.test(trimmed)) {
      setError(t(lang, 'pseudoInvalid'))
      return
    }

    setLoading(true)
    setError('')

    const id = crypto.randomUUID()
    const avatar_seed = trimmed

    const res = await createUser({ id, pseudo: trimmed, avatar_seed })

    if (res.error) {
      setError(res.status === 429 ? t(lang, 'tooManyAttempts') : t(lang, 'pseudoTaken'))
      setLoading(false)
      return
    }

    localStorage.setItem('score26_user_id', id)
    localStorage.setItem('score26_pseudo', trimmed)

    onComplete(id)
  }

  return (
    <div className="min-h-screen bg-surface-100 dark:bg-surface-950 flex flex-col items-center justify-center px-6">
      {/* Logo */}
      <h1 className="font-display text-4xl font-bold text-surface-900 dark:text-white mb-1 tracking-tight">
        score<span className="text-gold">26</span>
      </h1>
      <p className="text-surface-400 dark:text-surface-500 text-sm mb-12">
        {t(lang, 'welcome')}
      </p>

      {/* Formulaire */}
      <form onSubmit={handleSubmit} className="w-full max-w-xs flex flex-col gap-4">
        <input
          type="text"
          autoFocus
          maxLength={20}
          placeholder={t(lang, 'pseudoPlaceholder')}
          value={pseudo}
          onChange={e => setPseudo(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-900 dark:text-white placeholder-surface-400 dark:placeholder-surface-600 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent text-center text-lg font-display"
        />

        {error && (
          <p className="text-result-miss text-sm text-center">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl bg-accent hover:bg-accent-dark active:scale-[0.98] text-surface-950 font-semibold text-base transition-all disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        >
          {loading ? '...' : t(lang, 'validate')}
        </button>
      </form>
    </div>
  )
}
