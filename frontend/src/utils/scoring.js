// Shared scoring helpers used across Dashboard, Sessions, and Debrief.

export const SCORE_HIGH = 8
export const SCORE_MID  = 5

export function scoreBg(s) {
  return s >= SCORE_HIGH
    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
    : s >= SCORE_MID
    ? 'bg-yellow-400/20 text-yellow-300 border-yellow-400/30'
    : 'bg-red-500/20 text-red-400 border-red-500/30'
}

export function scoreColor(s) {
  return s >= SCORE_HIGH ? 'text-emerald-400' : s >= SCORE_MID ? 'text-yellow-400' : 'text-red-400'
}

export function scoreHex(s) {
  return s >= SCORE_HIGH ? '#10b981' : s >= SCORE_MID ? '#f59e0b' : '#ef4444'
}

export function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatShort(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function difficultyBadge(d) {
  const map = {
    Junior: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
    Mid:    'text-violet-400 bg-violet-500/10 border-violet-500/20',
    Senior: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  }
  return map[d] || 'text-slate-400 bg-slate-500/10 border-slate-500/20'
}

export function typeBadge(t) {
  const map = {
    full:       '🎯 Full',
    behavioral: '🌟 Behavioral',
    technical:  '⚡ Technical',
    screening:  '📞 Screening',
    practice:   '🎓 Practice',
  }
  return map[t] || t || '—'
}

export function langInfo(code) {
  return (
    { 'en-US': { flag: '🇬🇧', label: 'English' },
      'de-DE': { flag: '🇩🇪', label: 'Deutsch' },
      'fr-FR': { flag: '🇫🇷', label: 'Français' } }[code]
    || { flag: '🌐', label: code }
  )
}

export function avgArr(arr) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null
}
