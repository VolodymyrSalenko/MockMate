// Body language read from the webcam: facial expressions, head gestures, moments worth
// working on, and the per-moment timeline that lets the recording show them while it plays.

// Traffic light: green is good, yellow is worth a glance, red is worth working on
export const ZONES = {
  green:  { badge: 'bg-emerald-600/85', strip: 'bg-emerald-500', text: 'text-emerald-500' },
  yellow: { badge: 'bg-amber-500/90',   strip: 'bg-amber-400',   text: 'text-amber-500' },
  red:    { badge: 'bg-red-600/90',     strip: 'bg-red-500',     text: 'text-red-500' },
}

// Only expressions the face model tells apart reliably
export const EXPRESSIONS = [
  { id: 'neutral',   label: 'Neutral',   icon: '😐', zone: 'green' },
  { id: 'smiling',   label: 'Smiling',   icon: '😊', zone: 'green' },
  { id: 'surprised', label: 'Surprised', icon: '😮', zone: 'yellow' },
  { id: 'serious',   label: 'Serious',   icon: '😠', zone: 'yellow' },
]

// The number stored in the timeline for each expression. Codes are never reused:
// 2 and 5 were Focused and Tense, which older sessions show as Neutral.
const EXPRESSION_CODES = { neutral: 0, smiling: 1, surprised: 3, serious: 4 }

export const GESTURES = [
  null,
  { id: 'nod',   label: 'Nodding',      icon: '👍', zone: 'green' },
  { id: 'shake', label: 'Shaking head', icon: '🙅', zone: 'yellow' },
]

// Faces differ at rest (some brows sit lower than others), so each
// reading is compared with this person's usual face: the median of the last minute
const BASELINE_SIZE = 300   // readings, about a minute at 5 per second

export function createBaseline() {
  const history = []
  return {
    add(signals) {
      history.push(signals)
      if (history.length > BASELINE_SIZE) history.shift()
    },
    ready: () => history.length >= 10,
    median(key) {
      const v = history.map(h => h[key]).sort((a, b) => a - b)
      return v[Math.floor(v.length / 2)] ?? 0
    },
  }
}

// What the expression is read from. Smile and frown come from MediaPipe's blendshape
// scores (0-1); raised brows and wide eyes are measured on the face points instead,
// because the blendshapes for them barely move on many faces.
export function readSignals(blendshapes, landmarks) {
  const s = {}
  for (const c of blendshapes?.categories || []) s[c.categoryName] = c.score
  const both = (name) => ((s[name + 'Left'] ?? 0) + (s[name + 'Right'] ?? 0)) / 2
  // Distances relative to the space between the eyes, so moving closer to the camera changes nothing
  const L = landmarks
  const eyes = Math.hypot(L[33].x - L[263].x, L[33].y - L[263].y) + 1e-6
  return {
    smile:    both('mouthSmile'),
    browDown: both('browDown'),
    // Brow above the upper eyelid, and upper to lower eyelid, both eyes averaged
    browLift: ((L[159].y - L[105].y) + (L[386].y - L[334].y)) / 2 / eyes,
    eyeOpen:  ((L[145].y - L[159].y) + (L[374].y - L[386].y)) / 2 / eyes,
  }
}

// Which expression the face shows. Thresholds were tuned on real interview recordings.
export function readExpression(signals, baseline) {
  if (signals.smile > 0.30) return 'smiling'
  if (!baseline.ready()) return 'neutral'
  const ratio = (k) => signals[k] / (baseline.median(k) || 1e-6)
  // Eyes clearly wider and brows higher than usual
  if (ratio('eyeOpen') >= 1.3 && ratio('browLift') >= 1.06) return 'surprised'
  if (signals.browDown - baseline.median('browDown') > 0.25) return 'serious'
  return 'neutral'
}

// The most common of the last few readings, so the label does not flicker while talking
export function steadyExpression(recent) {
  const latest = recent[recent.length - 1]
  const counts = {}
  for (const e of recent) counts[e] = (counts[e] || 0) + 1
  let best = latest
  for (const [e, n] of Object.entries(counts)) if (n > counts[best]) best = e
  return best
}

// Nod or shake from the last ~2 seconds of head angles: a clear back-and-forth on one axis
// while the other stays still
export function readGesture(poses) {
  if (poses.length < 5) return null
  const swing = (key) => {
    const v = poses.map(p => p[key])
    let turns = 0, dir = 0
    for (let i = 1; i < v.length; i++) {
      const d = v[i] - v[i - 1]
      if (Math.abs(d) < 1.5) continue
      const sign = Math.sign(d)
      if (dir && sign !== dir) turns++
      dir = sign
    }
    return { range: Math.max(...v) - Math.min(...v), turns }
  }
  const pitch = swing('pitch'), yaw = swing('yaw')
  if (pitch.range >= 7 && pitch.turns >= 2 && yaw.range < 6) return 'nod'
  if (yaw.range >= 10 && yaw.turns >= 2 && pitch.range < 6) return 'shake'
  return null
}

