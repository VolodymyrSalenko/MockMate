import { useState, useEffect, useRef } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { wpmColor, durationLabel } from '../utils/speechAnalytics'
import { saveSession } from '../utils/history'
import RetryModal from './RetryModal'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

function BgOrbs() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      <div className="animate-orb absolute -top-20 right-0 w-96 h-96 rounded-full bg-emerald-500/8 blur-3xl" />
      <div className="animate-orb-r absolute bottom-0 -left-20 w-80 h-80 rounded-full bg-cyan-500/6 blur-3xl" />
    </div>
  )
}

function ScoreBadge({ score }) {
  const rounded = Math.round(score)
  const style = rounded >= 8
    ? { background: 'linear-gradient(135deg,#10b981,#06b6d4)', color: '#fff', boxShadow: '0 0 16px rgba(16,185,129,0.5)' }
    : rounded >= 5
    ? { background: 'linear-gradient(135deg,#f59e0b,#f97316)', color: '#fff', boxShadow: '0 0 16px rgba(245,158,11,0.4)' }
    : { background: 'linear-gradient(135deg,#ef4444,#f43f5e)', color: '#fff', boxShadow: '0 0 16px rgba(239,68,68,0.4)' }
  return (
    <div className="w-10 h-10 rounded-full flex items-center justify-center font-black text-sm flex-shrink-0" style={style}>
      {rounded}
    </div>
  )
}

function OverallScoreBadge({ score }) {
  const gradient = score >= 8 ? 'from-emerald-500 to-teal-400' : score >= 5 ? 'from-yellow-400 to-amber-400' : 'from-red-500 to-rose-400'
  const glow     = score >= 8 ? 'rgba(16,185,129,0.5)' : score >= 5 ? 'rgba(245,158,11,0.4)' : 'rgba(239,68,68,0.4)'
  return (
    <div className={`w-36 h-36 rounded-full bg-gradient-to-br ${gradient} flex flex-col items-center justify-center animate-score-pop`}
      style={{ boxShadow: `0 0 40px ${glow}, 0 0 80px ${glow.replace('0.5','0.2')}` }}>
      <span className="text-4xl font-black text-white">{parseFloat(score).toFixed(1)}</span>
      <span className="text-white/60 text-xs font-semibold tracking-wide">/ 10</span>
    </div>
  )
}

