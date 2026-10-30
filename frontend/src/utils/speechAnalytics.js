const FILLER_WORDS = [
  'um', 'uh', 'er', 'ah',
  'like', 'basically', 'literally', 'actually',
  'you know', 'i mean', 'kind of', 'sort of',
  'right', 'okay so', 'so yeah',
]

const STAR_PATTERNS = {
  situation: /\b(situation|context|background|when i was|we were|there was|in my|at the time|working at|i was at|i was working|at my (previous|last|current)|in my (previous|last|current))\b/i,
  task:      /\b(task|responsible|my role|i was (asked|tasked)|needed to|had to|my job|my goal|i needed|we needed|the goal was|objective|i was supposed to)\b/i,
  action:    /\b(i (did|decided|took|implemented|built|created|solved|worked|started|developed|designed|led|managed|reached out|contacted|set up|organized|wrote|fixed|helped)|so i|then i|i first|my approach|i chose|what i did)\b/i,
  result:    /\b(result|outcome|achieved|improved|reduced|increased|saved|delivered|completed|as a result|in the end|ultimately|the impact|we (achieved|succeeded|managed)|it worked|it helped|this led|ended up|the team|percent|%)\b/i,
}

export function analyzeAnswer(transcript, durationSeconds) {
  const lower = transcript.toLowerCase()
  const words = lower.split(/\s+/).filter(Boolean)
  const wordCount = words.length
  const wpm = durationSeconds > 5 ? Math.round((wordCount / durationSeconds) * 60) : 0

  // Count filler words (whole-word matching)
  const fillerCounts = {}
  let totalFillers = 0
  FILLER_WORDS.forEach((filler) => {
    const escaped = filler.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(`\\b${escaped}\\b`, 'gi')
    const matches = transcript.match(regex)
    if (matches && matches.length > 0) {
      fillerCounts[filler] = matches.length
      totalFillers += matches.length
    }
  })

  // STAR detection (only meaningful for behavioral questions)
  const star = {
    situation: STAR_PATTERNS.situation.test(lower),
    task:      STAR_PATTERNS.task.test(lower),
    action:    STAR_PATTERNS.action.test(lower),
    result:    STAR_PATTERNS.result.test(lower),
  }
  const starScore = Object.values(star).filter(Boolean).length

  return {
    wordCount,
    durationSeconds: Math.round(durationSeconds),
    wpm,
    fillerCounts,
    totalFillers,
    star,
    starScore,
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
