// The feedback request for an interview. The interview starts it while the interviewer says
// goodbye; the feedback screen then picks up the same request instead of asking again.
import { BACKEND_URL } from './config'
import { getStoredToken } from '../context/AuthContext'

let pending = null   // { key, promise } of the latest request

// The request body, or null when there is no answer to evaluate
export function feedbackRequestBody({ qaPairs, questionPlan = [], role, language = 'en-US', difficulty, interviewType, requirements, cvSummary }) {
  // Each pair carries the follow-up exchange (if any) and the question's hidden rubric
  const pairs = qaPairs
    .map(({ question, answer, first_answer, followup_question, cut_off }, i) => ({
      question: question || '',
      answer: answer || '',
      first_answer: first_answer || null,
      followup_question: followup_question || null,
      cut_off: Boolean(cut_off),
      competency: questionPlan[i]?.competency || null,
      strong_answer: questionPlan[i]?.strong_answer || null,
    }))
    .filter((p) => p.question && p.answer)
  if (pairs.length === 0) return null
  return {
    qa_pairs: pairs,
    role: role || 'the position',
    // The backend expects en-US, de-DE, fr-FR
    language: language.includes('-') ? language : `${language}-US`,
    difficulty,
    interview_type: interviewType,
    requirements,
    cv_summary: cvSummary,
  }
}

// Resolves to the feedback JSON; the same body twice shares one request
export function requestFeedback(body) {
  const key = JSON.stringify(body)
  if (pending?.key === key) return pending.promise
  const promise = fetch(`${BACKEND_URL}/debrief`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getStoredToken()}` },
    body: key,
  }).then((res) => {
    if (!res.ok) throw new Error('Failed to get feedback')
    return res.json()
  })
  pending = { key, promise }
  // A failed request is not reused: the feedback screen asks again
  promise.catch(() => { if (pending?.key === key) pending = null })
  return promise
}
