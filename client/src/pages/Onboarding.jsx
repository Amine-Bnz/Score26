import { useState } from 'react'
import { createUser, register, login } from '../api'
import { t } from '../i18n'

export default function Onboarding({ lang, onComplete }) {
  const [mode, setMode] = useState('welcome') // 'welcome' | 'register' | 'login' | 'quick'

  return (
    <div className="min-h-screen bg-surface-100 dark:bg-surface-950 flex flex-col items-center justify-center px-6">
      {/* Logo */}
      <h1 className="font-display text-4xl font-bold text-surface-900 dark:text-white mb-1 tracking-tight">
        score<span className="text-gold">26</span>
      </h1>
      <p className="text-surface-400 dark:text-surface-500 text-sm mb-10">
        {t(lang, 'welcome')}
      </p>

      {mode === 'welcome' && (
        <div className="w-full max-w-xs flex flex-col gap-3">
          <button
            onClick={() => setMode('register')}
            className="w-full py-3 rounded-xl bg-accent hover:bg-accent-dark active:scale-[0.98] text-surface-950 font-semibold text-base transition-all"
          >
            {t(lang, 'registerAccount')}
          </button>
          <button
            onClick={() => setMode('login')}
            className="w-full py-3 rounded-xl bg-surface-200 dark:bg-surface-800 active:scale-[0.98] text-surface-700 dark:text-surface-200 font-semibold text-base transition-all"
          >
            {t(lang, 'login')}
          </button>
          <div className="flex items-center gap-3 my-1">
            <div className="flex-1 h-px bg-surface-300 dark:bg-surface-700" />
            <span className="text-xs text-surface-400">{t(lang, 'or')}</span>
            <div className="flex-1 h-px bg-surface-300 dark:bg-surface-700" />
          </div>
          <button
            onClick={() => setMode('quick')}
            className="w-full py-2.5 rounded-xl text-surface-400 dark:text-surface-500 text-sm font-medium hover:text-surface-600 dark:hover:text-surface-300 transition-colors"
          >
            {t(lang, 'continueWithoutAccount')}
          </button>
          <p className="text-[11px] text-surface-400 dark:text-surface-600 text-center leading-relaxed -mt-1">
            {t(lang, 'continueWithoutAccountHint')}
          </p>
        </div>
      )}

      {mode === 'register' && (
        <RegisterForm lang={lang} onComplete={onComplete} onSwitch={() => setMode('login')} />
      )}

      {mode === 'login' && (
        <LoginForm lang={lang} onComplete={onComplete} onSwitch={() => setMode('register')} />
      )}

      {mode === 'quick' && (
        <QuickForm lang={lang} onComplete={onComplete} onBack={() => setMode('welcome')} />
      )}
    </div>
  )
}

// ── Formulaire inscription ────────────────────────────────────────────────────
function RegisterForm({ lang, onComplete, onSwitch }) {
  const [pseudo, setPseudo]     = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  const PSEUDO_REGEX = /^[a-zA-Z0-9_-]{1,20}$/

  async function handleSubmit(e) {
    e.preventDefault()
    const trimmedPseudo = pseudo.trim()
    if (!trimmedPseudo) { setError(t(lang, 'pseudoEmpty')); return }
    if (!PSEUDO_REGEX.test(trimmedPseudo)) { setError(t(lang, 'pseudoInvalid')); return }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError(t(lang, 'emailInvalid')); return }
    if (password.length < 6) { setError(t(lang, 'passwordTooShort')); return }

    setLoading(true)
    setError('')

    const res = await register({ pseudo: trimmedPseudo, email: email.trim(), password })

    if (res.error) {
      setError(res.status === 429 ? t(lang, 'tooManyAttempts') : res.error)
      setLoading(false)
      return
    }

    localStorage.setItem('score26_user_id', res.id)
    localStorage.setItem('score26_pseudo', res.pseudo)
    if (res.token) localStorage.setItem('score26_token', res.token)
    onComplete(res.id)
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-xs flex flex-col gap-3">
      <input
        type="text" autoFocus maxLength={20}
        placeholder={t(lang, 'pseudoPlaceholder')}
        aria-label={t(lang, 'pseudoPlaceholder')}
        value={pseudo} onChange={e => setPseudo(e.target.value)}
        className="w-full px-4 py-3 rounded-xl border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-900 dark:text-white placeholder-surface-400 dark:placeholder-surface-600 focus:outline-none focus:ring-2 focus:ring-accent text-center text-lg font-display"
      />
      <input
        type="email"
        placeholder={t(lang, 'email')}
        aria-label={t(lang, 'email')}
        value={email} onChange={e => setEmail(e.target.value)}
        className="w-full px-4 py-3 rounded-xl border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-900 dark:text-white placeholder-surface-400 dark:placeholder-surface-600 focus:outline-none focus:ring-2 focus:ring-accent text-center text-sm"
      />
      <input
        type="password"
        placeholder={t(lang, 'password')}
        aria-label={t(lang, 'password')}
        value={password} onChange={e => setPassword(e.target.value)}
        className="w-full px-4 py-3 rounded-xl border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-900 dark:text-white placeholder-surface-400 dark:placeholder-surface-600 focus:outline-none focus:ring-2 focus:ring-accent text-center text-sm"
      />
      {error && <p className="text-result-miss text-sm text-center" role="alert">{error}</p>}
      <button
        type="submit" disabled={loading}
        className="w-full py-3 rounded-xl bg-accent hover:bg-accent-dark active:scale-[0.98] text-surface-950 font-semibold text-base transition-all disabled:opacity-50"
      >
        {loading ? <span className="spinner-btn" /> : t(lang, 'registerAccount')}
      </button>
      <p className="text-xs text-center text-surface-400">
        {t(lang, 'alreadyHaveAccount')}{' '}
        <button type="button" onClick={onSwitch} className="text-accent font-medium">{t(lang, 'loginHere')}</button>
      </p>
    </form>
  )
}

