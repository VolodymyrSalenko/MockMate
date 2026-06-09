import { BACKEND_URL } from './config'
import { getStoredToken } from '../context/AuthContext'

function authHeaders(extra = {}) {
  const token = getStoredToken()
  return { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra }
}

// ── Admin API ──────────────────────────────────────────────────────────────────

function adminHeaders() {
  const token = getStoredToken()
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
}

export async function adminListUsers(search = '', page = 1) {
  const params = new URLSearchParams({ page, limit: 25 })
  if (search) params.set('search', search)
  const res = await fetch(`${BACKEND_URL}/admin/users?${params}`, { headers: adminHeaders() })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || 'Failed')
  return res.json()
}

export async function adminSetPlan(userId, plan) {
  const res = await fetch(`${BACKEND_URL}/admin/users/${userId}/plan`, {
    method: 'PATCH', headers: adminHeaders(), body: JSON.stringify({ plan }),
  })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || 'Failed')
  return res.json()
}

export async function adminSetAdmin(userId, is_admin) {
  const res = await fetch(`${BACKEND_URL}/admin/users/${userId}/admin`, {
    method: 'PATCH', headers: adminHeaders(), body: JSON.stringify({ is_admin }),
  })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || 'Failed')
  return res.json()
}

export async function adminDeleteUser(userId) {
  const res = await fetch(`${BACKEND_URL}/admin/users/${userId}`, {
    method: 'DELETE', headers: adminHeaders(),
  })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || 'Failed')
  return res.json()
}

// ── Auth / consent ─────────────────────────────────────────────────────────────

export async function setAIConsent(consent) {
  const token = getStoredToken()
  if (!token) return
  await fetch(`${BACKEND_URL}/auth/ai-consent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ consent }),
  })
}

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
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
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
    const res = await fetch(`${BACKEND_URL}/sessions`, { headers: authHeaders() })
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
    const res = await fetch(`${BACKEND_URL}/sessions/filler-stats`, { headers: authHeaders() })
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
    const res = await fetch(`${BACKEND_URL}/sessions/${sessionId}`, {
      method: 'DELETE',
      headers: authHeaders(),
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
    const res = await fetch(`${BACKEND_URL}/sessions/${sessionId}`, { headers: authHeaders() })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

/**
 * Run AI analysis on the user's stored CV (Pro only).
 * Throws Error('pro_required') if user is not on Pro plan.
 * @returns {Promise<object>}
 */
export async function analyseCV() {
  const res = await fetch(`${BACKEND_URL}/analyse-cv`, { method: 'POST', headers: authHeaders() })
  if (res.status === 403) throw new Error('pro_required')
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || 'Analysis failed')
  }
  return await res.json()
}

/**
 * Fetch the stored CV profile for the current user.
 * Returns null if none exists yet.
 * @returns {Promise<{parsed: object, filename: string, raw_text: string, updated_at: string}|null>}
 */
export async function fetchCVProfile() {
  try {
    const res = await fetch(`${BACKEND_URL}/cv-profile`, { headers: authHeaders() })
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
  form.append('file', file)
  const res = await fetch(`${BACKEND_URL}/cv-profile`, { method: 'POST', headers: authHeaders(), body: form })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || 'Upload failed')
  }
  return await res.json()
}
