import { getUserId } from './userId'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

/**
 * Save a completed session + answers to PostgreSQL.
 * Called from Debrief.jsx after the debrief data arrives.
 *
 * @param {object} debrief   - response from /debrief endpoint
 * @param {Array}  qaPairs   - [{question, answer, analytics}] from Interview
 * @param {string} role      - job role
 * @param {string} difficulty
 * @param {string} interviewType
 * @param {number} duration  - total session seconds
 * @returns {Promise<number|null>} the new session_id, or null on error
 */
export async function saveSessionToDB(debrief, qaPairs, role, difficulty, interviewType, duration) {
  try {
    const answers = (debrief.answers || []).map((a, i) => ({
      question_index: i,
      question:       a.question      || qaPairs[i]?.question || '',
      answer:         a.answer_summary || qaPairs[i]?.answer  || '',
      score:          a.score,
      feedback:       a.feedback,
      tip:            a.tip,
      ideal_answer:   a.ideal_answer,
      analytics:      qaPairs[i]?.analytics || null,
    }))

    const res = await fetch(`${BACKEND_URL}/sessions`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id:          getUserId(),
        role:             role             || 'the position',
        difficulty:       difficulty       || 'Mid',
        interview_type:   interviewType    || 'full',
        overall_score:    debrief.overall_score,
        duration_seconds: duration         || 0,
        summary:          debrief.summary,
        top_strength:     debrief.top_strength,
        top_improvement:  debrief.top_improvement,
        answers,
      }),
    })

    if (!res.ok) return null
    const data = await res.json()
    return data.session_id
  } catch {
    // Never crash the UI if DB save fails
    return null
  }
}

/**
 * Fetch all sessions for the current user (list view — no answers).
 * @returns {Promise<Array>}
 */
export async function fetchSessions() {
  try {
    const res = await fetch(`${BACKEND_URL}/sessions?user_id=${getUserId()}`)
    if (!res.ok) return []
    const data = await res.json()
    return data.sessions || []
  } catch {
    return []
  }
}

/**
 * Fetch one session with full answer detail.
 * @param {number} sessionId
 * @returns {Promise<object|null>}
 */
export async function fetchSessionDetail(sessionId) {
  try {
    const res = await fetch(`${BACKEND_URL}/sessions/${sessionId}?user_id=${getUserId()}`)
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

/**
 * Fetch the stored CV profile for the current user.
 * Returns null if none exists yet.
 * @returns {Promise<{parsed: object, filename: string, raw_text: string, updated_at: string}|null>}
 */
export async function fetchCVProfile() {
  try {
    const res = await fetch(`${BACKEND_URL}/cv-profile?user_id=${getUserId()}`)
    if (res.status === 404) return null
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

/**
 * Upload a CV file, parse it with AI, and store it for the current user.
 * @param {File} file
 * @returns {Promise<{parsed: object, filename: string}>}
 */
export async function uploadCVProfile(file) {
  const form = new FormData()
  form.append('user_id', getUserId())
  form.append('file', file)
  const res = await fetch(`${BACKEND_URL}/cv-profile`, { method: 'POST', body: form })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || 'Upload failed')
  }
  return await res.json()
}
