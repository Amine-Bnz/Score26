import { useEffect, useRef, useState } from 'react'
import html2canvas from 'html2canvas'
import { getUser } from '../api'
import { t } from '../i18n'

function avatarSvgUrl(seed) {
  return `https://api.dicebear.com/9.x/bottts/svg?seed=${encodeURIComponent(seed)}`
}
function avatarPngUrl(seed) {
  return `https://api.dicebear.com/9.x/bottts/png?seed=${encodeURIComponent(seed)}&size=96`
}

export default function Profil({ userId, lang }) {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [sharing, setSharing] = useState(false)
  const shareCardRef          = useRef(null)

  useEffect(() => {
    getUser(userId).then(data => { setUser(data); setLoading(false) })
  }, [userId])

  async function handleShare() {
    if (!shareCardRef.current || sharing) return
    setSharing(true)
    const img = shareCardRef.current.querySelector('img')
    if (img && !img.complete) {
      await new Promise(resolve => { img.onload = resolve; img.onerror = resolve })
    }
    const canvas = await html2canvas(shareCardRef.current, {
      backgroundColor: null, useCORS: true, scale: 2,
    })
    const link = document.createElement('a')
    link.download = `score26-${user.pseudo}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
    setSharing(false)
  }

  if (loading) {
    return <div className="flex justify-center py-20 text-slate-400">...</div>
  }

  const stats = user.stats ?? { scores_exacts: 0, bonnes_issues: 0, rates: 0, score_total: 0 }

  return (
    <div className="flex flex-col items-center pt-8 gap-5">
      {/* Avatar */}
      <div className="relative">
        <img
          src={avatarSvgUrl(user.avatar_seed)}
          alt={user.pseudo}
          className="w-28 h-28 rounded-full bg-slate-100 dark:bg-slate-800 ring-2 ring-slate-200 dark:ring-slate-700"
        />
      </div>

      {/* Pseudo + score */}
      <div className="text-center">
        <p className="text-xl font-bold text-slate-900 dark:text-white">{user.pseudo}</p>
        <p className="text-4xl font-extrabold text-blue-500 mt-1 tabular-nums">{stats.score_total}</p>
        <p className="text-xs text-slate-400 dark:text-slate-500 font-semibold tracking-widest uppercase mt-0.5">
          {t(lang, 'totalScore')}
        </p>
      </div>

      {/* Résumé */}
      <div className="w-full bg-slate-50 dark:bg-slate-900 rounded-2xl ring-1 ring-slate-100 dark:ring-slate-800/60 shadow-sm shadow-slate-200 dark:shadow-none p-5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-4">
          {t(lang, 'summary')}
        </p>
        <ul className="flex flex-col gap-3">
          <StatLine value={stats.scores_exacts} label={t(lang, 'exactScores')}  color="text-green-500" dot="bg-green-500" />
          <StatLine value={stats.bonnes_issues} label={t(lang, 'goodOutcomes')} color="text-blue-500"  dot="bg-blue-500"  />
          <StatLine value={stats.rates}         label={t(lang, 'missed')}       color="text-red-500"   dot="bg-red-500"   />
        </ul>
      </div>

      {/* Bouton partager */}
      <button
        onClick={handleShare}
        disabled={sharing}
        className="w-full py-3.5 rounded-2xl bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-blue-500/20"
      >
        {sharing ? '...' : t(lang, 'share')}
      </button>

      {/* Card de partage hors-écran */}
      <div ref={shareCardRef} style={{ position: 'absolute', left: '-9999px', top: 0 }}>
        <ShareCard user={user} stats={stats} avatarUrl={avatarPngUrl(user.avatar_seed)} lang={lang} />
      </div>
    </div>
  )
}

function StatLine({ value, label, color, dot }) {
  return (
    <li className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dot}`} />
        <span className="text-sm text-slate-600 dark:text-slate-300">{label}</span>
      </div>
      <span className={`text-sm font-bold tabular-nums ${color}`}>{value}</span>
    </li>
  )
}

function ShareCard({ user, stats, avatarUrl, lang }) {
  return (
    <div style={{ width: 360, background: '#0f172a', borderRadius: 24, padding: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, fontFamily: 'Inter, system-ui, sans-serif', color: '#fff' }}>
      <p style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.5px', margin: 0 }}>
        score<span style={{ color: '#3b82f6' }}>26</span>
      </p>
      <img src={avatarUrl} alt={user.pseudo} crossOrigin="anonymous" width={88} height={88}
        style={{ borderRadius: '50%', background: '#1e293b', border: '2px solid #334155' }} />
      <p style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{user.pseudo}</p>
      <p style={{ fontSize: 40, fontWeight: 800, color: '#3b82f6', margin: 0 }}>{stats.score_total}</p>
      <div style={{ width: '100%', background: '#1e293b', borderRadius: 16, padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[
          { n: stats.scores_exacts, label: t(lang, 'exactScores'),  color: '#22c55e' },
          { n: stats.bonnes_issues, label: t(lang, 'goodOutcomes'), color: '#3b82f6' },
          { n: stats.rates,         label: t(lang, 'missed'),       color: '#ef4444' },
        ].map(({ n, label, color }) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: '#94a3b8' }}>{label}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color }}>{n}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
