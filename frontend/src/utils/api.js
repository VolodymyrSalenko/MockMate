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
export async function saveSessionToDB(debrief, qaPairs, role, difficulty, interviewType, duration, opts = {}) {
  try {
    const answers = (debrief.answers || []).map((a, i) => ({
      question_index:  i,
      question:        a.question       || qaPairs[i]?.question || '',
      answer:          a.answer_summary || qaPairs[i]?.answer   || '',
      score:           a.score,
      feedback:        a.feedback,
      tip:             a.tip,
      ideal_answer:    a.ideal_answer,
      analytics:       qaPairs[i]?.analytics || null,
      ai_answer_score: debrief.ai_detailed?.[i]?.score ?? null,
    }))

    const fm = opts.faceMetrics
    const face_metrics = (fm && fm.samplesCount >= 30) ? {
      eye_contact_pct:       fm.eyeContactPct,
      head_stability_pct:    fm.headStabilityPct,
      face_confidence_score: fm.confidenceScore,
      face_samples_count:    fm.samplesCount,
    } : null

    const res = await fetch(`${BACKEND_URL}/sessions`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id:          getUserId(),
        role:             role           || 'the position',
        difficulty:       difficulty     || 'Mid',
        interview_type:   interviewType  || 'full',
        overall_score:    debrief.overall_score,
        duration_seconds: duration       || 0,
        summary:          debrief.summary,
        top_strength:     debrief.top_strength,
        top_improvement:  debrief.top_improvement,
        answers,
        language:         opts.language      || 'en-US',
        company_name:     opts.companyName   || null,
        candidate_name:   opts.candidateName || null,
        ai_score:         opts.aiScore       ?? null,
        ai_verdict:       opts.aiVerdict     || null,
        face_metrics,
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
 * Fetch aggregated top filler words for the current user.
 * @returns {Promise<Array<{word: string, count: number}>>}
 */
export async function fetchFillerStats() {
  try {
    const res = await fetch(`${BACKEND_URL}/sessions/filler-stats?user_id=${getUserId()}`)
    if (!res.ok) return []
    const data = await res.json()
    return data.fillers || []
  } catch {
    return []
  }
}

/**
 * Delete a session (and its answers via CASCADE).
 * @param {number} sessionId
 * @returns {Promise<boolean>}
 */
export async function deleteSession(sessionId) {
  try {
    const res = await fetch(`${BACKEND_URL}/sessions/${sessionId}?user_id=${getUserId()}`, {
      method: 'DELETE',
    })
    return res.ok
  } catch { return false }
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
