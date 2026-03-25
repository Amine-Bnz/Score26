export default function Navbar({ page, onNavigate, lang }) {
  const items = [
    { key: 'avenir', icon: '⚽', labelFr: 'À venir',  labelEn: 'Upcoming' },
    { key: 'passes', icon: '🏁', labelFr: 'Passés',   labelEn: 'Past'     },
    { key: 'profil', icon: '👤', labelFr: 'Profil',   labelEn: 'Profile'  },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800/60 flex h-16 z-10 safe-area-bottom">
      {items.map(({ key, icon, labelFr, labelEn }) => {
        const active = page === key
        const label = lang === 'fr' ? labelFr : labelEn
        return (
          <button
            key={key}
            onClick={() => onNavigate(key)}
            className="flex flex-col items-center justify-center flex-1 gap-0.5 transition-colors relative"
            aria-label={label}
          >
            {/* Indicateur actif */}
            {active && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-blue-500 rounded-full" />
            )}
            <span className={`text-xl transition-transform ${active ? 'scale-110' : 'scale-100'}`}>
              {icon}
            </span>
            <span className={`text-[10px] font-semibold transition-colors ${
              active ? 'text-blue-500' : 'text-slate-400 dark:text-slate-500'
            }`}>
              {label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
