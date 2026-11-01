import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts'
import { fetchSessions, fetchInsights } from '../utils/api'
import { durationLabel } from '../utils/speechAnalytics'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import {
  scoreColor, scoreHex,
  formatShort, avgArr, to100,
} from '../utils/scoring'
import { IconList, IconStar, IconTrophy, IconFlame, IconMic } from '../utils/icons'
import { FilterBar, applyFilters, useSessionFilters, isFiltered, TYPE_LABELS } from './SessionFilters'

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

function useTooltipStyle() {
  const { theme } = useTheme()
  return theme === 'dark'
    ? { backgroundColor: 'rgba(15,23,42,0.95)', border: '1px solid rgba(51,65,85,0.6)', borderRadius: 12, padding: '8px 12px' }
    : { backgroundColor: 'rgba(255,255,255,0.97)', border: '1px solid rgba(226,232,240,0.8)', borderRadius: 12, padding: '8px 12px' }
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub, color = 'text-slate-900 dark:text-white' }) {
  return (
    <div className="glass border border-slate-200 dark:border-slate-700/40 rounded-2xl p-5 space-y-2">
      <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
        {icon}
        <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <p className={`text-2xl font-black ${color}`}>{value}</p>
      {sub && <p className="text-slate-500 dark:text-slate-400 text-xs">{sub}</p>}
    </div>
  )
}

// ── Score progression: one point per interview ────────────────────────────────
function ScoreTooltip({ active, payload }) {
  const style = useTooltipStyle()
  if (!active || !payload?.length) return null
  const s = payload[0].payload
  return (
    <div style={style} className="text-xs space-y-0.5">
      <p className="font-bold text-slate-800 dark:text-slate-100">{s.when}</p>
      <p className="text-slate-500 truncate max-w-[220px]">{s.role}</p>
      <p className="text-slate-500">{s.level} · {s.type}</p>
      <p className={`font-black text-sm ${scoreColor(s.raw)}`}>{s.score}/100</p>
      <p className="text-emerald-500 text-[10px] font-semibold">Click to open the feedback</p>
    </div>
  )
}

function ScoreChart({ sessions, onOpenSession }) {
  const data = [...sessions]
    .filter(s => s.overall_score != null)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    .slice(-30)
    .map((s, i) => ({
      // Each interview is its own point, even when several happened on one day
      n:     i,
      id:    s.id,
      date:  formatShort(s.created_at),
      when:  new Date(s.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      score: to100(s.overall_score),
      raw:   s.overall_score,
      role:  s.role || 'Interview',
      level: s.difficulty || 'Mid',
      type:  TYPE_LABELS[s.interview_type || 'full'] || s.interview_type,
    }))

  return (
    <div className="glass border border-slate-200 dark:border-slate-700/40 rounded-2xl p-6">
      <p className="text-slate-900 dark:text-white font-bold mb-1">Score Progression</p>
      <p className="text-slate-600 dark:text-slate-400 text-xs mb-4">
        {data.length ? `Each point is one interview · last ${data.length} · click a point to open its feedback` : 'No scored interviews for these filters'}
      </p>
      {data.length < 2 ? (
        <div className="flex items-center justify-center h-40 text-slate-600 dark:text-slate-400 text-sm">Complete more interviews to see your trend</div>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }} style={{ cursor: 'pointer' }}
            onClick={(e) => { const point = data[e?.activeTooltipIndex ?? e?.activeIndex]; if (point) onOpenSession(point.id) }}>
            <XAxis dataKey="n" type="number" domain={[0, data.length - 1]} ticks={data.map(d => d.n)}
              tickFormatter={(n) => (n === 0 || data[n].date !== data[n - 1].date ? data[n].date : '')}
              tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 100]} ticks={[0, 50, 100]} tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} />
            <ReferenceLine y={70} stroke="rgba(16,185,129,0.25)" strokeDasharray="4 4" />
            <Tooltip content={<ScoreTooltip />} cursor={{ stroke: 'rgba(100,116,139,0.3)' }} />
            <Line type="monotone" dataKey="score" stroke="#10b981" strokeWidth={2.5} isAnimationActive={false}
              dot={({ cx, cy, payload, key }) => <circle key={key} cx={cx} cy={cy} r={4} fill={scoreHex(payload.raw)} stroke="#020617" strokeWidth={2} />}
              activeDot={{ r: 7, fill: '#10b981', style: { cursor: 'pointer' }, onClick: (_, e) => { const point = data[e?.index]; if (point) onOpenSession(point.id) } }} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

