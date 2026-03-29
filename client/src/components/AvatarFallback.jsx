// Avatar DiceBear avec fallback : cercle coloré + initiales si le CDN est down
// Couleur dérivée d'un hash simple du pseudo pour rester déterministe

import { useState } from 'react'

// Hash simple → index couleur (déterministe, même pseudo = même couleur)
function hashColor(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0
  const colors = [
    '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
    '#EC4899', '#06B6D4', '#F97316', '#6366F1', '#14B8A6',
  ]
  return colors[Math.abs(h) % colors.length]
}

export default function AvatarFallback({ src, pseudo, className = '', size = 112 }) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    const initials = (pseudo || '??').slice(0, 2).toUpperCase()
    const bg = hashColor(pseudo || '')
    return (
      <div
        className={`flex items-center justify-center rounded-full font-bold text-white select-none ${className}`}
        style={{ width: size, height: size, backgroundColor: bg, fontSize: size * 0.35 }}
      >
        {initials}
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={pseudo}
      className={className}
      onError={() => setFailed(true)}
    />
  )
}