// ── Formulaire connexion ──────────────────────────────────────────────────────
function LoginForm({ lang, onComplete, onSwitch }) {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email.trim()) { setError(t(lang, 'emailInvalid')); return }
    if (!password) { setError(t(lang, 'passwordTooShort')); return }

    setLoading(true)
    setError('')

    const res = await login({ email: email.trim(), password })

    if (res.error) {
      setError(res.status === 429 ? t(lang, 'tooManyAttempts') : t(lang, 'wrongCredentials'))
      setLoading(false)
      return
    }

    localStorage.setItem('score26_user_id', res.id)
    localStorage.setItem('score26_pseudo', res.pseudo)
    if (res.token) localStorage.setItem('score26_token', res.token)
    onComplete(res.id)
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-xs flex flex-col gap-3">
      <input
        type="email" autoFocus
        placeholder={t(lang, 'email')}
        aria-label={t(lang, 'email')}
        value={email} onChange={e => setEmail(e.target.value)}
        className="w-full px-4 py-3 rounded-xl border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-900 dark:text-white placeholder-surface-400 dark:placeholder-surface-600 focus:outline-none focus:ring-2 focus:ring-accent text-center text-sm"
      />
      <input
        type="password"
        placeholder={t(lang, 'password')}
        aria-label={t(lang, 'password')}
        value={password} onChange={e => setPassword(e.target.value)}
        className="w-full px-4 py-3 rounded-xl border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-900 dark:text-white placeholder-surface-400 dark:placeholder-surface-600 focus:outline-none focus:ring-2 focus:ring-accent text-center text-sm"
      />
      {error && <p className="text-result-miss text-sm text-center" role="alert">{error}</p>}
      <button
        type="submit" disabled={loading}
        className="w-full py-3 rounded-xl bg-accent hover:bg-accent-dark active:scale-[0.98] text-surface-950 font-semibold text-base transition-all disabled:opacity-50"
      >
        {loading ? <span className="spinner-btn" /> : t(lang, 'login')}
      </button>
      <p className="text-xs text-center text-surface-400">
        {t(lang, 'noAccountYet')}{' '}
        <button type="button" onClick={onSwitch} className="text-accent font-medium">{t(lang, 'registerHere')}</button>
      </p>
    </form>
  )
}

// ── Formulaire rapide (sans email) — ancien onboarding ────────────────────────
function QuickForm({ lang, onComplete, onBack }) {
  const [pseudo, setPseudo]   = useState('')
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  const PSEUDO_REGEX = /^[a-zA-Z0-9_-]{1,20}$/

  async function handleSubmit(e) {
    e.preventDefault()
    const trimmed = pseudo.trim()
    if (!trimmed) { setError(t(lang, 'pseudoEmpty')); return }
    if (!PSEUDO_REGEX.test(trimmed)) { setError(t(lang, 'pseudoInvalid')); return }

    setLoading(true)
    setError('')

    const id = crypto.randomUUID()
    const res = await createUser({ id, pseudo: trimmed, avatar_seed: trimmed })

    if (res.error) {
      setError(res.status === 429 ? t(lang, 'tooManyAttempts') : t(lang, 'pseudoTaken'))
      setLoading(false)
      return
    }

    localStorage.setItem('score26_user_id', id)
    localStorage.setItem('score26_pseudo', trimmed)
    if (res.token) localStorage.setItem('score26_token', res.token)
    onComplete(id)
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-xs flex flex-col gap-3">
      <input
        type="text" autoFocus maxLength={20}
        placeholder={t(lang, 'pseudoPlaceholder')}
        aria-label={t(lang, 'pseudoPlaceholder')}
        value={pseudo} onChange={e => setPseudo(e.target.value)}
        className="w-full px-4 py-3 rounded-xl border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-900 dark:text-white placeholder-surface-400 dark:placeholder-surface-600 focus:outline-none focus:ring-2 focus:ring-accent text-center text-lg font-display"
      />
      {error && <p className="text-result-miss text-sm text-center" role="alert">{error}</p>}
      <button
        type="submit" disabled={loading}
        className="w-full py-3 rounded-xl bg-accent hover:bg-accent-dark active:scale-[0.98] text-surface-950 font-semibold text-base transition-all disabled:opacity-50"
      >
        {loading ? <span className="spinner-btn" /> : t(lang, 'validate')}
      </button>
      <button type="button" onClick={onBack} className="text-xs text-accent font-medium text-center">
        &larr; {t(lang, 'back')}
      </button>
    </form>
  )
}
