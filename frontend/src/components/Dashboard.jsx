import { useState, useEffect } from 'react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts'
import { fetchSessions } from '../utils/api'
import { durationLabel } from '../utils/speechAnalytics'
import { useAuth } from '../context/AuthContext'

// ── Helpers ───────────────────────────────────────────────────────────────────
function scoreBg(s) {
  return s >= 8
    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
    : s >= 5
    ? 'bg-yellow-400/20 text-yellow-300 border-yellow-400/30'
    : 'bg-red-500/20 text-red-400 border-red-500/30'
}
function scoreGradient(s) { return s >= 8 ? '#10b981' : s >= 5 ? '#f59e0b' : '#ef4444' }
function scoreColor(s)    { return s >= 8 ? 'text-emerald-400' : s >= 5 ? 'text-yellow-400' : 'text-red-400' }
function aiColor(s)       { return s >= 75 ? 'text-emerald-400' : s >= 50 ? 'text-yellow-400' : 'text-red-400' }
function aiBg(s) {
  return s >= 75
    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
    : s >= 50
    ? 'bg-yellow-400/20 text-yellow-300 border-yellow-400/30'
    : 'bg-red-500/20 text-red-400 border-red-500/30'
}
function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
function formatShort(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
function difficultyBadge(d) {
  const map = { Junior: 'text-sky-400 bg-sky-500/10', Mid: 'text-violet-400 bg-violet-500/10', Senior: 'text-amber-400 bg-amber-500/10' }
  return map[d] || 'text-slate-400 bg-slate-500/10'
}
function typeBadge(t) {
  const map = { full: '🎯 Full', behavioral: '🌟 Behavioral', technical: '⚡ Technical', screening: '📞 Screening', practice: '🎯 Practice' }
  return map[t] || t || '—'
}
function langFlag(code) {
  return { 'en-US': '🇬🇧', 'de-DE': '🇩🇪', 'fr-FR': '🇫🇷' }[code] || null
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub, color = 'text-white' }) {
  return (
    <div className="glass border border-slate-700/40 rounded-2xl p-5 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-lg">{icon}</span>
        <span className="text-slate-500 text-xs font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <p className={`text-3xl font-black ${color}`}>{value}</p>
      {sub && <p className="text-slate-600 text-xs">{sub}</p>}
    </div>
  )
}

// ── Score over time chart ─────────────────────────────────────────────────────
const TOOLTIP_STYLE = {
  backgroundColor: 'rgba(15,23,42,0.95)',
  border: '1px solid rgba(51,65,85,0.6)',
  borderRadius: 12,
  backdropFilter: 'blur(12px)',
}