// ── Skill radars: answers and body language ─────────────────────────────────
// Every axis is 0-100. Fluency joins speaking pace (best between 110 and 170 words a
// minute) and filler words (fewer is better), pace weighing a little more.
const pace    = (wpm) => wpm == null ? null : Math.max(0, 100 - 2 * Math.max(0, 110 - wpm, wpm - 170))
const fillers = (perMin) => perMin == null ? null : Math.max(0, 100 - perMin * 15)
function fluency(delivery) {
  const p = pace(delivery?.wpm), f = fillers(delivery?.fillers_per_min)
  if (p == null && f == null) return null
  return Math.round(p == null ? f : f == null ? p : 0.6 * p + 0.4 * f)
}

const ANSWER_AXES = [
  { skill: 'Relevance', hint: 'Answers the actual question', get: s => s.skills?.relevance != null ? s.skills.relevance * 10 : null },
  { skill: 'Examples',  hint: 'Concrete examples and details', get: s => s.skills?.examples != null ? s.skills.examples * 10 : null },
  { skill: 'Clarity',   hint: 'Easy to follow', get: s => s.skills?.clarity != null ? s.skills.clarity * 10 : null },
  { skill: 'Structure', hint: 'How much of STAR the stories covered', get: s => s.skills?.structure },
  { skill: 'Fluency',   hint: 'Speaking pace (best 110-170 words a minute) and few filler words', get: s => fluency(s.delivery) },
]

const VIDEO_AXES = [
  { skill: 'Eye Contact', hint: 'Looking at the camera, whole interview', get: s => s.eye_contact_pct },
  { skill: 'Focus',       hint: 'Eye contact while you answer', get: s => s.video?.focus },
  { skill: 'Stability',   hint: 'Head upright and facing the camera', get: s => s.head_stability_pct },
  { skill: 'Calm',        hint: 'Time without restless movement', get: s => s.video?.calm },
  { skill: 'Presence',    hint: 'Overall impression: a friendly or neutral face, a smile now and then, and few moments worth working on', get: s => s.video?.presence },
]

