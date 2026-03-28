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
    // Le seed de l'avatar = le pseudo, pour rester déterministe et permanent
    const avatar_seed = trimmed

    const res = await createUser({ id, pseudo: trimmed, avatar_seed })

    if (res.error) {
      setError(res.status === 429 ? t(lang, 'tooManyAttempts') : t(lang, 'pseudoTaken'))
      setLoading(false)
      return
    }

    // Persistance en localStorage
    localStorage.setItem('score26_user_id', id)
    localStorage.setItem('score26_pseudo', trimmed)

    onComplete(id)
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col items-center justify-center px-6">
      {/* Logo */}
      <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2 tracking-tight">
        score<span className="text-blue-500">26</span>
      </h1>
      <p className="text-gray-500 dark:text-gray-400 text-sm mb-10">
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
          className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-center text-lg"
        />

        {error && (
          <p className="text-red-500 text-sm text-center">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-semibold text-base transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? '...' : t(lang, 'validate')}
        </button>
      </form>
    </div>
  )
}