function ScoreChart({ sessions }) {
  const data = [...sessions]
    .reverse()
    .filter(s => s.overall_score != null)
    .slice(-10)
    .map(s => ({
      date:  formatShort(s.created_at),
      score: parseFloat(parseFloat(s.overall_score).toFixed(1)),
      role:  s.role || '',
    }))

  return (
    <div className="glass border border-slate-700/40 rounded-2xl p-6 h-full">
      <div className="flex items-center justify-between mb-1">
        <p className="text-white font-bold">Score Progression</p>
        <span className="text-slate-500 text-xs">Last {data.length} interviews</span>
      </div>
      <p className="text-slate-600 text-xs mb-5">Your content score trend over time</p>

      {data.length < 2 ? (
        <div className="flex items-center justify-center h-36 text-slate-600 text-sm">
          Complete interviews to see your trend
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <XAxis dataKey="date" tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 10]} ticks={[0, 5, 10]} tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} />
            <ReferenceLine y={7} stroke="rgba(16,185,129,0.2)" strokeDasharray="4 4" />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              labelStyle={{ color: '#e2e8f0', fontWeight: 700, fontSize: 11 }}
              itemStyle={{ color: '#94a3b8', fontSize: 11 }}
              formatter={(v, _, p) => [`${v}/10 — ${p.payload?.role || ''}`, 'Score']}
            />
            <Line
              type="monotone" dataKey="score" stroke="#10b981" strokeWidth={2.5}
              dot={({ cx, cy, payload, key }) => (
                <circle key={key} cx={cx} cy={cy} r={4} fill={scoreGradient(payload.score)} stroke="#020617" strokeWidth={2} />
              )}
              activeDot={{ r: 6, fill: '#10b981' }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

// ── Skill Benchmark radar ─────────────────────────────────────────────────────
function avg(arr, key) {
  const valid = arr.filter(s => s[key] != null)
  if (!valid.length) return null
  return valid.reduce((a, s) => a + s[key], 0) / valid.length
}

function getSkillData(sessions) {
  const content    = avg(sessions, 'overall_score')
  const aiScore    = avg(sessions, 'ai_score')
  const eyeContact = avg(sessions, 'eye_contact_pct')
  const confidence = avg(sessions, 'face_confidence_score')
  const stability  = avg(sessions, 'head_stability_pct')

  return [
    { skill: 'Content',    value: content    != null ? Math.round(content * 10)    : 0 },
    { skill: 'AI Score',   value: aiScore    != null ? Math.round(aiScore)         : 0 },
    { skill: 'Eye Contact',value: eyeContact != null ? Math.round(eyeContact)      : 0 },
    { skill: 'Confidence', value: confidence != null ? Math.round(confidence * 10) : 0 },
    { skill: 'Stability',  value: stability  != null ? Math.round(stability)       : 0 },
  ]
}

function SkillBenchmark({ sessions }) {
  const hasData = sessions.some(s =>
    s.overall_score != null || s.ai_score != null || s.face_confidence_score != null
  )
  const skillData = hasData ? getSkillData(sessions) : [
    { skill: 'Content',     value: 0 },
    { skill: 'AI Score',    value: 0 },
    { skill: 'Eye Contact', value: 0 },
    { skill: 'Confidence',  value: 0 },
    { skill: 'Stability',   value: 0 },
  ]

  return (
    <div className="glass border border-slate-700/40 rounded-2xl p-6 h-full">
      <div className="flex items-center justify-between mb-1">
        <p className="text-white font-bold">Skill Benchmark</p>
        <span className="text-slate-500 text-xs">Your averages</span>
      </div>
      <p className="text-slate-600 text-xs mb-2">Across all your sessions</p>

      {!hasData ? (
        <div className="flex items-center justify-center h-48 text-slate-600 text-sm">
          Complete interviews to see your skills
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={200}>
            <RadarChart data={skillData} margin={{ top: 10, right: 20, left: 20, bottom: 10 }}>
              <PolarGrid stroke="rgba(51,65,85,0.5)" />
              <PolarAngleAxis
                dataKey="skill"
                tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }}
              />
              <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
              <Radar
                dataKey="value"
                stroke="#10b981"
                fill="#10b981"
                fillOpacity={0.25}
                strokeWidth={2}
              />
            </RadarChart>
          </ResponsiveContainer>
          {/* Legend */}
          <div className="flex justify-center gap-4 mt-1">
            {skillData.map(d => (
              <div key={d.skill} className="text-center">
                <p className="text-emerald-400 text-xs font-bold">{d.value}</p>
                <p className="text-slate-600 text-xs">{d.skill}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard({ onNavigate }) {
  const { user } = useAuth()
  const [sessions, setSessions] = useState([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    fetchSessions().then(data => { setSessions(data); setLoading(false) })
  }, [])

  const firstName = user?.name?.split(' ')[0] || 'there'

  const scored       = sessions.filter(s => s.overall_score != null)
  const avgScore     = scored.length ? (scored.reduce((a, s) => a + s.overall_score, 0) / scored.length).toFixed(1) : null
  const bestScore    = scored.length ? Math.max(...scored.map(s => s.overall_score)).toFixed(1) : null
  const totalSeconds = sessions.reduce((a, s) => a + (s.duration_seconds || 0), 0)
  const thisMonth    = sessions.filter(s => {
    const d = new Date(s.created_at)
    const now = new Date()
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).length
  const lastDate = sessions.length ? formatDate(sessions[0].created_at) : null
  const aiScored = sessions.filter(s => s.ai_score != null)
  const avgAI    = aiScored.length ? Math.round(aiScored.reduce((a, s) => a + s.ai_score, 0) / aiScored.length) : null

  const recent = sessions.slice(0, 3)

  return (
    <div className="min-h-screen bg-slate-950 relative overflow-hidden">
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="animate-orb absolute top-0 right-0 w-96 h-96 rounded-full bg-emerald-500/6 blur-3xl" />
        <div className="animate-orb-r absolute bottom-0 left-0 w-80 h-80 rounded-full bg-cyan-500/5 blur-3xl" />
      </div>

      <div className="relative z-10 p-6 sm:p-8 max-w-6xl mx-auto space-y-6">

        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-white">Hi, {firstName} 👋</h1>
            <p className="text-slate-500 text-sm mt-1">Get ready to ace your next interview</p>
          </div>
          <button
            onClick={() => onNavigate('landing')}
            className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold px-5 py-2.5 rounded-2xl transition-all hover:scale-105 shadow-lg shadow-emerald-500/30 whitespace-nowrap text-sm"
          >
            <span>🎙</span>
            Start Interview
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-24">
            <div className="relative w-14 h-14">
              <div className="absolute inset-0 rounded-full border-4 border-emerald-500/20 animate-ping" />
              <div className="w-14 h-14 rounded-full border-4 border-slate-800 border-t-emerald-500 animate-spin" />
            </div>
          </div>
        ) : (
          <>
            {/* ── Stat cards ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatCard icon="📋" label="Total Sessions" value={sessions.length || '–'} sub={sessions.length ? `${durationLabel(totalSeconds)} total` : 'No sessions yet'} />
              <StatCard
                icon="⭐" label="Average Score"
                value={avgScore ? `${avgScore}/10` : '–'}
                sub={bestScore ? `Best: ${bestScore}/10` : 'Complete interviews'}
                color={avgScore ? scoreColor(parseFloat(avgScore)) : 'text-slate-500'}
              />
              <StatCard
                icon="🤖" label="Avg AI Score"
                value={avgAI != null ? `${avgAI}/100` : '–'}
                sub={avgAI != null ? (avgAI >= 75 ? 'Strong candidate' : avgAI >= 50 ? 'Promising' : 'Keep practising') : 'No data yet'}
                color={avgAI != null ? aiColor(avgAI) : 'text-slate-500'}
              />
              <StatCard icon="📅" label="This Month" value={thisMonth || '–'} sub={lastDate ? `Last: ${lastDate}` : 'No sessions yet'} color="text-cyan-400" />
            </div>

            {/* ── Charts row ── */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
              <div className="lg:col-span-3"><ScoreChart sessions={sessions} /></div>
              <div className="lg:col-span-2"><SkillBenchmark sessions={sessions} /></div>
            </div>

            {/* ── Recent sessions teaser ── */}
            {sessions.length > 0 && (
              <div className="glass border border-slate-700/40 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-white font-bold">Recent Sessions</p>
                  <button
                    onClick={() => onNavigate('sessions')}
                    className="text-emerald-400 hover:text-emerald-300 text-xs font-semibold transition-colors"
                  >
                    View all {sessions.length} →
                  </button>
                </div>
                <div className="space-y-2">
                  {recent.map(s => (
                    <div key={s.id} className="flex items-center gap-3 py-2 border-b border-slate-800/60 last:border-0">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 border ${scoreBg(s.overall_score)}`}>
                        {s.overall_score != null ? parseFloat(s.overall_score).toFixed(1) : '–'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-slate-200 text-sm font-semibold truncate">{s.role || 'Interview'}</p>
                        <p className="text-slate-500 text-xs">{formatDate(s.created_at)} · {s.difficulty || 'Mid'}</p>
                      </div>
                      {s.ai_score != null && (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${aiBg(s.ai_score)}`}>
                          AI {Math.round(s.ai_score)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {sessions.length === 0 && (
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
            )}
          </>
        )}
      </div>
    </div>
  )
}