function RadarCard({ title, subtitle, axes, sessions }) {
  const style = useTooltipStyle()
  // The newest interview that has data for these axes, against the average of all filtered ones
  const withData = sessions.filter(s => axes.some(a => a.get(s) != null))
  const latest = withData[0]
  const data = axes.map(({ skill, hint, get }) => {
    const values = withData.map(get).filter(v => v != null)
    const avg = values.length ? Math.round(avgArr(values)) : null
    const last = latest ? get(latest) : null
    return { skill, hint, avg: avg ?? 0, latest: last != null ? Math.round(last) : 0, avgLabel: avg, latestLabel: last != null ? Math.round(last) : null }
  })

  return (
    <div className="glass border border-slate-200 dark:border-slate-700/40 rounded-2xl p-6">
      <p className="text-slate-900 dark:text-white font-bold mb-1">{title}</p>
      <p className="text-slate-600 dark:text-slate-400 text-xs mb-1">{subtitle}</p>
      {!withData.length ? (
        <div className="flex items-center justify-center h-56 text-slate-600 dark:text-slate-400 text-sm text-center">No data for these filters yet</div>
      ) : (
        <>
          <div className="flex items-center gap-4 text-[11px] text-slate-500 mt-2">
            <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-emerald-500 inline-block" />Latest interview</span>
            {withData.length > 1 && <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-slate-400 inline-block" />Average of {withData.length}</span>}
          </div>
          <ResponsiveContainer width="100%" height={230}>
            <RadarChart data={data} margin={{ top: 10, right: 30, left: 30, bottom: 10 }}>
              <PolarGrid stroke="rgba(100,116,139,0.35)" />
              <PolarAngleAxis dataKey="skill" tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }} />
              <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
              {withData.length > 1 && (
                <Radar name="Average" dataKey="avg" stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.12} strokeWidth={1.5} strokeDasharray="4 3" isAnimationActive={false} />
              )}
              <Radar name="Latest" dataKey="latest" stroke="#10b981" fill="#10b981" fillOpacity={0.25} strokeWidth={2} isAnimationActive={false} />
              <Tooltip
                contentStyle={style}
                formatter={(v, name, item) => [item.payload[name === 'Latest' ? 'latestLabel' : 'avgLabel'] ?? '–', name]}
                labelFormatter={(label) => `${label} — ${data.find(d => d.skill === label)?.hint || ''}`}
                labelStyle={{ fontWeight: 700, fontSize: 11 }}
                itemStyle={{ fontSize: 11 }}
              />
            </RadarChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mt-1">
            {data.map(d => (
              <div key={d.skill} className="text-center" title={d.hint}>
                <p className="text-emerald-500 text-sm font-black">{d.latestLabel ?? '–'}</p>
                {withData.length > 1 && <p className="text-slate-400 text-[10px]">avg {d.avgLabel ?? '–'}</p>}
                <p className="text-slate-600 dark:text-slate-400 text-[11px]">{d.skill}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── AI review of the interviews on screen ───────────────────────────────────
// One review per set of interviews, kept in this browser so it is not asked for again
const INSIGHTS_KEY = 'mockmate.dashboardInsights'

function cachedInsights() {
  try { return JSON.parse(localStorage.getItem(INSIGHTS_KEY) || '{}') } catch { return {} }
}

function storeInsights(key, data) {
  try {
    const all = { ...cachedInsights(), [key]: { ...data, at: Date.now() } }
    const newest = Object.entries(all).sort((a, b) => b[1].at - a[1].at).slice(0, 10)
    localStorage.setItem(INSIGHTS_KEY, JSON.stringify(Object.fromEntries(newest)))
  } catch { /* the review is just asked for again next time */ }
}

const TREND = {
  up:      { text: 'Improving', cls: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30', icon: '↗' },
  flat:    { text: 'Steady',    cls: 'text-amber-500 bg-amber-500/10 border-amber-500/30',       icon: '→' },
  down:    { text: 'Slipping',  cls: 'text-red-500 bg-red-500/10 border-red-500/30',             icon: '↘' },
  unclear: { text: 'Too early to tell', cls: 'text-slate-500 bg-slate-500/10 border-slate-500/30', icon: '·' },
}

// Written for all interviews on its own; after a filter change it waits for "Update review",
// so clicking through filters does not ask the AI each time
function InsightsCard({ sessions, filtered, onNavigate }) {
  const ids = useMemo(() => sessions.map(s => s.id).sort((a, b) => a - b), [sessions])
  const key = ids.join(',')
  const [review, setReview]     = useState(null)    // { key, data } of the review on screen
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(false)
  const [expanded, setExpanded] = useState(false)
  const requestRef = useRef(0)

  const generate = useCallback((force = false) => {
    const cached = cachedInsights()[key]
    if (cached && !force) { setReview({ key, data: cached }); return }
    const n = ++requestRef.current
    setLoading(true); setError(false)
    fetchInsights(ids.slice(-50))
      .then(data => { if (n !== requestRef.current) return; storeInsights(key, data); setReview({ key, data }) })
      .catch(() => { if (n === requestRef.current) setError(true) })
      .finally(() => { if (n === requestRef.current) setLoading(false) })
  }, [key, ids])

  useEffect(() => {
    requestRef.current++   // a review still on its way is for the previous set
    setLoading(false); setError(false)
    const cached = cachedInsights()[key]
    if (cached) setReview({ key, data: cached })
    else if (!filtered && ids.length) generate()
  }, [key])   // eslint-disable-line react-hooks/exhaustive-deps

  const data = review?.data
  const stale = review && review.key !== key
  const trend = TREND[data?.trend] || TREND.unclear
  const countText = `${sessions.length} interview${sessions.length !== 1 ? 's' : ''}`

  return (
    <div className="glass border border-slate-200 dark:border-slate-700/40 rounded-2xl p-6 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-slate-900 dark:text-white font-bold">🧭 Coach's Review</p>
          <p className="text-slate-600 dark:text-slate-400 text-xs mt-0.5">AI review of this dashboard: the {countText} that match{sessions.length === 1 ? 'es' : ''} your filters</p>
        </div>
        {data && !loading && (
          <button
            onClick={() => generate(true)}
            className={`flex-shrink-0 text-xs font-bold px-3 py-1.5 rounded-xl border transition-all ${
              stale
                ? 'text-white bg-gradient-to-r from-emerald-500 to-teal-500 border-transparent shadow-md shadow-emerald-500/30 hover:scale-105'
                : 'text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700/60 hover:border-emerald-500/40 hover:text-emerald-500'
            }`}
          >
            ↻ Update review
          </button>
        )}
      </div>

      {/* The filters changed: the review on screen is about other interviews */}
      {stale && !loading && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3">
          <p className="text-sm text-amber-700 dark:text-amber-300">
            Filters changed — this review is still about the previous interviews. Update it for the {countText} shown now.
          </p>
          <button onClick={() => generate()} className="text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 px-3 py-1.5 rounded-xl transition-colors">
            Update review
          </button>
        </div>
      )}

      {!data && !loading && !error && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-700/50 px-4 py-3">
          <p className="text-sm text-slate-600 dark:text-slate-400">Get an AI review of the {countText} shown: your progress and what to practise next.</p>
          <button onClick={() => generate()} className="text-xs font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-500 px-3 py-1.5 rounded-xl hover:scale-105 transition-all">
            Get review
          </button>
        </div>
      )}

      {loading && (
        <div className="space-y-3 animate-pulse">
          <p className="text-xs text-slate-500">Analysing your {countText}…</p>
          {[90, 75, 85].map((w, i) => <div key={i} className="h-3 rounded bg-slate-200 dark:bg-slate-800" style={{ width: `${w}%` }} />)}
        </div>
      )}

      {error && !loading && (
        <div className="text-sm text-slate-500 space-y-2">
          <p>Could not analyse your interviews right now.</p>
          <button onClick={() => generate(true)} className="text-xs font-semibold text-emerald-500 hover:text-emerald-400">Try again</button>
        </div>
      )}

      {data && !loading && (
        <div className={stale ? 'opacity-50' : ''}>
          <div className="flex items-start gap-3">
            <span className={`text-xs font-bold px-2 py-1 rounded-lg border whitespace-nowrap ${trend.cls}`}>{trend.icon} {trend.text}</span>
            <p className="text-slate-800 dark:text-slate-100 text-sm font-semibold leading-relaxed">{data.headline}</p>
          </div>

          {expanded && (
            <div className="space-y-4 mt-4">
              {data.strengths?.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-bold uppercase tracking-wide text-emerald-500">What's working</p>
                  {data.strengths.map((s, i) => (
                    <p key={i} className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed flex gap-2"><span className="text-emerald-500">✓</span><span>{s}</span></p>
                  ))}
                </div>
              )}

              {data.focus?.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-amber-500">Focus next</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {data.focus.map((f, i) => (
                      <div key={i} className="rounded-xl border border-slate-200 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-900/50 p-3">
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{i + 1}. {f.area}</p>
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">{f.why}</p>
                        <p className="text-xs text-slate-700 dark:text-slate-300 mt-1.5 leading-relaxed"><span className="font-semibold text-emerald-600 dark:text-emerald-400">Try: </span>{f.how}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {data.next_step && (
                <div className="flex items-center justify-between gap-3 border-t border-slate-200 dark:border-slate-700/40 pt-3">
                  <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed"><span className="font-bold">Next: </span>{data.next_step}</p>
                  <button onClick={() => onNavigate('landing')} className="flex-shrink-0 text-xs font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-500 px-3 py-2 rounded-xl hover:scale-105 transition-all">
                    Practise →
                  </button>
                </div>
              )}
            </div>
          )}

          <button onClick={() => setExpanded(e => !e)} className="mt-3 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-500">
            {expanded ? 'Show less ▴' : 'Show full review ▾'}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard({ onNavigate, onOpenSession }) {
  const { user } = useAuth()
  const [sessions,      setSessions]      = useState([])
  const [loading,       setLoading]       = useState(true)
  const [refreshing,    setRefreshing]    = useState(false)
  const [lastRefreshed, setLastRefreshed] = useState(null)
  const [filters, changeFilters]        = useSessionFilters()

  const refresh = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true)
    setSessions(await fetchSessions())
    setLoading(false)
    setRefreshing(false)
    setLastRefreshed(new Date())
  }, [])

  useEffect(() => { refresh() }, [refresh])

  // Everything below the filters shows only the matching interviews (newest first)
  const shown = useMemo(() => applyFilters(sessions, filters), [sessions, filters])

  const firstName    = user?.name?.split(' ')[0] || 'there'
  const scored       = shown.filter(s => s.overall_score != null)
  const avgScore     = scored.length ? avgArr(scored.map(s => s.overall_score)) : null
  const bestSession  = scored.length ? scored.reduce((b, s) => s.overall_score > b.overall_score ? s : b) : null
  const totalSeconds = shown.reduce((a, s) => a + (s.duration_seconds || 0), 0)
  const streak       = calcStreak(sessions)

  return (
    <div className="min-h-screen dark:bg-slate-950 relative overflow-hidden">
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="animate-orb absolute top-0 right-0 w-96 h-96 rounded-full bg-emerald-500/6 blur-3xl" />
        <div className="animate-orb-r absolute bottom-0 left-0 w-80 h-80 rounded-full bg-cyan-500/5 blur-3xl" />
      </div>

      <div className="relative z-10 p-6 sm:p-8 max-w-5xl 2xl:max-w-6xl mx-auto space-y-6">

        {/* ── Header ── */}
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white">Hi, {firstName} 👋</h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">Get ready to ace your next interview</p>
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
            <IconMic className="w-12 h-12 text-emerald-500/60" />
            <p className="text-slate-900 dark:text-white font-bold text-lg">No interviews yet</p>
            <p className="text-slate-600 dark:text-slate-400 text-sm max-w-xs">Complete your first interview and your results will appear here.</p>
            <button onClick={() => onNavigate('landing')} className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold px-6 py-2.5 rounded-xl hover:scale-105 transition-all shadow-lg shadow-emerald-500/30 text-sm">
              Start your first interview
            </button>
          </div>
        ) : (
          <>
            <FilterBar filters={filters} onChange={changeFilters} />

            {/* ── Stats ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard icon={<IconList className="w-4 h-4" />} label="Interviews" value={shown.length} sub={`of ${sessions.length} · ${durationLabel(totalSeconds)} practised`} />
              <StatCard icon={<IconStar className="w-4 h-4" />} label="Avg Score" value={avgScore ? `${to100(avgScore)}/100` : '–'} sub="Answer quality" color={avgScore ? scoreColor(avgScore) : 'text-slate-500'} />
              <StatCard
                icon={<IconTrophy className="w-4 h-4" />} label="Best Interview"
                value={bestSession ? `${to100(bestSession.overall_score)}/100` : '–'}
                sub={bestSession ? `${formatShort(bestSession.created_at)} · ${bestSession.role?.split('–')[0]?.trim() || 'Interview'}` : 'No data yet'}
                color="text-amber-400"
              />
              <StatCard
                icon={<IconFlame className="w-4 h-4" />} label="Streak"
                value={streak ? `${streak}d` : '–'}
                sub={streak ? `${streak} day${streak > 1 ? 's' : ''} in a row` : 'Practice daily!'}
                color={streak >= 3 ? 'text-orange-400' : streak >= 1 ? 'text-yellow-400' : 'text-slate-500'}
              />
            </div>

            {shown.length === 0 ? (
              <div className="glass border border-slate-200 dark:border-slate-700/40 rounded-2xl p-10 text-center space-y-3">
                <p className="text-sm text-slate-500">You have no interviews with these filters yet.</p>
                <button onClick={() => onNavigate('landing')} className="text-sm font-semibold text-emerald-500 hover:text-emerald-400">Practise one now →</button>
              </div>
            ) : (
              <>
                <ScoreChart sessions={shown} onOpenSession={onOpenSession} />

                {/* ── Skills: what you said, and how you came across on camera ── */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <RadarCard title="Answer Skills" subtitle="Content scored by the AI, and how fluently you spoke" axes={ANSWER_AXES} sessions={shown} />
                  <RadarCard title="Body Language" subtitle="Measured by the webcam during the interview" axes={VIDEO_AXES} sessions={shown} />
                </div>

                <InsightsCard sessions={shown} filtered={isFiltered(filters)} onNavigate={onNavigate} />
              </>
            )}

            {/* ── Refresh footer ── */}
            <div className="flex items-center justify-between pt-2">
              <p className="text-slate-400 dark:text-slate-700 text-xs">
                {lastRefreshed
                  ? `Updated ${lastRefreshed.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
                  : 'Loading…'}
              </p>
              <button
                onClick={() => refresh(true)}
                disabled={refreshing}
                className="flex items-center gap-1.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 text-xs font-semibold transition-colors px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/60 border border-slate-200 dark:border-slate-700/40 disabled:opacity-40"
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
