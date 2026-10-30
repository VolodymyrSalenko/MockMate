import { useState, useEffect } from 'react'
import { fetchSessions, fetchSessionDetail, deleteSession } from '../utils/api'
import { durationLabel } from '../utils/speechAnalytics'
import {
  scoreBg,
  formatDate, difficultyBadge, typeBadge, langInfo,
} from '../utils/scoring'

function langFlag(code) { return langInfo(code).flag }

// ── Progress bar ──────────────────────────────────────────────────────────────
function ProgressBar({ pct, color }) {
  return (
    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%`, transition: 'width 0.7s ease' }} />
    </div>
  )
}

// ── Face metrics panel ────────────────────────────────────────────────────────
function FacePanel({ session }) {
  const { eye_contact_pct: eye, head_stability_pct: head, face_confidence_score: conf } = session
  if (eye == null && head == null) return null
  return (
    <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800/60 rounded-2xl p-4 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-600 dark:text-slate-400 font-bold uppercase tracking-widest">👁 Body Language</p>
        {conf != null && (
          <span className={`text-sm font-black ${conf >= 7 ? 'text-emerald-400' : conf >= 4 ? 'text-yellow-400' : 'text-red-400'}`}>
            {parseFloat(conf).toFixed(1)}<span className="text-slate-600 text-xs font-normal">/10</span>
          </span>
        )}
      </div>
      {eye != null && (
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-600 dark:text-slate-400">Eye Contact</span>
            <span className={eye >= 70 ? 'text-emerald-400' : eye >= 40 ? 'text-yellow-400' : 'text-red-400'}>{eye}%</span>
          </div>
          <ProgressBar pct={eye} color={eye >= 70 ? 'bg-emerald-500' : eye >= 40 ? 'bg-amber-400' : 'bg-red-500'} />
        </div>
      )}
      {head != null && (
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-600 dark:text-slate-400">Head Stability</span>
            <span className={head >= 70 ? 'text-emerald-400' : head >= 40 ? 'text-yellow-400' : 'text-red-400'}>{head}%</span>
          </div>
          <ProgressBar pct={head} color={head >= 70 ? 'bg-emerald-500' : head >= 40 ? 'bg-amber-400' : 'bg-red-500'} />
        </div>
      )}
    </div>
  )
}

// ── Session detail (expanded) ─────────────────────────────────────────────────
function SessionDetail({ session }) {
  const [detail,  setDetail]  = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSessionDetail(session.id).then(d => { setDetail(d); setLoading(false) })
  }, [session.id])

  if (loading) return (
    <div className="flex justify-center py-6">
      <div className="w-5 h-5 rounded-full border-2 border-slate-700 border-t-emerald-500 animate-spin" />
    </div>
  )
  if (!detail) return <p className="text-slate-600 text-sm py-4 text-center">Could not load details.</p>

  return (
    <div className="mt-4 space-y-3 border-t border-slate-200 dark:border-slate-700/40 pt-4">

      {/* Meta tags */}
      {(detail.company_name || detail.candidate_name || (detail.language && detail.language !== 'en-US')) && (
        <div className="flex flex-wrap gap-2 text-xs">
          {detail.candidate_name && (
            <span className="glass border border-slate-200 dark:border-slate-700/40 rounded-full px-3 py-1 text-slate-600 dark:text-slate-400">👤 {detail.candidate_name}</span>
          )}
          {detail.company_name && (
            <span className="glass border border-slate-200 dark:border-slate-700/40 rounded-full px-3 py-1 text-slate-600 dark:text-slate-400">🏢 {detail.company_name}</span>
          )}
          {detail.language && detail.language !== 'en-US' && (
            <span className="glass border border-slate-200 dark:border-slate-700/40 rounded-full px-3 py-1 text-slate-600 dark:text-slate-400">
              {langFlag(detail.language)} {detail.language}
            </span>
          )}
        </div>
      )}

      {detail.summary && <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">{detail.summary}</p>}

      {/* Strength / Improvement */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {detail.top_strength && (
          <div className="bg-emerald-500/8 border border-emerald-500/20 rounded-2xl p-3">
            <p className="text-emerald-400 text-xs font-bold mb-1">🏆 Top Strength</p>
            <p className="text-emerald-200/80 text-xs leading-relaxed">{detail.top_strength}</p>
          </div>
        )}
        {detail.top_improvement && (
          <div className="bg-amber-500/8 border border-amber-500/20 rounded-2xl p-3">
            <p className="text-amber-400 text-xs font-bold mb-1">🎯 Top Improvement</p>
            <p className="text-amber-200/80 text-xs leading-relaxed">{detail.top_improvement}</p>
          </div>
        )}
      </div>

      {/* Face */}
      <FacePanel session={detail} />

      {/* Per-answer breakdown */}
      {detail.answers?.length > 0 && (
        <div className="space-y-2">
          <p className="text-slate-600 dark:text-slate-400 text-xs font-bold uppercase tracking-widest">Answer Breakdown</p>
          {detail.answers.map((a, i) => {
            const fillers = a.filler_counts
              ? Object.entries(a.filler_counts).sort((x, y) => y[1] - x[1]).slice(0, 3)
              : []
            return (
              <div key={i} className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800/60 rounded-2xl p-3">
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 ${
                    a.score >= 8 ? 'bg-emerald-500/20 text-emerald-400' :
                    a.score >= 5 ? 'bg-yellow-400/20 text-yellow-300' : 'bg-red-500/20 text-red-400'
                  }`}>{a.score != null ? Math.round(a.score) : '–'}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-600 dark:text-slate-300 text-xs font-semibold mb-1 leading-relaxed">{a.question}</p>
                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                      {a.wpm > 0 && (
                        <span className={`text-xs font-medium ${a.wpm >= 110 && a.wpm <= 170 ? 'text-emerald-400' : 'text-yellow-400'}`}>{a.wpm} wpm</span>
                      )}
                      {a.word_count > 0 && <span className="text-xs text-slate-600 dark:text-slate-400">{a.word_count} words</span>}
                      {a.total_fillers != null && (
                        <span className={`text-xs ${a.total_fillers === 0 ? 'text-emerald-400' : a.total_fillers <= 3 ? 'text-yellow-400' : 'text-red-400'}`}>
                          {a.total_fillers} fillers
                        </span>
                      )}
                    </div>
                    {fillers.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {fillers.map(([word, count]) => (
                          <span key={word} className="text-xs bg-orange-500/10 border border-orange-500/20 text-orange-300 px-2 py-0.5 rounded-full">
                            "{word}" ×{count}
                          </span>
                        ))}
                      </div>
                    )}
                    {[a.star_s, a.star_t, a.star_a, a.star_r].some(v => v != null) && (
                      <div className="flex items-center gap-1 mt-1.5">
                        <span className="text-slate-600 text-xs">STAR:</span>
                        {[['S', a.star_s], ['T', a.star_t], ['A', a.star_a], ['R', a.star_r]].map(([l, v]) => (
                          <span key={l} className={`text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full ${v ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-600'}`}>{l}</span>
                        ))}
                        {a.star_score != null && <span className="text-slate-600 text-xs ml-1">{a.star_score}/4</span>}
                      </div>
                    )}
                    {a.feedback && <p className="text-slate-600 dark:text-slate-400 text-xs mt-1.5 leading-relaxed">{a.feedback}</p>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Session card ──────────────────────────────────────────────────────────────
function SessionCard({ session, index, onDelete }) {
  const [open,       setOpen]       = useState(false)
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
      <button onClick={() => setOpen(o => !o)} className="flex-1 min-w-0 flex items-center gap-3 p-4 text-left">
        <div className={`w-11 h-11 rounded-full flex items-center justify-center text-sm font-black flex-shrink-0 border ${scoreBg(score)}`}>
          {score != null ? parseFloat(score).toFixed(1) : '–'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-slate-700 dark:text-slate-200 text-sm font-semibold truncate">{session.role || 'Interview'}</p>
            {session.face_confidence_score != null && (
              <span className="text-xs text-slate-500">👁 {parseFloat(session.face_confidence_score).toFixed(1)}</span>
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
        <span className="text-slate-600 dark:text-slate-400 text-xs flex-shrink-0">{open ? '▲' : '▼'}</span>
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

      {open && (
        <div className="px-4 pb-4">
          <SessionDetail session={session} />
        </div>
      )}
    </div>
  )
}

// ── Main Sessions page ────────────────────────────────────────────────────────
export default function Sessions({ onNavigate }) {
  const [sessions, setSessions] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [filter,   setFilter]   = useState('All')
  const [search,   setSearch]   = useState('')

  useEffect(() => {
    fetchSessions().then(data => { setSessions(data); setLoading(false) })
  }, [])

  const handleDelete = async (id) => {
    if (await deleteSession(id)) setSessions(list => list.filter(s => s.id !== id))
  }

  const visible = sessions
    .filter(s => filter === 'All' || s.difficulty === filter)
    .filter(s => !search || (s.role || '').toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 relative overflow-hidden">
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="animate-orb absolute top-0 right-0 w-96 h-96 rounded-full bg-emerald-500/6 blur-3xl" />
        <div className="animate-orb-r absolute bottom-0 left-0 w-80 h-80 rounded-full bg-cyan-500/5 blur-3xl" />
      </div>

      <div className="relative z-10 p-6 sm:p-8 max-w-4xl mx-auto space-y-6">

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
                {visible.map((s, i) => <SessionCard key={s.id} session={s} index={i} onDelete={handleDelete} />)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
