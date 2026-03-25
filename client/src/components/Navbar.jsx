import { BallIcon, WhistleIcon, UserIcon } from './Icons'

export default function Navbar({ page, onNavigate, lang }) {
  const items = [
    { key: 'avenir', Icon: BallIcon,    labelFr: 'À venir',  labelEn: 'Upcoming' },
    { key: 'passes', Icon: WhistleIcon, labelFr: 'Passés',   labelEn: 'Past'     },
    { key: 'profil', Icon: UserIcon,    labelFr: 'Profil',   labelEn: 'Profile'  },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-slate-100 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800/60 flex h-16 z-10">
      {items.map(({ key, Icon, labelFr, labelEn }) => {
        const active = page === key
        const label  = lang === 'fr' ? labelFr : labelEn
        return (
          <button
            key={key}
            onClick={() => onNavigate(key)}
            className="flex flex-col items-center justify-center flex-1 gap-1 transition-colors relative"
            aria-label={label}
          >
            {active && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-blue-500 rounded-full" />
            )}
            <Icon className={`w-6 h-6 transition-colors ${active ? 'text-blue-500' : 'text-slate-400 dark:text-slate-500'}`} />
            <span className={`text-[10px] font-semibold transition-colors ${active ? 'text-blue-500' : 'text-slate-400 dark:text-slate-500'}`}>
              {label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
