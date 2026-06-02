import { useState, useEffect, useCallback } from 'react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Legend,
} from 'recharts'
import { fetchSessions, fetchFillerStats, deleteSession } from '../utils/api'
import { durationLabel } from '../utils/speechAnalytics'
import { useAuth } from '../context/AuthContext'
import {
  scoreBg, scoreColor, scoreHex, aiColor, aiBg,
  formatDate, formatShort, difficultyBadge, typeBadge, langInfo, avgArr,
} from '../utils/scoring'

// ── Practice streak ───────────────────────────────────────────────────────────
function calcStreak(sessions) {
  if (!sessions.length) return 0
  const uniqueDates = [...new Set(sessions.map(s => {
    const d = new Date(s.created_at); d.setHours(0,0,0,0); return d.getTime()
  }))].sort((a, b) => b - a)

  const today = new Date(); today.setHours(0,0,0,0)
  const yesterday = today.getTime() - 86400000
  if (uniqueDates[0] < yesterday) return 0

  let streak = 1
  for (let i = 1; i < uniqueDates.length; i++) {
    if (uniqueDates[i - 1] - uniqueDates[i] === 86400000) streak++
    else break
  }
  return streak
}

// ── Interview Readiness Score ─────────────────────────────────────────────────
function calcReadiness(sessions) {
  if (!sessions.length) return 0
  const scored   = sessions.filter(s => s.overall_score != null)
  const aiScored = sessions.filter(s => s.ai_score != null)
  const avgContent = avgArr(scored.map(s => s.overall_score)) || 0
  const avgAI      = avgArr(aiScored.map(s => s.ai_score))    || 0
  const streak     = calcStreak(sessions)

  // Trend: compare last 3 vs previous 3
  const last3 = scored.slice(0, 3).map(s => s.overall_score)
  const prev3 = scored.slice(3, 6).map(s => s.overall_score)
  const trendBonus = prev3.length
    ? (avgArr(last3) > avgArr(prev3) + 0.3 ? 10 : avgArr(last3) < avgArr(prev3) - 0.3 ? 0 : 5)
    : 5

  const contentPart  = (avgContent / 10) * 40   // max 40
  const aiPart       = (avgAI / 100)     * 20   // max 20
  const streakPart   = Math.min(streak * 4, 20) // max 20
  const volumePart   = Math.min(sessions.length * 2, 10) // max 10

  return Math.min(Math.round(contentPart + aiPart + trendBonus + streakPart + volumePart), 100)
}

function readinessColor(r) { return r >= 75 ? 'text-emerald-400' : r >= 50 ? 'text-yellow-400' : 'text-red-400' }
function readinessLabel(r) { return r >= 75 ? 'Interview Ready' : r >= 50 ? 'Getting There' : r >= 25 ? 'Keep Practising' : 'Just Starting' }

// ── Tooltip style ─────────────────────────────────────────────────────────────
const TOOLTIP_STYLE = {
  backgroundColor: 'rgba(15,23,42,0.95)',
  border: '1px solid rgba(51,65,85,0.6)',
  borderRadius: 12,
  backdropFilter: 'blur(12px)',
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub, color = 'text-white' }) {
  return (
    <div className="glass border border-slate-700/40 rounded-2xl p-5 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-base">{icon}</span>
        <span className="text-slate-500 text-xs font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <p className={`text-2xl font-black ${color}`}>{value}</p>
      {sub && <p className="text-slate-600 text-xs">{sub}</p>}
    </div>
  )
}

