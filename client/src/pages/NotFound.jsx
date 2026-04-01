export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-surface-950 text-white px-6">
      <div className="font-display text-6xl font-bold text-accent">404</div>
      <p className="text-surface-400 text-center">Cette page n'existe pas.</p>
      <button
        onClick={() => window.location.replace('/')}
        className="px-5 py-2 bg-accent hover:bg-accent-dark rounded-xl text-sm font-semibold text-surface-950 transition-colors"
      >
        Retour à l'accueil
      </button>
    </div>
  )
}
