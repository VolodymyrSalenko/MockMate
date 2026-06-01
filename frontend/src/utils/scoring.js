// Shared scoring helpers used across Dashboard, Sessions, and Debrief.

export const SCORE_HIGH = 8
export const SCORE_MID  = 5
export const AI_HIGH    = 75
export const AI_MID     = 50

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

export function aiColor(s) {
  return s >= AI_HIGH ? 'text-emerald-400' : s >= AI_MID ? 'text-yellow-400' : 'text-red-400'
}

export function aiBg(s) {
  return s >= AI_HIGH
    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
    : s >= AI_MID
    ? 'bg-yellow-400/20 text-yellow-300 border-yellow-400/30'
    : 'bg-red-500/20 text-red-400 border-red-500/30'
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

// ── Client-side AI answer scoring ─────────────────────────────────────────────
// Returns { finalScore (0-100), verdict, detailed: [{score (0-20), tips}] }
export function scoreAllAnswers(answers) {
  if (!answers || answers.length === 0) {
    return { finalScore: 0, verdict: 'No answers to score', detailed: [] }
  }

  const STAR_KEYWORDS  = ['situation', 'task', 'action', 'result', 'achieved', 'implemented', 'led', 'delivered']
  const VAGUE_PHRASES  = ['i think', 'maybe', 'sort of', 'kind of', 'i guess', 'um', 'uh']
  const MAX_PER_ANSWER = 20

  const detailed = answers.map(answer => {
    const text  = (answer || '').trim().toLowerCase()
    const words = text.split(/\s+/).filter(Boolean)
    const wc    = words.length
    const tips  = []
    let score   = 0

    // Length (0-8 pts)
    if (wc >= 80)       score += 8
    else if (wc >= 50)  score += 6
    else if (wc >= 30)  score += 4
    else if (wc >= 10)  score += 2
    else                tips.push('Give a more detailed answer (aim for 50+ words).')

    // STAR keywords (0-7 pts)
    const starHits = STAR_KEYWORDS.filter(k => text.includes(k)).length
    score += Math.min(starHits * 1, 7)
    if (starHits < 2) tips.push('Try using the STAR method: Situation, Task, Action, Result.')

    // Specificity — numbers/percentages (0-3 pts)
    const hasNumbers = /\d/.test(text)
    if (hasNumbers) { score += 3 }
    else            { tips.push('Add specific numbers or outcomes to strengthen your answer.') }

    // Vague language penalty
    const vagueHits = VAGUE_PHRASES.filter(p => text.includes(p)).length
    score = Math.max(0, score - vagueHits)
    if (vagueHits >= 2) tips.push('Avoid vague phrases like "I think" or "sort of" — be direct and confident.')

    if (tips.length === 0) tips.push('Good answer — clear, specific, and well-structured.')

    return { score: Math.min(score, MAX_PER_ANSWER), tips }
  })

  const total      = detailed.reduce((sum, d) => sum + d.score, 0)
  const maxPossible = detailed.length * MAX_PER_ANSWER
  const finalScore = Math.round((total / maxPossible) * 100)

  const verdict =
    finalScore >= 80 ? 'Excellent — interview-ready performance!' :
    finalScore >= 60 ? 'Good — a few areas to sharpen.' :
    finalScore >= 40 ? 'Developing — keep practising structure and specifics.' :
                       'Needs work — focus on detail and the STAR method.'

  return { finalScore, verdict, detailed }
}
