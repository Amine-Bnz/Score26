export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-gray-950 text-white px-6">
      <div className="text-6xl font-black text-blue-500">404</div>
      <p className="text-gray-400 text-center">Cette page n'existe pas.</p>
      <button
        onClick={() => window.location.replace('/')}
        className="px-5 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-semibold transition-colors"
      >
        Retour à l'accueil
      </button>
    </div>
  )
}
