import { useState, useEffect } from 'react'

// Affiche "MAJ il y a Xs" — se met à jour toutes les 10s automatiquement
export function LastUpdated({ timestamp, lang }) {
  const [, tick] = useState(0)

  useEffect(() => {
    const id = setInterval(() => tick(n => n + 1), 10_000)
    return () => clearInterval(id)
  }, [])

  if (!timestamp) return null

  const sec = Math.floor((Date.now() - timestamp) / 1000)
  let label
  if (sec < 5)       label = lang === 'fr' ? 'à l\'instant' : 'just now'
  else if (sec < 60) label = lang === 'fr' ? `il y a ${sec}s` : `${sec}s ago`
  else               label = lang === 'fr' ? `il y a ${Math.floor(sec / 60)} min` : `${Math.floor(sec / 60)}min ago`

  return (
    <span className="text-[10px] text-slate-400 dark:text-slate-600">
      {lang === 'fr' ? 'MAJ' : 'Updated'} {label}
    </span>
  )
}
