import { useEffect, useState } from 'react'
import { getBonusPronos, saveBonusProno } from '../api'
import { t } from '../i18n'
import { ChevronIcon } from './Icons'

// Extrait les équipes par groupe à partir des matchs de phase de groupe
function teamsByGroup(matchs) {
  const groups = {}
  for (const m of matchs) {
    if (m.phase !== 'groupe' || !m.groupe) continue
    if (!groups[m.groupe]) groups[m.groupe] = new Set()
    groups[m.groupe].add(m.equipe_a)
    groups[m.groupe].add(m.equipe_b)
  }
  const sorted = {}
  for (const g of Object.keys(groups).sort()) sorted[g] = [...groups[g]].sort()
  return sorted
}

// Toutes les équipes (pour winner)
function allTeams(matchs) {
  const s = new Set()
  for (const m of matchs) { s.add(m.equipe_a); s.add(m.equipe_b) }
  return [...s].sort()
}

export default function BonusPronos({ userId, lang, matchs = [], isOnline = true }) {
  const [open, setOpen] = useState(() => {
    try { return localStorage.getItem('score26_bonus_open') === '1' } catch { return false }
  })
  const [pronos, setPronos] = useState({})
  const [saving, setSaving] = useState(null)
  const [toast, setToast] = useState('')

  useEffect(() => {
    if (!userId) return
    getBonusPronos(userId).then(data => {
      if (Array.isArray(data)) {
        const map = {}
        for (const p of data) map[p.type] = p
        setPronos(map)
      }
    })
  }, [userId])

  function toggleOpen() {
    const next = !open
    setOpen(next)
    try { localStorage.setItem('score26_bonus_open', next ? '1' : '0') } catch {}
  }

  async function save(type, value) {
    if (!value || !isOnline) return
    setSaving(type)
    const res = await saveBonusProno({ user_id: userId, type, value })
    setSaving(null)
    if (res.error) { setToast(res.error); setTimeout(() => setToast(''), 2500); return }
    setPronos(prev => ({ ...prev, [type]: { ...prev[type], type, value, locked: 0 } }))
    setToast(t(lang, 'bonusSaved'))
    setTimeout(() => setToast(''), 2500)
  }

  const groups = teamsByGroup(matchs)
  const teams = allTeams(matchs)
  if (teams.length === 0) return null

  const bonusCount = Object.keys(pronos).length
  const totalPossible = 2 + Object.keys(groups).length // winner + top_scorer + 1 per group

  return (
    <div className="mb-3">
      {/* Header cliquable */}
      <button
        onClick={toggleOpen}
        className="flex items-center gap-2 w-full py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
      >
        <ChevronIcon className={`w-3.5 h-3.5 text-accent transition-transform duration-200 ${open ? 'rotate-90' : ''}`} />
        <span className="text-sm font-semibold text-accent">{t(lang, 'bonusPronos')}</span>
        <span className="ml-auto text-[10px] text-surface-400 dark:text-surface-500 tabular-nums">
          {bonusCount}/{totalPossible}
        </span>
      </button>

      {/* Toast */}
      {toast && (
        <div className="text-center text-xs font-medium text-accent py-1 animate-pulse">{toast}</div>
      )}

      {/* Contenu */}
      {open && (
        <div className="flex flex-col gap-3 mt-2">
          {/* Vainqueur final */}
          <BonusCard
            label={t(lang, 'bonusWinner')}
            pts="100"
            lang={lang}
            locked={pronos.winner?.locked}
            saving={saving === 'winner'}
          >
            <TeamSelect
              teams={teams}
              value={pronos.winner?.value ?? ''}
              locked={!!pronos.winner?.locked}
              placeholder={t(lang, 'selectTeam')}
              onChange={v => save('winner', v)}
              saving={saving === 'winner'}
            />
          </BonusCard>

          {/* Meilleur buteur */}
          <BonusCard
            label={t(lang, 'bonusTopScorer')}
            pts="80"
            lang={lang}
            locked={pronos.top_scorer?.locked}
            saving={saving === 'top_scorer'}
          >
            <TextInput
              value={pronos.top_scorer?.value ?? ''}
              locked={!!pronos.top_scorer?.locked}
              placeholder={t(lang, 'selectPlayer')}
              onSubmit={v => save('top_scorer', v)}
              saving={saving === 'top_scorer'}
            />
          </BonusCard>

          {/* Qualifiés par groupe */}
          {Object.entries(groups).map(([g, gTeams]) => {
            const type = `group_${g}_qualified`
            return (
              <BonusCard
                key={g}
                label={`${t(lang, 'bonusGroupQualified')} ${t(lang, 'groupLabel')} ${g}`}
                pts="30"
                lang={lang}
                locked={pronos[type]?.locked}
                saving={saving === type}
              >
                <TeamSelect
                  teams={gTeams}
                  value={pronos[type]?.value ?? ''}
                  locked={!!pronos[type]?.locked}
                  placeholder={t(lang, 'selectTeam')}
                  onChange={v => save(type, v)}
                  saving={saving === type}
                />
              </BonusCard>
            )
          })}
        </div>
      )}
    </div>
  )
}

function BonusCard({ label, pts, lang, locked, children }) {
  return (
    <div className="bg-surface-50 dark:bg-surface-900 rounded-2xl p-3 border border-surface-200 dark:border-surface-800">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-surface-700 dark:text-surface-300">{label}</span>
        <span className="flex items-center gap-1 text-[10px] font-medium text-accent">
          {locked ? <span className="text-surface-400">{t(lang, 'bonusLocked')}</span> : `${pts} ${t(lang, 'bonusPoints')}`}
        </span>
      </div>
      {children}
    </div>
  )
}

function TeamSelect({ teams, value, locked, placeholder, onChange, saving }) {
  if (locked) {
    return <div className="text-sm font-medium text-surface-600 dark:text-surface-400 pl-1">{value}</div>
  }
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      disabled={saving}
      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-surface-800 text-surface-900 dark:text-white text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-accent border border-surface-200 dark:border-surface-700 disabled:opacity-50"
    >
      <option value="">{placeholder}</option>
      {teams.map(team => <option key={team} value={team}>{team}</option>)}
    </select>
  )
}

function TextInput({ value: initialValue, locked, placeholder, onSubmit, saving }) {
  const [val, setVal] = useState(initialValue)

  useEffect(() => { setVal(initialValue) }, [initialValue])

  if (locked) {
    return <div className="text-sm font-medium text-surface-600 dark:text-surface-400 pl-1">{initialValue}</div>
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (val.trim()) onSubmit(val.trim())
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="text"
        value={val}
        onChange={e => setVal(e.target.value)}
        placeholder={placeholder}
        disabled={saving}
        className="flex-1 px-3 py-2 rounded-xl bg-white dark:bg-surface-800 text-surface-900 dark:text-white text-xs placeholder:text-surface-400 dark:placeholder:text-surface-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent border border-surface-200 dark:border-surface-700 disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={saving || !val.trim()}
        className="px-3 py-2 rounded-xl bg-accent text-surface-950 text-xs font-semibold disabled:opacity-40"
      >
        OK
      </button>
    </form>
  )
}