// Restless: the head keeps moving for the last ~1.6 seconds (shifting in the chair, leaning,
// drinking, looking around). Ordinary lively talking stays well below this. A short window
// shows the moment soon after it starts and drops it soon after it ends.
export function isRestless(poses) {
  if (poses.length < 7) return false
  let moved = 0
  for (let i = 1; i < poses.length; i++) {
    moved += Math.abs(poses[i].yaw - poses[i - 1].yaw) + Math.abs(poses[i].pitch - poses[i - 1].pitch)
  }
  return moved / (poses.length - 1) > 6   // degrees per reading, on average
}

// ── Timeline: one small number per moment, so a long interview stays a few KB ──
// bit 0: eye contact, bit 1: head facing the camera, bits 2-4: expression,
// bits 5-6: gesture, bit 7: answering, bit 8: restless. null means no face was seen.
export const TIMELINE_STEP_MS = 200

export function encodeMoment({ eye, steady, expression, gesture, answering, restless }) {
  const e = EXPRESSION_CODES[expression] ?? 0
  const g = Math.max(0, GESTURES.findIndex(x => x?.id === gesture))
  return (eye ? 1 : 0) | (steady ? 2 : 0) | (e << 2) | (g << 5) | (answering ? 128 : 0) | (restless ? 256 : 0)
}

export function decodeMoment(code) {
  if (code == null) return null
  return {
    eye:        !!(code & 1),
    steady:     !!(code & 2),
    expression: EXPRESSIONS.find(x => EXPRESSION_CODES[x.id] === ((code >> 2) & 7)) || EXPRESSIONS[0],
    gesture:    GESTURES[(code >> 5) & 3] || null,
    answering:  !!(code & 128),
    restless:   !!(code & 256),
  }
}

// ── Red zone: moments worth working on ──
// Only what an interviewer would notice. Glancing away for a second or two while thinking is
// normal, so looking away counts from 3 seconds; head movement while talking is not a mistake.
// gapSec: a glance back shorter than this does not end the moment.
export const ISSUES = {
  'look-away':   { label: 'Looked away while answering', short: 'Looking away', icon: '👀', minSec: 3,   gapSec: 0.6 },
  'turned-away': { label: 'Talked to the side',          short: 'Turned away',  icon: '↪️', minSec: 2,   gapSec: 0.6 },
  'restless':    { label: 'Restless movement',            short: 'Restless',     icon: '🌀', minSec: 1.5, gapSec: 1 },
}

const issueAt = {
  'look-away':   (m) => m.answering && !m.eye,
  'turned-away': (m) => m.answering && !m.steady,
  'restless':    (m) => m.restless,
}

// One moment is reported once, under its broadest cause: shifting in the chair also turns
// the head and moves the eyes, and a turned head also looks away
const COVERED_BY = {
  'look-away':   ['restless', 'turned-away'],
  'turned-away': ['restless'],
}

// Every red moment as { id, start, end } in seconds of the recording. A short gap (a glance
// back, a skipped frame) does not split one moment into two.
export function findIssues(timeline) {
  const samples = timeline?.samples || []
  const step = (timeline?.step || TIMELINE_STEP_MS) / 1000
  const found = []
  for (const [id, test] of Object.entries(issueAt)) {
    let run = null
    const close = () => {
      if (run && run.end - run.start >= ISSUES[id].minSec) found.push(run)
      run = null
    }
    samples.forEach((code, i) => {
      const m = decodeMoment(code)
      if (!m || !test(m)) return
      const t = i * step
      if (run && t - run.end <= ISSUES[id].gapSec) run.end = t + step
      else { close(); run = { id, start: t, end: t + step } }
    })
    close()
  }
  const overlaps = (a, b) => a.start < b.end && b.start < a.end
  return found
    .filter(x => !found.some(y => (COVERED_BY[x.id] || []).includes(y.id) && overlaps(x, y)))
    .sort((a, b) => a.start - b.start)
}

// Share of time per expression, nods, and the red moments, for the feedback summary
export function summarizeTimeline(timeline) {
  const moments = (timeline?.samples || []).map(decodeMoment).filter(Boolean)
  if (moments.length < 30) return null
  const expressions = EXPRESSIONS.map(x => ({
    ...x,
    pct: Math.round(100 * moments.filter(m => m.expression.id === x.id).length / moments.length),
  })).filter(x => x.pct > 0).sort((a, b) => b.pct - a.pct)
  // A gesture lasts several moments; count each run once
  let nods = 0
  moments.forEach((m, i) => { if (m.gesture?.id === 'nod' && moments[i - 1]?.gesture?.id !== 'nod') nods++ })
  const issues = findIssues(timeline)
  const byType = Object.keys(ISSUES)
    .map(id => ({ id, ...ISSUES[id], times: issues.filter(x => x.id === id).map(x => x.start) }))
    .filter(x => x.times.length)
  return { expressions, nods, issues: byType }
}

export function clockLabel(sec) {
  const s = Math.max(0, Math.floor(sec))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
