// Always fillers, whatever the context
const FILLERS = ['um', 'uh', 'er', 'erm', 'ah', 'hmm', 'you know', 'i mean', 'basically', 'literally', 'so yeah']

// Fillers only in some contexts: each is skipped when the word before it shows normal use
const CONTEXT_FILLERS = {
  // "I'd like", "looks like", "something like" are normal
  'like': ['i', "i'd", 'you', 'we', 'they', "we'd", "you'd", "they'd", 'would', 'to', "don't", "didn't", 'not',
           'really', 'also', 'feel', 'feels', 'felt', 'look', 'looks', 'looked', 'sounds', 'seems', 'seemed',
           'something', 'anything', 'nothing', 'things', 'just', 'more', 'much', 'exactly', 'is', 'was',
           'are', 'were', 'be', 'been', 'likes', 'liked'],
  // "what kind of", "the sort of" are normal
  'kind of': ['what', 'this', 'that', 'these', 'those', 'the', 'a', 'any', 'some', 'which', 'same', 'every', 'all', 'different', 'other'],
  'sort of': ['what', 'this', 'that', 'these', 'those', 'the', 'a', 'any', 'some', 'which', 'same', 'every', 'all', 'different', 'other'],
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function countFillers(lower) {
  const counts = {}
  const add = (word) => { counts[word] = (counts[word] || 0) + 1 }
  for (const filler of FILLERS) {
    const n = (lower.match(new RegExp(`\\b${escapeRe(filler)}\\b`, 'g')) || []).length
    if (n) counts[filler] = n
  }
  for (const [filler, normalBefore] of Object.entries(CONTEXT_FILLERS)) {
    // A pause mark before it ("we, like, ...") also makes it a filler
    const re = new RegExp(`(?:^|([\\w']+)([\\s,.;:!?-]+))${escapeRe(filler)}\\b`, 'g')
    for (const m of lower.matchAll(re)) {
      if (!m[1] || /\S/.test(m[2]) || !normalBefore.includes(m[1])) add(filler)
    }
  }
  return counts
}

// Speech delivery for one answer. Answer structure (STAR) is judged by the AI in the debrief.
export function analyzeAnswer(transcript, durationSeconds) {
  const lower = transcript.toLowerCase()
  const words = lower.split(/\s+/).filter(Boolean)
  const wordCount = words.length
  const wpm = durationSeconds > 5 ? Math.round((wordCount / durationSeconds) * 60) : 0

  const fillerCounts = countFillers(lower)
  const totalFillers = Object.values(fillerCounts).reduce((a, b) => a + b, 0)

  return {
    wordCount,
    durationSeconds: Math.round(durationSeconds),
    wpm,
    fillerCounts,
    totalFillers,
  }
}

export function wpmColor(wpm) {
  if (wpm === 0) return 'text-slate-400'
  if (wpm >= 110 && wpm <= 170) return 'text-emerald-400'
  if (wpm >= 90 && wpm <= 185) return 'text-yellow-400'
  return 'text-red-400'
}

export function durationLabel(secs) {
  if (secs < 60) return `${secs}s`
  return `${Math.floor(secs / 60)}m ${secs % 60}s`
}
