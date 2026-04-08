import { BallIcon, WhistleIcon, FriendsIcon, UserIcon } from './Icons'

export default function Navbar({ page, onNavigate, lang }) {
  const items = [
    { key: 'avenir', Icon: BallIcon,     labelFr: 'À venir',  labelEn: 'Upcoming' },
    { key: 'passes', Icon: WhistleIcon,  labelFr: 'Passés',   labelEn: 'Past'     },
    { key: 'amis',   Icon: FriendsIcon,  labelFr: 'Amis',     labelEn: 'Friends'  },
    { key: 'profil', Icon: UserIcon,     labelFr: 'Profil',   labelEn: 'Profile'  },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-surface-100/80 dark:bg-surface-950/80 backdrop-blur-xl border-t border-surface-200 dark:border-surface-800/30 z-10">
      <div className="flex h-16">
        {items.map(({ key, Icon, labelFr, labelEn }) => {
          const active = page === key
          const label  = lang === 'fr' ? labelFr : labelEn
          return (
            <button
              key={key}
              onClick={() => { navigator.vibrate?.(10); onNavigate(key) }}
              className="flex flex-col items-center justify-center flex-1 gap-0.5 active:scale-90 transition-transform relative focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
              aria-label={label}
            >
              <div className={`flex items-center justify-center w-9 h-9 rounded-xl transition-colors ${active ? 'bg-accent/10' : ''}`}>
                <Icon className={`w-[22px] h-[22px] transition-colors ${active ? 'text-accent' : 'text-surface-400 dark:text-surface-500'}`} />
              </div>
              <span className={`text-[10px] font-medium transition-colors ${active ? 'text-accent' : 'text-surface-400 dark:text-surface-500'}`}>
                {label}
              </span>
            </button>
          )
        })}
      </div>
      <div className="safe-area-inset-bottom" />
    </nav>
  )
}
