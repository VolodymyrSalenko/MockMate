import { useState, useEffect } from 'react'
import { fetchSessions, fetchSessionDetail, deleteSession } from '../utils/api'
import { getRecording, deleteRecording } from '../utils/recordingStore'
import Debrief from './Debrief'
import { durationLabel } from '../utils/speechAnalytics'
import {
  scoreBg,
  formatDate, difficultyBadge, typeBadge, langInfo, to100,
} from '../utils/scoring'

function langFlag(code) { return langInfo(code).flag }

// ── One saved session, shown as the full debrief ─────────────────────────────
// Sessions saved before full reports were stored only have the per-answer basics
function reportFromColumns(detail) {
  return {
    debrief: {
      overall_score:   detail.overall_score,
      summary:         detail.summary,
      top_strength:    detail.top_strength,
      top_improvement: detail.top_improvement,
      answers: (detail.answers || []).map(a => ({
        question:       a.question,
        answer_summary: a.answer,
        score:          a.score,
        feedback:       a.feedback,
        tip:            a.tip,
        ideal_answer:   a.ideal_answer,
      })),
    },
    qa_pairs: [],
  }
}

function SavedSession({ session, onBack }) {
  const [detail,    setDetail]    = useState(null)
  const [failed,    setFailed]    = useState(false)
  const [recording, setRecording] = useState(null)

  useEffect(() => {
    fetchSessionDetail(session.id).then(d => (d ? setDetail(d) : setFailed(true)))
    let url = null
    getRecording(session.id).then(blob => {
      if (blob) { url = URL.createObjectURL(blob); setRecording(url) }
    })
    return () => { if (url) URL.revokeObjectURL(url) }
  }, [session.id])

  if (failed) return (
    <div className="p-8 text-center space-y-4">
      <p className="text-slate-600 dark:text-slate-400 text-sm">Could not load this session.</p>
      <button onClick={onBack} className="text-sm font-semibold text-emerald-500">← Back to sessions</button>
    </div>
  )
  if (!detail) return (
    <div className="flex justify-center py-24">
      <div className="w-8 h-8 rounded-full border-4 border-slate-200 dark:border-slate-800 border-t-emerald-500 animate-spin" />
    </div>
  )

  const report  = detail.report || reportFromColumns(detail)
  // Retries are stored per answer, apart from the report
  const debrief = {
    ...report.debrief,
    answers: (report.debrief.answers || []).map((a, i) => ({
      ...a,
      retries: detail.answers?.find(x => x.question_index === i)?.retries || [],
    })),
  }

  return (
    <Debrief
      saved={{ id: detail.id, createdAt: detail.created_at, debrief }}
      onBack={onBack}
      qaPairs={report.qa_pairs || []}
      role={detail.role}
      difficulty={detail.difficulty}
      interviewType={report.interview_type || detail.interview_type}
      language={report.language || detail.language}
      questionPlan={report.question_plan || []}
      interviewer={report.interviewer}
      duration={report.duration ?? detail.duration_seconds}
      faceMetrics={report.face_metrics}
      recording={recording}
    />
  )
}

