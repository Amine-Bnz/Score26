// Icônes SVG inline — stroke, 24×24, strokeWidth 1.8
// Usage : <SunIcon className="w-5 h-5" />

const base = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }

export function SunIcon({ className = 'w-5 h-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base}>
      <circle cx="12" cy="12" r="4.5" />
      <line x1="12" y1="2"    x2="12" y2="4.5"  />
      <line x1="12" y1="19.5" x2="12" y2="22"   />
      <line x1="2"  y1="12"   x2="4.5" y2="12"  />
      <line x1="19.5" y1="12" x2="22" y2="12"   />
      <line x1="4.93" y1="4.93"   x2="6.76" y2="6.76"   />
      <line x1="17.24" y1="17.24" x2="19.07" y2="19.07" />
      <line x1="19.07" y1="4.93"  x2="17.24" y2="6.76"  />
      <line x1="6.76"  y1="17.24" x2="4.93"  y2="19.07" />
    </svg>
  )
}

export function MoonIcon({ className = 'w-5 h-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base}>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}

// Ballon de foot (cercle + coutures stylisées)
export function BallIcon({ className = 'w-6 h-6' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base}>
      <circle cx="12" cy="12" r="10" />
      {/* Pentagone central */}
      <polygon points="12,7.5 15.3,9.9 14.1,13.7 9.9,13.7 8.7,9.9" strokeWidth={1.6} />
      {/* Coutures vers le bord */}
      <line x1="12"   y1="2"    x2="12"   y2="7.5"  />
      <line x1="21.3" y1="8.5"  x2="15.3" y2="9.9"  />
      <line x1="18.2" y1="20.6" x2="14.1" y2="13.7" />
      <line x1="5.8"  y1="20.6" x2="9.9"  y2="13.7" />
      <line x1="2.7"  y1="8.5"  x2="8.7"  y2="9.9"  />
    </svg>
  )
}

// Sifflet d'arbitre
export function WhistleIcon({ className = 'w-6 h-6' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base}>
      {/* Corps du sifflet */}
      <path d="M2 12a4 4 0 0 1 4-4h8l4 4-4 4H6a4 4 0 0 1-4-4z" />
      {/* Embout */}
      <line x1="18" y1="12" x2="22" y2="8" />
      {/* Trou */}
      <circle cx="7.5" cy="12" r="1.2" strokeWidth={1.4} />
    </svg>
  )
}

// Silhouette utilisateur
export function UserIcon({ className = 'w-6 h-6' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  )
}
