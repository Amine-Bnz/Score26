// Avatar par initiales — remplace DiceBear
// Génère un dégradé basé sur le pseudo (déterministe)

function hashCode(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  return hash
}

// Palette de couleurs chaudes et élégantes pour les avatars
const AVATAR_COLORS = [
  ['#6366f1', '#818cf8'], // indigo
  ['#8b5cf6', '#a78bfa'], // violet
  ['#d946ef', '#e879f9'], // fuchsia
  ['#ec4899', '#f472b6'], // pink
  ['#f43f5e', '#fb7185'], // rose
  ['#ef4444', '#f87171'], // red
  ['#f97316', '#fb923c'], // orange
  ['#eab308', '#facc15'], // yellow
  ['#22c55e', '#4ade80'], // green
  ['#14b8a6', '#2dd4bf'], // teal
  ['#06b6d4', '#22d3ee'], // cyan
  ['#3b82f6', '#60a5fa'], // blue
]

function getColors(pseudo) {
  const idx = Math.abs(hashCode(pseudo)) % AVATAR_COLORS.length
  return AVATAR_COLORS[idx]
}

function getInitials(pseudo) {
  if (!pseudo) return '?'
  // Prend la première lettre en majuscule
  return pseudo.charAt(0).toUpperCase()
}

export default function AvatarInitials({ pseudo, size = 96, className = '' }) {
  const [c1, c2] = getColors(pseudo || '')
  const initial = getInitials(pseudo)
  const fontSize = Math.round(size * 0.42)

  return (
    <div
      className={`flex items-center justify-center rounded-full select-none ${className}`}
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${c1}, ${c2})`,
        fontSize,
        fontFamily: '"Space Grotesk", system-ui, sans-serif',
        fontWeight: 700,
        color: 'rgba(255,255,255,0.95)',
        letterSpacing: '-0.02em',
      }}
    >
      {initial}
    </div>
  )
}
