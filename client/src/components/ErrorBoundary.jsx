import { Component } from 'react'

// Class component obligatoire — les hooks ne supportent pas componentDidCatch
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    const isFr = (navigator.language || '').startsWith('fr')
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-slate-100 dark:bg-slate-950 text-center gap-4">
        <span className="text-5xl">:(</span>
        <h1 className="text-lg font-bold text-slate-800 dark:text-white">
          {isFr ? 'Oups, quelque chose s\u2019est mal pass\u00e9' : 'Oops, something went wrong'}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs">
          {isFr
            ? 'Une erreur inattendue est survenue. Recharge la page pour continuer.'
            : 'An unexpected error occurred. Reload the page to continue.'}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-2 px-6 py-3 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
        >
          {isFr ? 'Recharger' : 'Reload'}
        </button>
      </div>
    )
  }
}