function StarTracker({ star }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-slate-500 text-xs font-semibold">STAR:</span>
      {[['situation','S'],['task','T'],['action','A'],['result','R']].map(([key, label]) => (
        <span key={key} title={key}
          className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black transition-all ${
            star[key] ? 'bg-gradient-to-br from-emerald-500 to-teal-400 text-white shadow-sm shadow-emerald-500/40' : 'bg-slate-800 text-slate-600 border border-slate-700'
          }`}>{label}</span>
      ))}
    </div>
  )
}

function SpeechAnalyticsPanel({ analytics, questionIndex }) {
  if (!analytics) return null
  const isBehavioral = questionIndex <= 1
  const topFillers = Object.entries(analytics.fillerCounts || {}).sort((a,b) => b[1]-a[1]).slice(0,4)
  return (
    <div className="glass border border-slate-700/40 rounded-2xl p-4 space-y-3">
      <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Speech Analytics</p>
      <div className="flex flex-wrap gap-2.5">
        {analytics.durationSeconds > 0 && (
          <div className="flex flex-col items-center bg-slate-900/70 rounded-xl px-3 py-2 min-w-[64px] animate-stat-in">
            <span className="text-slate-200 font-bold text-sm">{durationLabel(analytics.durationSeconds)}</span>
            <span className="text-slate-600 text-xs mt-0.5">Duration</span>
          </div>
        )}
        {analytics.wpm > 0 && (
          <div className="flex flex-col items-center bg-slate-900/70 rounded-xl px-3 py-2 min-w-[64px] animate-stat-in" style={{ animationDelay:'0.05s' }}>
            <span className={`font-bold text-sm ${wpmColor(analytics.wpm)}`}>{analytics.wpm}</span>
            <span className="text-slate-600 text-xs mt-0.5">wpm</span>
          </div>
        )}
        <div className="flex flex-col items-center bg-slate-900/70 rounded-xl px-3 py-2 min-w-[64px] animate-stat-in" style={{ animationDelay:'0.1s' }}>
          <span className={`font-bold text-sm ${analytics.totalFillers === 0 ? 'text-emerald-400' : analytics.totalFillers <= 3 ? 'text-yellow-400' : 'text-red-400'}`}>
            {analytics.totalFillers}
          </span>
          <span className="text-slate-600 text-xs mt-0.5">Fillers</span>
        </div>
        {analytics.wordCount > 0 && (
          <div className="flex flex-col items-center bg-slate-900/70 rounded-xl px-3 py-2 min-w-[64px] animate-stat-in" style={{ animationDelay:'0.15s' }}>
            <span className="text-slate-200 font-bold text-sm">{analytics.wordCount}</span>
            <span className="text-slate-600 text-xs mt-0.5">Words</span>
          </div>
        )}
      </div>
      {topFillers.length > 0 && (
        <div>
          <p className="text-xs text-slate-600 mb-1.5">Top filler words:</p>
          <div className="flex flex-wrap gap-2">
            {topFillers.map(([word, count]) => (
              <span key={word} className="bg-orange-500/10 border border-orange-500/25 text-orange-300 text-xs px-2.5 py-1 rounded-full">"{word}" ×{count}</span>
            ))}
          </div>
        </div>
      )}
      {isBehavioral && analytics.star && <StarTracker star={analytics.star} />}
      {analytics.wpm > 0 && (
        <p className="text-xs text-slate-600">
          {analytics.wpm < 100 ? 'A bit slow — aim for 120–160 wpm.' : analytics.wpm > 180 ? 'A bit fast — slow down for clarity.' : 'Good pace ✓'}
        </p>
      )}
    </div>
  )
}

function AnswerCard({ item, index, role, onRetry }) {
  const [showIdeal, setShowIdeal] = useState(false)
  return (
    <div className="glass border border-slate-700/40 rounded-3xl p-4 sm:p-6 space-y-4 hover:border-slate-600/60 transition-all duration-300 animate-fade-up"
      style={{ animationDelay: `${index * 0.08}s` }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="text-xs text-emerald-400/70 font-bold uppercase tracking-widest mb-1.5">Question {index + 1}</p>
          <p className="text-slate-200 font-semibold text-sm leading-relaxed">{item.question}</p>
        </div>
        <ScoreBadge score={item.score} />
      </div>

      <div className="bg-slate-900/50 rounded-2xl p-4 border border-slate-800/60">
        <p className="text-xs text-slate-500 font-semibold mb-1.5">Your Answer Summary</p>
        <p className="text-slate-300 text-sm leading-relaxed">{item.answer_summary}</p>
      </div>

      <div>
        <p className="text-xs text-slate-500 font-semibold mb-1.5">Feedback</p>
        <p className="text-slate-300 text-sm leading-relaxed">{item.feedback}</p>
      </div>

      <div className="bg-emerald-500/8 border border-emerald-500/20 rounded-2xl p-4">
        <p className="text-xs text-emerald-400 font-bold mb-1.5">💡 Pro Tip</p>
        <p className="text-emerald-200/90 text-sm leading-relaxed">{item.tip}</p>
      </div>

      {/* Ideal answer toggle */}
      {item.ideal_answer && (
        <div>
          <button onClick={() => setShowIdeal(o => !o)}
            className="w-full flex items-center justify-between px-4 py-2.5 glass-light border border-slate-700/40 rounded-2xl text-sm text-slate-400 hover:border-amber-500/30 hover:text-slate-300 transition-all">
            <span className="flex items-center gap-2"><span>⭐</span> <span className="text-xs font-semibold">See model answer (9/10)</span></span>
            <span className="text-xs">{showIdeal ? '▲' : '▼'}</span>
          </button>
          {showIdeal && (
            <div className="mt-2 bg-amber-500/8 border border-amber-500/20 rounded-2xl p-4 animate-fade-up" style={{ animationDuration: '0.2s' }}>
              <p className="text-xs text-amber-400 font-bold mb-1.5">Model Answer</p>
              <p className="text-amber-200/90 text-sm leading-relaxed">{item.ideal_answer}</p>
            </div>
          )}
        </div>
      )}

      {/* Retry button */}
      <button onClick={() => onRetry(item.question, item.score)}
        className="w-full flex items-center justify-center gap-2 py-2.5 glass-light border border-slate-700/40 rounded-2xl text-slate-400 hover:border-emerald-500/30 hover:text-emerald-400 text-xs font-semibold transition-all">
        🔄 Retry this question
      </button>

      {item.analytics && <SpeechAnalyticsPanel analytics={item.analytics} questionIndex={index} />}
    </div>
  )
}

function OverallSpeechSummary({ qaPairs, sessionDuration }) {
  const withAnalytics = qaPairs.filter(p => p.analytics)
  if (!withAnalytics.length) return null

  const avgWpm = Math.round(
    withAnalytics.filter(p => p.analytics.wpm > 0).reduce((s,p) => s + p.analytics.wpm, 0) /
    (withAnalytics.filter(p => p.analytics.wpm > 0).length || 1)
  )
  const totalFillers  = withAnalytics.reduce((s,p) => s + (p.analytics.totalFillers || 0), 0)
  const totalDuration = withAnalytics.reduce((s,p) => s + (p.analytics.durationSeconds || 0), 0)
  const allFillerCounts = {}
  withAnalytics.forEach(p => Object.entries(p.analytics.fillerCounts || {}).forEach(([w,c]) => {
    allFillerCounts[w] = (allFillerCounts[w] || 0) + c
  }))
  const topFiller = Object.entries(allFillerCounts).sort((a,b) => b[1]-a[1])[0]

  const stats = [
    { value: avgWpm || '—',  label: 'Avg. wpm',    color: wpmColor(avgWpm) },
    { value: totalFillers,   label: 'Total fillers', color: totalFillers === 0 ? 'text-emerald-400' : totalFillers <= 5 ? 'text-yellow-400' : 'text-red-400' },
    { value: durationLabel(totalDuration), label: 'Talk time', color: 'text-slate-200' },
    { value: topFiller ? `"${topFiller[0]}"` : '—', label: 'Top filler', color: 'text-orange-400' },
    ...(sessionDuration > 0 ? [{ value: durationLabel(sessionDuration), label: 'Session time', color: 'text-slate-200' }] : []),
  ]

  return (
    <div className="glass border border-slate-700/40 rounded-3xl p-6 space-y-4 animate-fade-up" style={{ animationDelay: '0.1s' }}>
      <p className="text-white font-bold text-lg">🗣 Speech Performance</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map((s, i) => (
          <div key={i} className="bg-slate-900/60 rounded-2xl p-4 text-center animate-stat-in" style={{ animationDelay: `${i * 0.07}s` }}>
            <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-slate-600 text-xs mt-1">{s.label}</p>
          </div>
        ))}
      </div>
      {totalFillers === 0 && <p className="text-emerald-400 text-sm font-medium">✨ Zero filler words — excellent verbal discipline!</p>}
    </div>
  )
}

const TOOLTIP_STYLE = { backgroundColor: 'rgba(15,23,42,0.95)', border: '1px solid rgba(51,65,85,0.6)', borderRadius: 12, backdropFilter: 'blur(12px)' }

function AnswerLengthChart({ answers }) {
  const data = answers.map((a, i) => ({ name: `Q${i+1}`, words: a.analytics?.wordCount || 0, score: a.score }))
  if (data.every(d => d.words === 0)) return null
  return (
    <div className="glass border border-slate-700/40 rounded-3xl p-6 animate-fade-up" style={{ animationDelay: '0.15s' }}>
      <p className="text-white font-bold mb-1">📊 Answer Length</p>
      <p className="text-slate-600 text-xs mb-4">Bar colour = content score</p>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: '#e2e8f0', fontWeight: 700 }} itemStyle={{ color: '#94a3b8' }} formatter={(v) => [`${v} words`, 'Length']} />
          <Bar dataKey="words" radius={[6,6,0,0]}>
            {data.map((entry, i) => (
              <Cell key={i}
                fill={entry.score >= 8 ? '#10b981' : entry.score >= 5 ? '#f59e0b' : '#ef4444'}
                fillOpacity={0.9}
                style={{ filter: `drop-shadow(0 0 4px ${entry.score >= 8 ? '#10b981' : entry.score >= 5 ? '#f59e0b' : '#ef4444'})` }}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Hidden share card rendered off-screen ────────────────────────────────────
function ShareCard({ score, role, difficulty, strength, date, cardRef }) {
  const gradient = score >= 8 ? 'from-emerald-500 to-teal-400' : score >= 5 ? 'from-yellow-400 to-amber-400' : 'from-red-500 to-rose-400'
  const glow     = score >= 8 ? 'rgba(16,185,129,0.4)' : score >= 5 ? 'rgba(245,158,11,0.3)' : 'rgba(239,68,68,0.3)'
  return (
    <div ref={cardRef} style={{
      position: 'fixed', top: '-9999px', left: '-9999px',
      width: '480px', padding: '40px',
      background: 'linear-gradient(135deg, #020617 0%, #0f172a 50%, #020617 100%)',
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      {/* Logo */}
      <div style={{ marginBottom: 24 }}>
        <span style={{ fontSize: 28, fontWeight: 900, color: '#fff' }}>Mock</span>
        <span style={{ fontSize: 28, fontWeight: 900, background: 'linear-gradient(135deg,#34d399,#06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Mate</span>
      </div>

      {/* Score circle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 28 }}>
        <div style={{
          width: 100, height: 100, borderRadius: '50%',
          background: `linear-gradient(135deg, ${gradient.includes('emerald') ? '#10b981,#14b8a6' : gradient.includes('yellow') ? '#f59e0b,#f97316' : '#ef4444,#f43f5e'})`,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 0 40px ${glow}`,
        }}>
          <span style={{ fontSize: 32, fontWeight: 900, color: '#fff' }}>{parseFloat(score).toFixed(1)}</span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>/ 10</span>
        </div>
        <div>
          <p style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>Interview Score</p>
          <p style={{ color: '#f1f5f9', fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{role}</p>
          <p style={{ color: '#475569', fontSize: 12 }}>{difficulty} level · {date}</p>
        </div>
      </div>

      {/* Strength */}
      {strength && (
        <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 16, padding: '14px 18px', marginBottom: 20 }}>
          <p style={{ color: '#34d399', fontSize: 11, fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>🏆 Top Strength</p>
          <p style={{ color: '#d1fae5', fontSize: 13, lineHeight: 1.5 }}>{strength}</p>
        </div>
      )}

      {/* Footer */}
      <div style={{ borderTop: '1px solid rgba(51,65,85,0.4)', paddingTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: '#475569', fontSize: 11 }}>Practise at MockMate</span>
        <span style={{ color: '#334155', fontSize: 11 }}>localhost:5173</span>
      </div>
    </div>
  )
}

function BodyLanguageCard({ metrics }) {
  if (!metrics || metrics.samplesCount < 30) return null

  const eyePct  = metrics.eyeContactPct
  const headPct = metrics.headStabilityPct
  const conf    = metrics.confidenceScore

  const eyeColor  = eyePct  >= 70 ? 'bg-emerald-500' : eyePct  >= 40 ? 'bg-amber-400' : 'bg-red-500'
  const headColor = headPct >= 70 ? 'bg-emerald-500' : headPct >= 40 ? 'bg-amber-400' : 'bg-red-500'
  const confColor = conf    >= 7  ? 'text-emerald-400' : conf >= 4 ? 'text-amber-400' : 'text-red-400'

  const tip = eyePct < 50
    ? `Try to keep your eyes on the camera — you maintained eye contact only ${eyePct}% of the time.`
    : headPct < 50
    ? `Work on keeping your head still and upright — steady posture reads as more confident.`
    : `Strong body language overall — consistent eye contact and stable posture.`

  return (
    <div className="glass border border-slate-700/40 rounded-3xl p-6 space-y-4 animate-fade-up" style={{ animationDelay: '0.12s' }}>
      <div className="flex items-center justify-between">
        <p className="text-white font-bold text-lg">👁 Body Language</p>
        <span className={`text-2xl font-black ${confColor}`}>{conf.toFixed(1)}<span className="text-slate-600 text-sm font-normal">/10</span></span>
      </div>
      <div className="space-y-3">
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-400 font-semibold">Eye Contact</span>
            <span className={eyePct >= 70 ? 'text-emerald-400' : eyePct >= 40 ? 'text-amber-400' : 'text-red-400'}>{eyePct}%</span>
          </div>
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-700 ${eyeColor}`} style={{ width: `${eyePct}%` }} />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-400 font-semibold">Head Stability</span>
            <span className={headPct >= 70 ? 'text-emerald-400' : headPct >= 40 ? 'text-amber-400' : 'text-red-400'}>{headPct}%</span>
          </div>
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-700 ${headColor}`} style={{ width: `${headPct}%` }} />
          </div>
        </div>
      </div>
      <p className="text-slate-400 text-sm leading-relaxed border-t border-slate-700/40 pt-3">{tip}</p>
    </div>
  )
}

export default function Debrief({ qaPairs, role, difficulty, duration, faceMetrics, recording, onRetry }) {
  const [debrief,   setDebrief]   = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')
  const [exporting, setExporting] = useState(false)
  const [sharing,   setSharing]   = useState(false)
  const [retryQ,    setRetryQ]    = useState(null)  // { question, originalScore }
  const debriefRef  = useRef(null)
  const shareCardRef = useRef(null)

  useEffect(() => {
    const fetchDebrief = async () => {
      try {
        const cleanPairs = qaPairs.map(({ question, answer }) => ({ question, answer }))
        const res = await fetch(`${BACKEND_URL}/debrief`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ qa_pairs: cleanPairs, role }),
        })
        if (!res.ok) throw new Error('Failed to get debrief')
        const data = await res.json()
        if (data.answers) {
          data.answers = data.answers.map((a, i) => ({ ...a, analytics: qaPairs[i]?.analytics || null }))
        }
        setDebrief(data)
        saveSession({
          role,
          difficulty: difficulty || 'Mid',
          overall_score: data.overall_score,
          answerCount: data.answers?.length || qaPairs.length,
          duration: duration || 0,
        })
      } catch {
        setError('Something went wrong generating your feedback. Please try again.')
      } finally {
        setLoading(false)
      }
    }
    fetchDebrief()
  }, [qaPairs, role, difficulty, duration])

  const handleExportPDF = async () => {
    if (!debriefRef.current) return
    setExporting(true)
    try {
      const [{ default: html2canvas }, jsPDFModule] = await Promise.all([import('html2canvas'), import('jspdf')])
      const JsPDF = jsPDFModule.jsPDF || jsPDFModule.default
      const canvas = await html2canvas(debriefRef.current, { backgroundColor: '#020617', scale: 2, useCORS: true, logging: false })
      const imgData = canvas.toDataURL('image/png')
      const pdf = new JsPDF({ orientation: 'p', unit: 'mm', format: 'a4' })
      const pageW = pdf.internal.pageSize.getWidth(), pageH = pdf.internal.pageSize.getHeight()
      const imgH  = (canvas.height * pageW) / canvas.width
      let heightLeft = imgH, pos = 0
      pdf.addImage(imgData, 'PNG', 0, pos, pageW, imgH)
      heightLeft -= pageH
      while (heightLeft > 0) { pos = heightLeft - imgH; pdf.addPage(); pdf.addImage(imgData, 'PNG', 0, pos, pageW, imgH); heightLeft -= pageH }
      pdf.save(`MockMate-${(role || 'Interview').replace(/\s+/g,'-')}-${new Date().toISOString().slice(0,10)}.pdf`)
    } catch (e) { console.error('PDF export failed:', e) }
    finally { setExporting(false) }
  }

  const handleShare = async () => {
    if (!shareCardRef.current) return
    setSharing(true)
    try {
      const { default: html2canvas } = await import('html2canvas')
      const canvas = await html2canvas(shareCardRef.current, { backgroundColor: '#020617', scale: 2, useCORS: true, logging: false })
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
      const file = new File([blob], 'mockmate-score.png', { type: 'image/png' })
      if (navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file], title: 'My MockMate Score', text: `I scored ${parseFloat(debrief.overall_score).toFixed(1)}/10 on my MockMate interview!` }) }
        catch { /* user cancelled */ }
      } else {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a'); a.href = url; a.download = 'mockmate-score.png'; a.click()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
      }
    } catch (e) { console.error('Share failed:', e) }
    finally { setSharing(false) }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-6 relative overflow-hidden">
        <BgOrbs />
        <div className="relative z-10 flex flex-col items-center gap-4">
          <div className="relative w-20 h-20">
            <div className="absolute inset-0 rounded-full border-4 border-emerald-500/20 animate-ping" />
            <div className="w-20 h-20 rounded-full border-4 border-slate-800 border-t-emerald-500 animate-spin" />
          </div>
          <p className="text-slate-300 text-xl font-bold">Preparing your debrief...</p>
          <p className="text-slate-600 text-sm">Analysing content &amp; speech patterns</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4 px-4 relative overflow-hidden">
        <BgOrbs />
        <div className="relative z-10 glass border border-red-500/25 rounded-3xl p-8 text-center max-w-md">
          <p className="text-4xl mb-4">😕</p>
          <p className="text-red-400 mb-5">{error}</p>
          <button onClick={onRetry}
            className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold px-8 py-3 rounded-2xl transition-all hover:scale-105 shadow-lg shadow-emerald-500/30">
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 py-6 sm:py-10 px-3 sm:px-4 relative overflow-hidden">
      <BgOrbs />

      {/* Hidden share card (captured off-screen) */}
      {debrief && (
        <ShareCard
          cardRef={shareCardRef}
          score={debrief.overall_score}
          role={role}
          difficulty={difficulty || 'Mid'}
          strength={debrief.top_strength}
          date={new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        />
      )}

      <div className="relative z-10 max-w-3xl mx-auto space-y-6" ref={debriefRef}>

        {/* Hero */}
        <div className="text-center animate-fade-up">
          <p className="text-emerald-400 text-sm font-bold uppercase tracking-widest mb-2">✅ Interview Complete</p>
          <h1 className="text-4xl font-black text-white mb-2">Your Full Debrief</h1>
          <p className="text-slate-500 text-sm">{role} · <span className="text-slate-600">{difficulty || 'Mid'} level</span></p>
        </div>

        {/* Overall score */}
        <div className="glass border border-slate-700/40 rounded-3xl p-6 sm:p-10 flex flex-col items-center gap-6 animate-fade-up"
          style={{ animationDelay: '0.05s', boxShadow: '0 0 60px rgba(16,185,129,0.08)' }}>
          <OverallScoreBadge score={debrief.overall_score} />
          <div className="text-center max-w-lg">
            <p className="text-white font-bold text-lg mb-2">Content Score</p>
            <p className="text-slate-400 text-sm leading-relaxed">{debrief.summary}</p>
          </div>
        </div>

        {/* Speech overview */}
        <OverallSpeechSummary qaPairs={qaPairs} sessionDuration={duration} />

        {/* Body language */}
        <BodyLanguageCard metrics={faceMetrics} />

        {/* Interview recording replay */}
        {recording && (
          <div className="glass border border-slate-700/40 rounded-3xl p-6 space-y-4 animate-fade-up">
            <div>
              <p className="text-white font-bold text-lg">🎥 Interview Recording</p>
              <p className="text-slate-500 text-sm mt-1">Review your webcam recording from this interview session.</p>
            </div>
            <video
              src={recording}
              controls
              className="w-full rounded-2xl border border-slate-700/50 bg-black"
            />
            <a
              href={recording}
              download={`MockMate-recording-${new Date().toISOString().slice(0,10)}.webm`}
              className="inline-flex items-center justify-center gap-2 glass-light border border-slate-700/50 hover:border-emerald-500/40 text-slate-300 hover:text-emerald-400 font-semibold px-5 py-3 rounded-2xl transition-all"
            >
              ⬇️ Download Recording
            </a>
          </div>
        )}

        {/* Chart */}
        <AnswerLengthChart answers={debrief.answers} />

        {/* Strength + Improvement */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-up" style={{ animationDelay: '0.2s' }}>
          <div className="glass border border-emerald-500/20 rounded-3xl p-6" style={{ boxShadow: '0 0 30px rgba(16,185,129,0.08)' }}>
            <p className="text-emerald-400 text-xs font-bold uppercase tracking-widest mb-3">🏆 Top Strength</p>
            <p className="text-slate-200 text-sm leading-relaxed">{debrief.top_strength}</p>
          </div>
          <div className="glass border border-amber-500/20 rounded-3xl p-6" style={{ boxShadow: '0 0 30px rgba(245,158,11,0.06)' }}>
            <p className="text-amber-400 text-xs font-bold uppercase tracking-widest mb-3">🎯 Top Improvement</p>
            <p className="text-slate-200 text-sm leading-relaxed">{debrief.top_improvement}</p>
          </div>
        </div>

        {/* Answer breakdown */}
        <div>
          <h2 className="text-white font-black text-xl mb-4 animate-fade-up" style={{ animationDelay: '0.25s' }}>Answer Breakdown</h2>
          <div className="space-y-4">
            {debrief.answers.map((item, i) => (
              <AnswerCard
                key={i}
                item={item}
                index={i}
                role={role}
                onRetry={(question, originalScore) => setRetryQ({ question, originalScore })}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Action buttons — outside ref */}
      <div className="relative z-10 max-w-3xl mx-auto mt-10 flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center justify-center gap-3 pb-10 px-4 sm:px-0">
        {/* Share */}
        <button onClick={handleShare} disabled={sharing}
          className="flex items-center justify-center gap-2 glass border border-slate-700/50 hover:border-slate-600 disabled:opacity-50 text-slate-300 font-semibold px-5 py-3.5 rounded-2xl transition-all hover:bg-slate-800/60">
          {sharing ? <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg> : '🖼️'}
          {sharing ? 'Generating...' : 'Share Score Card'}
        </button>

        {/* PDF */}
        <button onClick={handleExportPDF} disabled={exporting}
          className="flex items-center justify-center gap-2 glass border border-slate-700/50 hover:border-slate-600 disabled:opacity-50 text-slate-300 font-semibold px-5 py-3.5 rounded-2xl transition-all hover:bg-slate-800/60">
          {exporting ? <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg> : '📄'}
          {exporting ? 'Exporting...' : 'Download PDF'}
        </button>

        {/* Retry full interview */}
        <button onClick={onRetry}
          className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold px-10 py-3.5 rounded-2xl transition-all hover:scale-105 shadow-xl shadow-emerald-500/30 hover:shadow-emerald-500/50">
          🎙 Try Again
        </button>
      </div>

      {/* Retry modal */}
      {retryQ && (
        <RetryModal
          question={retryQ.question}
          originalScore={retryQ.originalScore}
          role={role}
          onClose={() => setRetryQ(null)}
        />
      )}
    </div>
  )
}
