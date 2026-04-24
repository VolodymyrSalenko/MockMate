const KEY = 'mockmate_history'
const MAX = 10

export function saveSession({ role, difficulty, overall_score, answerCount, duration, date }) {
  const history = loadHistory()
  history.unshift({
    id: Date.now(),
    role,
    difficulty,
    overall_score,
    answerCount,
    duration: duration || 0,
    date: date || new Date().toISOString(),
  })
  try {
    localStorage.setItem(KEY, JSON.stringify(history.slice(0, MAX)))
  } catch {
    // storage full — ignore
  }
}

export function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]')
  } catch {
    return []
  }
}

export function clearHistory() {
  localStorage.removeItem(KEY)
}

// Returns [{date, score, role}] oldest-first for progress charts
export function getProgressData() {
  return loadHistory()
    .filter(s => s.overall_score != null)
    .map(s => ({
      date: new Date(s.date || s.id).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      score: parseFloat(parseFloat(s.overall_score).toFixed(1)),
      role: s.role || '',
      difficulty: s.difficulty || 'Mid',
    }))
    .reverse()
}