// ── Score progression chart (content + AI) ────────────────────────────────────
function ScoreChart({ sessions }) {
  const data = [...sessions]
    .reverse()
    .filter(s => s.overall_score != null)
    .slice(-10)
    .map(s => ({
      date:    formatShort(s.created_at),
      content: parseFloat(parseFloat(s.overall_score).toFixed(1)),
      ai:      s.ai_score != null ? parseFloat((s.ai_score / 10).toFixed(1)) : null,
      role:    s.role || '',
    }))

  return (
    <div className="glass border border-slate-700/40 rounded-2xl p-6 h-full">
      <div className="flex items-center justify-between mb-1">
        <p className="text-white font-bold">Score Progression</p>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-emerald-500 inline-block rounded" /> Content</span>
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-violet-400 inline-block rounded" /> AI /10</span>
        </div>
      </div>
      <p className="text-slate-600 text-xs mb-4">Last {data.length} interviews (AI score ÷10 for scale)</p>

      {data.length < 2 ? (
        <div className="flex items-center justify-center h-36 text-slate-600 text-sm">Complete more interviews to see your trend</div>
      ) : (
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <XAxis dataKey="date" tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 10]} ticks={[0, 5, 10]} tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} />
            <ReferenceLine y={7} stroke="rgba(16,185,129,0.15)" strokeDasharray="4 4" />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              labelStyle={{ color: '#e2e8f0', fontWeight: 700, fontSize: 11 }}
              itemStyle={{ fontSize: 11 }}
              formatter={(v, name) => [`${v}/10`, name === 'content' ? 'Content Score' : 'AI Score (÷10)']}
            />
            <Line type="monotone" dataKey="content" stroke="#10b981" strokeWidth={2.5}
              dot={({ cx, cy, payload, key }) => <circle key={key} cx={cx} cy={cy} r={4} fill={scoreHex(payload.content)} stroke="#020617" strokeWidth={2} />}
              activeDot={{ r: 6, fill: '#10b981' }} />
            <Line type="monotone" dataKey="ai" stroke="#a78bfa" strokeWidth={2} strokeDasharray="4 3"
              dot={false} activeDot={{ r: 5, fill: '#a78bfa' }} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

// ── Skill benchmark radar ─────────────────────────────────────────────────────
function SkillBenchmark({ sessions }) {
  const valid = sessions.filter(s => s.overall_score != null || s.ai_score != null)
  const skillData = [
    { skill: 'Content',     value: valid.length ? Math.round((avgArr(valid.filter(s=>s.overall_score!=null).map(s=>s.overall_score)) || 0) * 10) : 0 },
    { skill: 'AI Score',    value: valid.length ? Math.round(avgArr(valid.filter(s=>s.ai_score!=null).map(s=>s.ai_score)) || 0) : 0 },
    { skill: 'Eye Contact', value: valid.length ? Math.round(avgArr(sessions.filter(s=>s.eye_contact_pct!=null).map(s=>s.eye_contact_pct)) || 0) : 0 },
    { skill: 'Confidence',  value: valid.length ? Math.round((avgArr(sessions.filter(s=>s.face_confidence_score!=null).map(s=>s.face_confidence_score)) || 0) * 10) : 0 },
    { skill: 'Stability',   value: valid.length ? Math.round(avgArr(sessions.filter(s=>s.head_stability_pct!=null).map(s=>s.head_stability_pct)) || 0) : 0 },
  ]

  return (
    <div className="glass border border-slate-700/40 rounded-2xl p-6 h-full">
      <p className="text-white font-bold mb-1">Skill Benchmark</p>
      <p className="text-slate-600 text-xs mb-2">Averaged across all sessions</p>
      {!valid.length ? (
        <div className="flex items-center justify-center h-48 text-slate-600 text-sm">Complete interviews to see your skills</div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={200}>
            <RadarChart data={skillData} margin={{ top: 10, right: 20, left: 20, bottom: 10 }}>
              <PolarGrid stroke="rgba(51,65,85,0.5)" />
              <PolarAngleAxis dataKey="skill" tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }} />
              <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
              <Radar dataKey="value" stroke="#10b981" fill="#10b981" fillOpacity={0.25} strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-3 mt-1 flex-wrap">
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

// ── Breakdown section ─────────────────────────────────────────────────────────
function BreakdownCard({ title, icon, rows }) {
  return (
    <div className="glass border border-slate-700/40 rounded-2xl p-5">
      <p className="text-white font-bold text-sm mb-3">{icon} {title}</p>
      {rows.length === 0 ? (
        <p className="text-slate-600 text-xs">No data yet</p>
      ) : (
        <div className="space-y-2.5">
          {rows.map(r => (
            <div key={r.label} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 flex items-center gap-1.5">
                  {r.flag && <span>{r.flag}</span>}
                  <span>{r.label}</span>
                  <span className="text-slate-600">×{r.count}</span>
                </span>
                {r.avg != null && (
                  <span className={`font-bold ${scoreColor(r.avg)}`}>{r.avg.toFixed(1)}/10</span>
                )}
              </div>
              <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${(r.count / rows[0].count) * 100}%`, background: scoreHex(r.avg || 5) }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Activity heatmap (30 days) ────────────────────────────────────────────────
function ActivityHeatmap({ sessions }) {
  const days = []
  const now = new Date()
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now); d.setDate(now.getDate() - i); d.setHours(0,0,0,0)
    days.push(d)
  }

  const byDay = {}
  sessions.forEach(s => {
    const d = new Date(s.created_at); d.setHours(0,0,0,0)
    const key = d.toDateString()
    byDay[key] = (byDay[key] || 0) + 1
  })

  const activeDays = Object.keys(byDay).length
  const totalThisMonth = sessions.filter(s => {
    const d = new Date(s.created_at)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).length

  return (
    <div className="glass border border-slate-700/40 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-white font-bold">Activity — Last 30 Days</p>
          <p className="text-slate-600 text-xs mt-0.5">{activeDays} active day{activeDays !== 1 ? 's' : ''} · {totalThisMonth} session{totalThisMonth !== 1 ? 's' : ''} this month</p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-600">
          <span>Less</span>
          {['bg-slate-800/60','bg-emerald-500/30','bg-emerald-500/60','bg-emerald-500'].map((c,i) => (
            <div key={i} className={`w-3.5 h-3.5 rounded-sm ${c}`} />
          ))}
          <span>More</span>
        </div>
      </div>
      <div className="flex gap-1 flex-wrap">
        {days.map((d, i) => {
          const count = byDay[d.toDateString()] || 0
          const bg = count === 0 ? 'bg-slate-800/60' : count === 1 ? 'bg-emerald-500/30' : count === 2 ? 'bg-emerald-500/60' : 'bg-emerald-500'
          return (
            <div
              key={i}
              title={`${d.toLocaleDateString('en-US',{month:'short',day:'numeric'})}: ${count} session${count !== 1 ? 's' : ''}`}
              className={`w-6 h-6 rounded-md ${bg} cursor-default transition-colors`}
            />
          )
        })}
      </div>
      {/* Day labels */}
      <div className="flex justify-between mt-1.5 text-slate-700 text-xs px-0.5">
        <span>{days[0].toLocaleDateString('en-US',{month:'short',day:'numeric'})}</span>
        <span>{days[14].toLocaleDateString('en-US',{month:'short',day:'numeric'})}</span>
        <span>Today</span>
      </div>
    </div>
  )
}

// ── Filler words panel ────────────────────────────────────────────────────────
function FillerWordsPanel({ fillers }) {
  if (!fillers.length) return (
    <div className="glass border border-slate-700/40 rounded-2xl p-5 flex flex-col justify-center items-center text-center h-full">
      <p className="text-slate-500 text-sm font-semibold mb-1">🗣 Filler Words</p>
      <p className="text-slate-600 text-xs">No filler word data yet.<br/>Complete interviews to track habits.</p>
    </div>
  )

  const max = fillers[0].count
  return (
    <div className="glass border border-slate-700/40 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-white font-bold">🗣 Filler Words</p>
          <p className="text-slate-600 text-xs mt-0.5">Most-used across all sessions</p>
        </div>
        <span className="text-slate-500 text-xs">{fillers.reduce((a,f) => a+f.count, 0)} total</span>
      </div>
      <div className="space-y-2.5">
        {fillers.map((f, i) => (
          <div key={f.word} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                {i === 0 && <span className="text-red-400 font-black text-xs">#{i+1}</span>}
                {i > 0  && <span className="text-slate-600 text-xs">#{i+1}</span>}
                <span className="text-orange-300 font-semibold">"{f.word}"</span>
              </div>
              <span className={`font-bold ${i === 0 ? 'text-red-400' : i <= 2 ? 'text-orange-400' : 'text-slate-400'}`}>
                ×{f.count}
              </span>
            </div>
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${i === 0 ? 'bg-red-500' : i <= 2 ? 'bg-orange-400' : 'bg-slate-500'}`}
                style={{ width: `${(f.count / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard({ onNavigate }) {
  const { user } = useAuth()
  const [sessions,      setSessions]      = useState([])
  const [fillers,       setFillers]       = useState([])
  const [loading,       setLoading]       = useState(true)
  const [refreshing,    setRefreshing]    = useState(false)
  const [lastRefreshed, setLastRefreshed] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null) // session id pending confirmation

  const refresh = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true)
    const [s, f] = await Promise.all([fetchSessions(), fetchFillerStats()])
    setSessions(s)
    setFillers(f)
    setLoading(false)
    setRefreshing(false)
    setLastRefreshed(new Date())
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const handleDelete = async (id) => {
    await deleteSession(id)
    setConfirmDelete(null)
    refresh(false)
  }

  const firstName    = user?.name?.split(' ')[0] || 'there'
  const scored       = sessions.filter(s => s.overall_score != null)
  const avgScore     = scored.length ? avgArr(scored.map(s => s.overall_score)) : null
  const bestSession  = scored.length ? scored.reduce((b, s) => s.overall_score > b.overall_score ? s : b) : null
  const totalSeconds = sessions.reduce((a, s) => a + (s.duration_seconds || 0), 0)
  const thisMonth    = sessions.filter(s => { const d = new Date(s.created_at), n = new Date(); return d.getMonth()===n.getMonth()&&d.getFullYear()===n.getFullYear() }).length
  const aiScored     = sessions.filter(s => s.ai_score != null)
  const avgAI        = aiScored.length ? Math.round(avgArr(aiScored.map(s => s.ai_score))) : null
  const streak       = calcStreak(sessions)
  const readiness    = calcReadiness(sessions)
  const recent       = sessions.slice(0, 3)

  // ── Breakdowns ──────────────────────────────────────────────────────────────
  const byLanguage = Object.entries(
    sessions.reduce((acc, s) => {
      const key = s.language || 'en-US'
      if (!acc[key]) acc[key] = { count: 0, scores: [] }
      acc[key].count++
      if (s.overall_score != null) acc[key].scores.push(s.overall_score)
      return acc
    }, {})
  ).map(([code, v]) => ({
    label: langInfo(code).label,
    flag:  langInfo(code).flag,
    count: v.count,
    avg:   v.scores.length ? avgArr(v.scores) : null,
  })).sort((a, b) => b.count - a.count)

  const TYPE_LABELS = { full: 'Full Interview', behavioral: 'Behavioral', technical: 'Technical', screening: 'Screening', practice: 'Practice' }
  const byType = Object.entries(
    sessions.reduce((acc, s) => {
      const key = s.interview_type || 'full'
      if (!acc[key]) acc[key] = { count: 0, scores: [] }
      acc[key].count++
      if (s.overall_score != null) acc[key].scores.push(s.overall_score)
      return acc
    }, {})
  ).map(([type, v]) => ({
    label: TYPE_LABELS[type] || type,
    flag:  { full:'🎯', behavioral:'🌟', technical:'⚡', screening:'📞', practice:'🎓' }[type] || '—',
    count: v.count,
    avg:   v.scores.length ? avgArr(v.scores) : null,
  })).sort((a, b) => b.count - a.count)

  const byDifficulty = Object.entries(
    sessions.reduce((acc, s) => {
      const key = s.difficulty || 'Mid'
      if (!acc[key]) acc[key] = { count: 0, scores: [] }
      acc[key].count++
      if (s.overall_score != null) acc[key].scores.push(s.overall_score)
      return acc
    }, {})
  ).map(([diff, v]) => ({
    label: diff,
    flag:  { Junior:'🟢', Mid:'🟡', Senior:'🔴' }[diff] || '⚪',
    count: v.count,
    avg:   v.scores.length ? avgArr(v.scores) : null,
  })).sort((a, b) => { const ord = { Junior:0, Mid:1, Senior:2 }; return ord[a.label]-ord[b.label] })

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
          <div className="flex items-center gap-3">
            {/* Readiness badge */}
            {sessions.length > 0 && (
              <div className="text-center glass border border-slate-700/40 rounded-2xl px-4 py-2">
                <p className={`text-2xl font-black ${readinessColor(readiness)}`}>{readiness}</p>
                <p className="text-slate-500 text-xs">{readinessLabel(readiness)}</p>
              </div>
            )}
            <button
              onClick={() => onNavigate('landing')}
              className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold px-5 py-2.5 rounded-2xl transition-all hover:scale-105 shadow-lg shadow-emerald-500/30 whitespace-nowrap text-sm"
            >
              <span>🎙</span> Start Interview
            </button>
          </div>
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
            <button onClick={() => onNavigate('landing')} className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold px-6 py-2.5 rounded-xl hover:scale-105 transition-all shadow-lg shadow-emerald-500/30 text-sm">
              Start your first interview
            </button>
          </div>
        ) : (
          <>
            {/* ── Step 1: Stats (6 cards) ── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <StatCard icon="📋" label="Sessions"    value={sessions.length}  sub={`${durationLabel(totalSeconds)} total`} />
              <StatCard icon="⭐" label="Avg Score"   value={avgScore ? `${avgScore.toFixed(1)}/10` : '–'} sub="Content quality" color={avgScore ? scoreColor(avgScore) : 'text-slate-500'} />
              <StatCard icon="🤖" label="Avg AI"      value={avgAI != null ? `${avgAI}` : '–'} sub="/100 overall" color={avgAI != null ? aiColor(avgAI) : 'text-slate-500'} />
              <StatCard icon="📅" label="This Month"  value={thisMonth || '–'} sub={thisMonth ? 'sessions' : 'No sessions yet'} color="text-cyan-400" />
              <StatCard
                icon="🏆" label="Best Session"
                value={bestSession ? parseFloat(bestSession.overall_score).toFixed(1) : '–'}
                sub={bestSession ? (bestSession.role?.split('–')[0]?.trim() || 'Interview') : 'No data yet'}
                color="text-amber-400"
              />
              <StatCard
                icon="🔥" label="Streak"
                value={streak ? `${streak}d` : '–'}
                sub={streak ? `${streak} day${streak > 1 ? 's' : ''} in a row` : 'Practice daily!'}
                color={streak >= 3 ? 'text-orange-400' : streak >= 1 ? 'text-yellow-400' : 'text-slate-500'}
              />
            </div>

            {/* ── Step 3: Charts (score progression + skill radar) ── */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
              <div className="lg:col-span-3"><ScoreChart sessions={sessions} /></div>
              <div className="lg:col-span-2"><SkillBenchmark sessions={sessions} /></div>
            </div>

            {/* ── Step 6: Activity heatmap ── */}
            <ActivityHeatmap sessions={sessions} />

            {/* ── Step 2: Breakdowns (language / type / difficulty) ── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <BreakdownCard title="By Language"   icon="🌐" rows={byLanguage} />
              <BreakdownCard title="By Type"       icon="🎯" rows={byType} />
              <BreakdownCard title="By Difficulty" icon="📊" rows={byDifficulty} />
            </div>

            {/* ── Step 4: Filler words ── */}
            <FillerWordsPanel fillers={fillers} />

            {/* ── Recent sessions teaser ── */}
            <div className="glass border border-slate-700/40 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-white font-bold">Recent Sessions</p>
                <button onClick={() => onNavigate('sessions')} className="text-emerald-400 hover:text-emerald-300 text-xs font-semibold transition-colors">
                  View all {sessions.length} →
                </button>
              </div>
              <div className="space-y-2">
                {recent.map(s => (
                  <div key={s.id} className="flex items-center gap-3 py-2 border-b border-slate-800/60 last:border-0 group">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 border ${scoreBg(s.overall_score)}`}>
                      {s.overall_score != null ? parseFloat(s.overall_score).toFixed(1) : '–'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-200 text-sm font-semibold truncate">{s.role || 'Interview'}</p>
                      <p className="text-slate-500 text-xs">{formatDate(s.created_at)} · {s.difficulty || 'Mid'} · {langInfo(s.language||'en-US').flag}</p>
                    </div>
                    {s.ai_score != null && (
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${aiBg(s.ai_score)}`}>AI {Math.round(s.ai_score)}</span>
                    )}
                    {/* Delete control */}
                    {confirmDelete === s.id ? (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <span className="text-slate-400 text-xs">Delete?</span>
                        <button onClick={() => handleDelete(s.id)} className="text-red-400 hover:text-red-300 text-xs font-bold px-2 py-0.5 rounded bg-red-500/10 hover:bg-red-500/20 transition-colors">Yes</button>
                        <button onClick={() => setConfirmDelete(null)} className="text-slate-500 hover:text-slate-300 text-xs px-2 py-0.5 rounded hover:bg-slate-700/40 transition-colors">No</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(s.id)}
                        title="Delete session"
                        className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-all flex-shrink-0 p-1 rounded"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* ── Refresh footer ── */}
            <div className="flex items-center justify-between pt-2">
              <p className="text-slate-700 text-xs">
                {lastRefreshed
                  ? `Updated ${lastRefreshed.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
                  : 'Loading…'}
              </p>
              <button
                onClick={() => refresh(true)}
                disabled={refreshing}
                className="flex items-center gap-1.5 text-slate-500 hover:text-slate-200 text-xs font-semibold transition-colors px-3 py-1.5 rounded-lg hover:bg-slate-800/60 border border-slate-700/40 disabled:opacity-40"
              >
                <svg className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {refreshing ? 'Refreshing…' : 'Refresh stats'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
