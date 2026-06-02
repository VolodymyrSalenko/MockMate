import { useState, useEffect } from 'react'
import { fetchSessions, fetchSessionDetail } from '../utils/api'
import { durationLabel } from '../utils/speechAnalytics'
import {
  scoreBg, scoreHex as scoreGradient, aiColor, aiBg,
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
    <div className="bg-slate-900/50 border border-slate-800/60 rounded-2xl p-4 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">👁 Body Language</p>
        {conf != null && (
          <span className={`text-sm font-black ${conf >= 7 ? 'text-emerald-400' : conf >= 4 ? 'text-yellow-400' : 'text-red-400'}`}>
            {parseFloat(conf).toFixed(1)}<span className="text-slate-600 text-xs font-normal">/10</span>
          </span>
        )}
      </div>
      {eye != null && (
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-400">Eye Contact</span>
            <span className={eye >= 70 ? 'text-emerald-400' : eye >= 40 ? 'text-yellow-400' : 'text-red-400'}>{eye}%</span>
          </div>
          <ProgressBar pct={eye} color={eye >= 70 ? 'bg-emerald-500' : eye >= 40 ? 'bg-amber-400' : 'bg-red-500'} />
        </div>
      )}
      {head != null && (
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-400">Head Stability</span>
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
    <div className="mt-4 space-y-3 border-t border-slate-700/40 pt-4">

      {/* Meta tags */}
      {(detail.company_name || detail.candidate_name || (detail.language && detail.language !== 'en-US')) && (
        <div className="flex flex-wrap gap-2 text-xs">
          {detail.candidate_name && (
            <span className="glass border border-slate-700/40 rounded-full px-3 py-1 text-slate-400">👤 {detail.candidate_name}</span>
          )}
          {detail.company_name && (
            <span className="glass border border-slate-700/40 rounded-full px-3 py-1 text-slate-400">🏢 {detail.company_name}</span>
          )}
          {detail.language && detail.language !== 'en-US' && (
            <span className="glass border border-slate-700/40 rounded-full px-3 py-1 text-slate-400">
              {langFlag(detail.language)} {detail.language}
            </span>
          )}
        </div>
      )}

      {detail.summary && <p className="text-slate-400 text-sm leading-relaxed">{detail.summary}</p>}

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

      {/* AI score + Face */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {detail.ai_score != null && (
          <div className="bg-slate-900/50 border border-slate-800/60 rounded-2xl p-4">
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-2">🤖 AI Score</p>
            <div className="flex items-center gap-3">
              <span className={`text-2xl font-black ${aiColor(detail.ai_score)}`}>
                {Math.round(detail.ai_score)}<span className="text-slate-600 text-sm font-normal">/100</span>
              </span>
              {detail.ai_verdict && <p className="text-slate-400 text-xs leading-relaxed">{detail.ai_verdict}</p>}
            </div>
          </div>
        )}
        <FacePanel session={detail} />
      </div>

      {/* Per-answer breakdown */}
      {detail.answers?.length > 0 && (
        <div className="space-y-2">
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Answer Breakdown</p>
          {detail.answers.map((a, i) => {
            const fillers = a.filler_counts
              ? Object.entries(a.filler_counts).sort((x, y) => y[1] - x[1]).slice(0, 3)
              : []
            return (
              <div key={i} className="bg-slate-900/50 border border-slate-800/60 rounded-2xl p-3">
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 ${
                    a.score >= 8 ? 'bg-emerald-500/20 text-emerald-400' :
                    a.score >= 5 ? 'bg-yellow-400/20 text-yellow-300' : 'bg-red-500/20 text-red-400'
                  }`}>{a.score != null ? Math.round(a.score) : '–'}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-300 text-xs font-semibold mb-1 leading-relaxed">{a.question}</p>
                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                      {a.wpm > 0 && (
                        <span className={`text-xs font-medium ${a.wpm >= 110 && a.wpm <= 170 ? 'text-emerald-400' : 'text-yellow-400'}`}>{a.wpm} wpm</span>
                      )}
                      {a.word_count > 0 && <span className="text-xs text-slate-600">{a.word_count} words</span>}
                      {a.total_fillers != null && (
                        <span className={`text-xs ${a.total_fillers === 0 ? 'text-emerald-400' : a.total_fillers <= 3 ? 'text-yellow-400' : 'text-red-400'}`}>
                          {a.total_fillers} fillers
                        </span>
                      )}
                      {a.ai_answer_score != null && (
                        <span className={`text-xs font-semibold ${aiColor(a.ai_answer_score * 5)}`}>AI {Math.round(a.ai_answer_score)}/20</span>
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
                    {a.feedback && <p className="text-slate-500 text-xs mt-1.5 leading-relaxed">{a.feedback}</p>}
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
function SessionCard({ session, index }) {
  const [open, setOpen] = useState(false)
  const score = session.overall_score
  const flag  = langFlag(session.language)

  return (
    <div
      className="glass border border-slate-700/40 rounded-2xl overflow-hidden hover:border-slate-600/60 transition-all duration-300"
      style={{ animationDelay: `${index * 0.04}s` }}
    >
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-3 p-4 text-left">
        <div className={`w-11 h-11 rounded-full flex items-center justify-center text-sm font-black flex-shrink-0 border ${scoreBg(score)}`}>
          {score != null ? parseFloat(score).toFixed(1) : '–'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-slate-200 text-sm font-semibold truncate">{session.role || 'Interview'}</p>
            {session.ai_score != null && (
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${aiBg(session.ai_score)}`}>
                AI {Math.round(session.ai_score)}
              </span>
            )}
            {session.face_confidence_score != null && (
              <span className="text-xs text-slate-500">👁 {parseFloat(session.face_confidence_score).toFixed(1)}</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-0.5">
            <span className="text-slate-500 text-xs">{formatDate(session.created_at)}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${difficultyBadge(session.difficulty)}`}>{session.difficulty || 'Mid'}</span>
            <span className="text-slate-600 text-xs">{typeBadge(session.interview_type)}</span>
            {session.duration_seconds > 0 && (
              <span className="text-slate-600 text-xs">⏱ {durationLabel(session.duration_seconds)}</span>
            )}
            {flag && flag !== '🇬🇧' && <span className="text-xs">{flag}</span>}
          </div>
        </div>
        <span className="text-slate-600 text-xs flex-shrink-0">{open ? '▲' : '▼'}</span>
      </button>

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

  const visible = sessions
    .filter(s => filter === 'All' || s.difficulty === filter)
    .filter(s => !search || (s.role || '').toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="min-h-screen bg-slate-950 relative overflow-hidden">
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="animate-orb absolute top-0 right-0 w-96 h-96 rounded-full bg-emerald-500/6 blur-3xl" />
        <div className="animate-orb-r absolute bottom-0 left-0 w-80 h-80 rounded-full bg-cyan-500/5 blur-3xl" />
      </div>

      <div className="relative z-10 p-6 sm:p-8 max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-white">Your Sessions</h1>
            <p className="text-slate-500 text-sm mt-1">
              {loading ? 'Loading…' : `${sessions.length} interview${sessions.length !== 1 ? 's' : ''} completed`}
            </p>
          </div>
          <button
            onClick={() => onNavigate('landing')}
            className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold px-5 py-2.5 rounded-2xl transition-all hover:scale-105 shadow-lg shadow-emerald-500/30 whitespace-nowrap text-sm"
          >
            <span>🎙</span>
            New Interview
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-24">
            <div className="relative w-14 h-14">
              <div className="absolute inset-0 rounded-full border-4 border-emerald-500/20 animate-ping" />
              <div className="w-14 h-14 rounded-full border-4 border-slate-800 border-t-emerald-500 animate-spin" />
            </div>
          </div>
        ) : sessions.length === 0 ? (
          <div className="glass border border-slate-700/40 rounded-2xl p-12 flex flex-col items-center gap-4 text-center">
            <span className="text-5xl">🎙</span>
            <p className="text-white font-bold text-lg">No interviews yet</p>
            <p className="text-slate-500 text-sm max-w-xs">Complete your first interview and your results will appear here.</p>
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
                        : 'glass border border-slate-700/40 text-slate-500 hover:text-slate-300'
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
                className="flex-1 bg-slate-900/70 border border-slate-700/60 rounded-xl px-4 py-2 text-slate-300 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 text-sm"
              />
            </div>

            {/* Count */}
            <p className="text-slate-600 text-xs">
              Showing {visible.length} of {sessions.length} session{sessions.length !== 1 ? 's' : ''}
            </p>

            {/* List */}
            {visible.length === 0 ? (
              <p className="text-slate-600 text-sm text-center py-8">No sessions match your filter.</p>
            ) : (
              <div className="space-y-3">
                {visible.map((s, i) => <SessionCard key={s.id} session={s} index={i} />)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
