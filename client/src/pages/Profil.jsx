import { useEffect, useRef, useState } from 'react'
import html2canvas from 'html2canvas'
import { getUser } from '../api'
import { t } from '../i18n'

// SVG pour l'affichage dans la page
function avatarSvgUrl(seed) {
  return `https://api.dicebear.com/9.x/bottts/svg?seed=${encodeURIComponent(seed)}`
}

// PNG pour la card de partage (html2canvas ne supporte pas bien les SVG cross-origin)
function avatarPngUrl(seed) {
  return `https://api.dicebear.com/9.x/bottts/png?seed=${encodeURIComponent(seed)}&size=96`
}

export default function Profil({ userId, lang }) {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [sharing, setSharing] = useState(false)
  const shareCardRef          = useRef(null)

  useEffect(() => {
    getUser(userId).then(data => {
      setUser(data)
      setLoading(false)
    })
  }, [userId])

  async function handleShare() {
    if (!shareCardRef.current || sharing) return
    setSharing(true)

    // On attend que l'image avatar soit chargée avant la capture
    const img = shareCardRef.current.querySelector('img')
    if (img && !img.complete) {
      await new Promise(resolve => { img.onload = resolve; img.onerror = resolve })
    }

    const canvas = await html2canvas(shareCardRef.current, {
      backgroundColor: null,
      useCORS: true,
      scale: 2, // résolution x2 pour un rendu net sur mobile
    })

    // Téléchargement automatique du PNG
    const link = document.createElement('a')
    link.download = `score26-${user.pseudo}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()

    setSharing(false)
  }

  if (loading) {
    return <div className="flex justify-center py-20 text-gray-400">...</div>
  }

  const stats = user.stats ?? { scores_exacts: 0, bonnes_issues: 0, rates: 0, score_total: 0 }

  return (
    <div className="flex flex-col items-center pt-6 gap-5">
      {/* Avatar affiché dans la page */}
      <img
        src={avatarSvgUrl(user.avatar_seed)}
        alt={user.pseudo}
        className="w-28 h-28 rounded-full bg-gray-100 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700"
      />

      {/* Pseudo + score total */}
      <div className="text-center">
        <p className="text-xl font-bold text-gray-900 dark:text-white">@{user.pseudo}</p>
        <p className="text-3xl font-bold text-blue-500 mt-1">{stats.score_total} pts</p>
      </div>

      {/* Bloc résumé */}
      <div className="w-full bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">
          {t(lang, 'summary')}
        </p>
        <ul className="flex flex-col gap-2">
          <li className="flex justify-between text-sm">
            <span className="text-gray-700 dark:text-gray-300">{t(lang, 'exactScores')}</span>
            <span className="font-bold text-green-500">{stats.scores_exacts}</span>
          </li>
          <li className="flex justify-between text-sm">
            <span className="text-gray-700 dark:text-gray-300">{t(lang, 'goodOutcomes')}</span>
            <span className="font-bold text-blue-500">{stats.bonnes_issues}</span>
          </li>
          <li className="flex justify-between text-sm">
            <span className="text-gray-700 dark:text-gray-300">{t(lang, 'missed')}</span>
            <span className="font-bold text-red-500">{stats.rates}</span>
          </li>
        </ul>
      </div>

      {/* Bouton partager */}
      <button
        onClick={handleShare}
        disabled={sharing}
        className="w-full py-3 rounded-xl border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {sharing ? '...' : t(lang, 'share')}
      </button>

      {/* Card de partage — rendue hors écran, capturée par html2canvas */}
      <div
        ref={shareCardRef}
        style={{ position: 'absolute', left: '-9999px', top: 0 }}
      >
        <ShareCard user={user} stats={stats} avatarUrl={avatarPngUrl(user.avatar_seed)} lang={lang} />
      </div>
    </div>
  )
}

// Card PNG générée pour le partage
function ShareCard({ user, stats, avatarUrl, lang }) {
  return (
    <div style={{
      width: 360,
      background: '#111827',
      borderRadius: 24,
      padding: 32,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 16,
      fontFamily: 'Inter, system-ui, sans-serif',
      color: '#fff',
    }}>
      {/* Logo */}
      <p style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.5px', color: '#fff', margin: 0 }}>
        score26
      </p>

      {/* Avatar PNG */}
      <img
        src={avatarUrl}
        alt={user.pseudo}
        crossOrigin="anonymous"
        width={96}
        height={96}
        style={{ borderRadius: '50%', background: '#1f2937', border: '2px solid #374151' }}
      />

      {/* Pseudo */}
      <p style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#fff' }}>
        @{user.pseudo}
      </p>

      {/* Score total */}
      <p style={{ fontSize: 36, fontWeight: 800, color: '#3b82f6', margin: 0 }}>
        {stats.score_total} pts
      </p>

      {/* Stats */}
      <div style={{
        width: '100%',
        background: '#1f2937',
        borderRadius: 16,
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}>
        <StatRow label={`${stats.scores_exacts} ${t(lang, 'exactScores')}`}  color="#22c55e" />
        <StatRow label={`${stats.bonnes_issues} ${t(lang, 'goodOutcomes')}`} color="#3b82f6" />
        <StatRow label={`${stats.rates} ${t(lang, 'missed')}`}               color="#ef4444" />
      </div>
    </div>
  )
}

function StatRow({ label, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <span style={{ fontSize: 14, color: '#d1d5db' }}>{label}</span>
    </div>
  )
}