// ── Session card ──────────────────────────────────────────────────────────────
function SessionCard({ session, index, onOpen, onDelete }) {
  const [confirming, setConfirming] = useState(false)
  const [deleting,   setDeleting]   = useState(false)
  const score = session.overall_score
  const flag  = langFlag(session.language)

  return (
    <div
      className="group glass border border-slate-200 dark:border-slate-700/40 rounded-2xl overflow-hidden hover:border-slate-400 dark:hover:border-slate-600/60 transition-all duration-300"
      style={{ animationDelay: `${index * 0.04}s` }}
    >
      <div className="flex items-center pr-3">
      <button onClick={onOpen} className="flex-1 min-w-0 flex items-center gap-3 p-4 text-left">
        <div className={`w-11 h-11 rounded-full flex items-center justify-center text-sm font-black flex-shrink-0 border ${scoreBg(score)}`}>
          {score != null ? to100(score) : '–'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-slate-700 dark:text-slate-200 text-sm font-semibold truncate">{session.role || 'Interview'}</p>
            {session.eye_contact_pct != null && (
              <span className="text-xs text-slate-500" title="Eye contact">👁 {session.eye_contact_pct}%</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-0.5">
            <span className="text-slate-600 dark:text-slate-400 text-xs">{formatDate(session.created_at)}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${difficultyBadge(session.difficulty)}`}>{session.difficulty || 'Mid'}</span>
            <span className="text-slate-600 dark:text-slate-400 text-xs">{typeBadge(session.interview_type)}</span>
            {session.duration_seconds > 0 && (
              <span className="text-slate-600 dark:text-slate-400 text-xs">⏱ {durationLabel(session.duration_seconds)}</span>
            )}
            {flag && flag !== '🇬🇧' && <span className="text-xs">{flag}</span>}
          </div>
        </div>
        <span className="text-slate-500 text-xs font-semibold flex-shrink-0">Open →</span>
      </button>

      {/* Delete, with a confirmation step */}
      {confirming ? (
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className="text-slate-500 dark:text-slate-400 text-xs">Delete?</span>
          <button
            onClick={async () => { setDeleting(true); await onDelete(session.id); setDeleting(false); setConfirming(false) }}
            disabled={deleting}
            className="text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 text-xs font-bold px-2 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 transition-colors disabled:opacity-50"
          >
            {deleting ? '…' : 'Yes'}
          </button>
          <button
            onClick={() => setConfirming(false)}
            className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-xs px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/40 transition-colors"
          >
            No
          </button>
        </div>
      ) : (
        <button
          onClick={() => setConfirming(true)}
          title="Delete session"
          className="sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-all flex-shrink-0 p-2 rounded-lg hover:bg-red-500/10"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      )}
      </div>
    </div>
  )
}

// ── Main Sessions page ────────────────────────────────────────────────────────
export default function Sessions({ onNavigate }) {
  const [sessions, setSessions] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [filter,   setFilter]   = useState('All')
  const [search,   setSearch]   = useState('')
  const [opened,   setOpened]   = useState(null)

  useEffect(() => {
    fetchSessions().then(data => { setSessions(data); setLoading(false) })
  }, [])

  const handleDelete = async (id) => {
    if (await deleteSession(id)) {
      deleteRecording(id)
      setSessions(list => list.filter(s => s.id !== id))
    }
  }

  if (opened) return <SavedSession session={opened} onBack={() => setOpened(null)} />

  const visible = sessions
    .filter(s => filter === 'All' || s.difficulty === filter)
    .filter(s => !search || (s.role || '').toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 relative overflow-hidden">
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="animate-orb absolute top-0 right-0 w-96 h-96 rounded-full bg-emerald-500/6 blur-3xl" />
        <div className="animate-orb-r absolute bottom-0 left-0 w-80 h-80 rounded-full bg-cyan-500/5 blur-3xl" />
      </div>

      <div className="relative z-10 p-6 sm:p-8 max-w-5xl 2xl:max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white">Your Sessions</h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">
            {loading ? 'Loading…' : `${sessions.length} interview${sessions.length !== 1 ? 's' : ''} completed`}
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-24">
            <div className="relative w-14 h-14">
              <div className="absolute inset-0 rounded-full border-4 border-emerald-500/20 animate-ping" />
              <div className="w-14 h-14 rounded-full border-4 border-slate-800 border-t-emerald-500 animate-spin" />
            </div>
          </div>
        ) : sessions.length === 0 ? (
          <div className="glass border border-slate-200 dark:border-slate-700/40 rounded-2xl p-12 flex flex-col items-center gap-4 text-center">
            <span className="text-5xl">🎙</span>
            <p className="text-slate-900 dark:text-white font-bold text-lg">No interviews yet</p>
            <p className="text-slate-600 dark:text-slate-400 text-sm max-w-xs">Complete your first interview and your results will appear here.</p>
            <button
              onClick={() => onNavigate('landing')}
              className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold px-6 py-2.5 rounded-xl hover:scale-105 transition-all shadow-lg shadow-emerald-500/30 text-sm"
            >
              Start your first interview
            </button>
          </div>
        ) : (
          <>
            {/* Filters + search */}
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
              <div className="flex gap-1.5">
                {['All', 'Junior', 'Mid', 'Senior'].map(f => (
                  <button key={f} onClick={() => setFilter(f)}
                    className={`text-xs px-3 py-1.5 rounded-xl font-semibold transition-all ${
                      filter === f
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'glass border border-slate-200 dark:border-slate-700/40 text-slate-500 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}>
                    {f}
                  </button>
                ))}
              </div>
              <input
                type="text"
                placeholder="Search by role…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="flex-1 bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700/60 rounded-xl px-4 py-2 text-slate-600 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 text-sm"
              />
            </div>

            {/* Count */}
            <p className="text-slate-600 dark:text-slate-400 text-xs">
              Showing {visible.length} of {sessions.length} session{sessions.length !== 1 ? 's' : ''}
            </p>

            {/* List */}
            {visible.length === 0 ? (
              <p className="text-slate-600 dark:text-slate-400 text-sm text-center py-8">No sessions match your filter.</p>
            ) : (
              <div className="space-y-3">
                {visible.map((s, i) => <SessionCard key={s.id} session={s} index={i} onOpen={() => setOpened(s)} onDelete={handleDelete} />)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
