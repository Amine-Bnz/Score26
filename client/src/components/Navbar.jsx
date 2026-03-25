// Barre de navigation fixe en bas — 3 pages
export default function Navbar({ page, onNavigate }) {
  const items = [
    { key: 'avenir',  icon: '⚽', label: 'À venir' },
    { key: 'passes',  icon: '🏁', label: 'Passés'  },
    { key: 'profil',  icon: '👤', label: 'Profil'  },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-gray-50 dark:bg-gray-950 border-t border-gray-200 dark:border-gray-800 flex justify-around items-center h-16 z-10 max-w-md mx-auto">
      {items.map(({ key, icon, label }) => (
        <button
          key={key}
          onClick={() => onNavigate(key)}
          className={`flex flex-col items-center gap-0.5 flex-1 py-2 transition-colors ${
            page === key
              ? 'text-blue-500'
              : 'text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
          aria-label={label}
        >
          <span className="text-xl">{icon}</span>
          <span className="text-xs font-medium">{label}</span>
        </button>
      ))}
    </nav>
  )
}
