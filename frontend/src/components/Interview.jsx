import { useState, useEffect, useRef, useCallback, forwardRef } from 'react'
import { useTTS } from '../hooks/useTTS'
import { useSTT } from '../hooks/useSTT'
import { useFaceAnalysis } from '../hooks/useFaceAnalysis'
import { useMediaRecorder } from '../hooks/useMediaRecorder'
import { analyzeAnswer, getHints, wpmColor, durationLabel } from '../utils/speechAnalytics'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

const MicIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <path d="M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"/>
    <path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v4M8 22h8"/>
  </svg>
)

const CameraIcon = ({ on }) => on ? (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <path d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.89L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/>
  </svg>
) : (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <path d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.89L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2zM3 3l18 18"/>
  </svg>
)

const WAVEFORM_HEIGHTS   = [0.35, 0.65, 0.50, 0.90, 0.70, 1.0, 0.55, 0.80, 0.45, 0.75, 0.35, 0.60, 0.85]
const WAVEFORM_DURATIONS = [0.45, 0.38, 0.52, 0.40, 0.48, 0.35, 0.50, 0.42, 0.55, 0.38, 0.45, 0.41, 0.49]

function AudioWaveform({ active }) {
  return (
    <div className={`flex items-center gap-0.5 h-10 transition-all duration-300 ${active ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}`}>
      {WAVEFORM_HEIGHTS.map((h, i) => (
        <div key={i} style={{
          width: '3px', height: '40px',
          background: 'linear-gradient(180deg, #f87171, #fb923c)',
          borderRadius: '3px', transformOrigin: 'center',
          animation: active ? `waveBar ${WAVEFORM_DURATIONS[i]}s ease-in-out ${i * 0.05}s infinite` : 'none',
          transform: active ? undefined : `scaleY(${h * 0.2})`,
        }} />
      ))}
    </div>
  )
}

function CountdownRing({ seconds, total = 90, visible }) {
  const r = 44, circ = 2 * Math.PI * r
  const offset = circ * (1 - seconds / total)
  const color  = seconds > 20 ? '#10b981' : seconds > 10 ? '#f59e0b' : '#ef4444'
  if (!visible) return null
  return (
    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 96 96" style={{ transform: 'rotate(-90deg)' }}>
      <circle cx="48" cy="48" r={r} fill="none" stroke="rgba(15,23,42,0.6)" strokeWidth="4" />
      <circle cx="48" cy="48" r={r} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round"
        strokeDasharray={circ.toFixed(2)} strokeDashoffset={offset.toFixed(2)}
        style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s', filter: `drop-shadow(0 0 6px ${color})` }} />
    </svg>
  )
}

function VideoAvatar({ status, compact = false }) {
  const isSpeaking = status === 'speaking'

  return (
    <div className={`flex ${compact ? 'flex-row items-center gap-3' : 'flex-col items-center gap-4'}`}>
      <div className="relative">
        {isSpeaking && !compact && (
          <>
            <span className="absolute inset-0 rounded-full bg-emerald-400/15 animate-ping" style={{ animationDuration: '1.5s' }} />
            <span className="absolute -inset-2 rounded-full border border-emerald-400/20 animate-ping" style={{ animationDuration: '2s' }} />
          </>
        )}
        {isSpeaking && compact && (
          <span className="absolute inset-0 rounded-full bg-emerald-400/20 animate-ping" style={{ animationDuration: '1.5s' }} />
        )}
        <div className={`relative rounded-full overflow-hidden transition-all duration-500 ${compact ? 'w-12 h-12' : 'w-28 h-28'} ${
          isSpeaking ? 'ring-2 ring-emerald-400 shadow-lg shadow-emerald-500/40' : 'ring-2 ring-slate-700/60'
        }`}>
          <div className="w-full h-full bg-gradient-to-br from-emerald-400 via-teal-400 to-cyan-500 flex items-center justify-center relative">
            <span className={`font-black text-slate-900 select-none ${compact ? 'text-lg' : 'text-3xl'}`}>A</span>
            <img src="/alex-avatar.jpg" alt="Alex"
              className="absolute inset-0 w-full h-full object-cover object-top"
              onError={(e) => { e.target.style.display = 'none' }} />
          </div>
        </div>
      </div>
      <div className={compact ? '' : 'text-center'}>
        <p className={`text-slate-900 dark:text-white font-bold tracking-wide ${compact ? 'text-xs' : 'text-sm'}`}>Alex — Interviewer</p>
        <div className={`flex items-center gap-1.5 mt-0.5 text-xs font-medium transition-colors duration-300 ${compact ? '' : 'justify-center'} ${
          status === 'speaking'  ? 'text-emerald-400' :
          status === 'listening' ? 'text-red-400'     :
          status === 'thinking'  ? 'text-yellow-400'  : 'text-slate-500'
        }`}>
          <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
          {status === 'speaking' ? 'Speaking...' : status === 'listening' ? 'Listening...' : status === 'thinking' ? 'Thinking...' : 'Ready'}
        </div>
      </div>
    </div>
  )
}

function HintCard({ hints, analytics, questionIndex }) {
  const [open, setOpen] = useState(true)
  if (!hints.length) return null
  const isBehavioral = questionIndex <= 1
  const iconMap = { warning: '⚠️', info: '💡', star: '⭐' }
  return (
    <div className="flex justify-center my-1">
      <div className="w-full max-w-[88%] glass-light border border-amber-500/25 rounded-2xl overflow-hidden">
        <button onClick={() => setOpen(o => !o)}
          className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-white/5 transition">
          <div className="flex items-center gap-2">
            <span className="text-amber-400 text-xs font-bold uppercase tracking-widest">Coach Feedback</span>
            {!open && <span className="text-slate-500 text-xs">({hints.length} tip{hints.length > 1 ? 's' : ''})</span>}
          </div>
          <span className="text-slate-600 text-xs">{open ? '▲' : '▼'}</span>
        </button>
        {open && (
          <div className="px-4 pb-4 space-y-3 border-t border-slate-200 dark:border-slate-700/30 pt-3">
            <div className="flex flex-wrap gap-2 text-xs">
              {analytics.durationSeconds > 0 && <span className="bg-slate-100 dark:bg-slate-800/80 rounded-full px-2.5 py-1 text-slate-700 dark:text-slate-300">⏱ {durationLabel(analytics.durationSeconds)}</span>}
              {analytics.wpm > 0 && <span className={`bg-slate-100 dark:bg-slate-800/80 rounded-full px-2.5 py-1 ${wpmColor(analytics.wpm)}`}>{analytics.wpm} wpm</span>}
              {analytics.totalFillers > 0 && <span className="bg-slate-100 dark:bg-slate-800/80 rounded-full px-2.5 py-1 text-orange-400">{analytics.totalFillers} filler{analytics.totalFillers > 1 ? 's' : ''}</span>}
              {isBehavioral && <span className={`bg-slate-100 dark:bg-slate-800/80 rounded-full px-2.5 py-1 ${analytics.starScore === 4 ? 'text-emerald-400' : analytics.starScore >= 2 ? 'text-yellow-400' : 'text-red-400'}`}>STAR {analytics.starScore}/4</span>}
            </div>
            {hints.map((hint, i) => (
              <div key={i} className="space-y-1">
                <p className="text-slate-700 dark:text-slate-300 text-xs leading-relaxed">{iconMap[hint.type] || '💡'} {hint.text}</p>
                {hint.better && <p className="text-emerald-400 text-xs leading-relaxed pl-3 border-l-2 border-emerald-500/40">Better: {hint.better}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Webcam PiP ───────────────────────────────────────────────────────────────
const WebcamPiP = forwardRef(function WebcamPiP({ stream, metrics }, ref) {
  useEffect(() => {
    if (ref.current && stream) ref.current.srcObject = stream
  }, [stream, ref])
  if (!stream) return null

  const ready = metrics?.samplesCount > 10
  const eyeColor = !ready ? '' :
    metrics.eyeContactPct >= 70 ? 'bg-emerald-600/80' :
    metrics.eyeContactPct >= 40 ? 'bg-amber-500/80'   : 'bg-red-500/80'
  const headColor = !ready ? '' :
    metrics.headStabilityPct >= 70 ? 'bg-emerald-600/80' :
    metrics.headStabilityPct >= 40 ? 'bg-amber-500/80'   : 'bg-red-500/80'
  const headLabel = !ready ? null :
    metrics.headStabilityPct >= 70 ? 'Upright' :
    metrics.headStabilityPct >= 40 ? 'Drifting' : 'Posture'
  const exprMeta = !ready ? null :
    metrics.expression === 'smiling'  ? { label: 'Smiling',  color: 'bg-yellow-500/80', icon: '😊' } :
    metrics.expression === 'serious'  ? { label: 'Serious',  color: 'bg-slate-600/80',  icon: '😐' } :
                                        { label: 'Neutral',  color: 'bg-slate-500/80',  icon: '🙂' }

  return (
    <div className="w-full rounded-2xl overflow-hidden border border-emerald-500/30 shadow-lg relative"
      style={{ aspectRatio: '4/3' }}>
      <video ref={ref} autoPlay muted playsInline className="w-full h-full object-cover scale-x-[-1]" />
      <div className="absolute top-1.5 left-1.5 flex items-center gap-1 bg-black/50 rounded-full px-1.5 py-0.5">
        <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
        <span className="text-white text-[9px] font-medium">YOU</span>
      </div>
      {exprMeta && (
        <div className="absolute top-1.5 right-1.5">
          <span className={`${exprMeta.color} text-white text-[9px] font-bold px-2 py-0.5 rounded-full backdrop-blur-sm`}>
            {exprMeta.icon} {exprMeta.label}
          </span>
        </div>
      )}
      {ready && (
        <div className="absolute bottom-1.5 left-1.5 right-1.5 flex gap-1 flex-wrap">
          <span className={`${eyeColor} text-white text-[9px] font-bold px-2 py-0.5 rounded-full backdrop-blur-sm`}>
            👁 {metrics.eyeContactPct}%
          </span>
          {headLabel && (
            <span className={`${headColor} text-white text-[9px] font-bold px-2 py-0.5 rounded-full backdrop-blur-sm`}>
              {headLabel}
            </span>
          )}
        </div>
      )}
    </div>
  )
})

// ── Transcript slide-in panel ────────────────────────────────────────────────
function TranscriptPanel({ log, onClose }) {
  return (
    <div className="fixed inset-y-0 inset-x-0 sm:inset-x-auto sm:right-0 z-40 sm:w-80 glass border-l border-slate-700/50 flex flex-col shadow-2xl animate-fade-up"
      style={{ animationDuration: '0.25s' }}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/40">
        <span className="text-white font-bold text-sm">📝 Full Transcript</span>
        <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition text-lg leading-none">✕</button>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 text-sm">
        {log.filter(m => m.role !== 'coach').map((msg, i) => (
          <div key={i}>
            <p className={`text-xs font-bold uppercase tracking-widest mb-1 ${msg.role === 'assistant' ? 'text-emerald-400/70' : 'text-slate-500'}`}>
              {msg.role === 'assistant' ? 'Alex' : 'You'}
            </p>
            <p className="text-slate-300 leading-relaxed">{msg.content}</p>
          </div>
        ))}
        {log.filter(m => m.role !== 'coach').length === 0 && (
          <p className="text-slate-600 text-xs">Transcript will appear here as the interview progresses.</p>
        )}
      </div>
    </div>
  )
}

// ── Elapsed timer formatter ──────────────────────────────────────────────────
function fmtTime(s) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

export default function Interview({ sessionData, onComplete }) {
  const { role, questions, intro_message, cv_summary, difficulty = 'Mid', language = 'en-US' } = sessionData

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [history,         setHistory]        = useState([])
  const [conversationLog, setConversationLog] = useState([])
  const [qaPairs,         setQaPairs]        = useState([])
  const [status,          setStatus]         = useState('speaking')
  const [error,           setError]          = useState('')
  const [introPlayed,     setIntroPlayed]    = useState(false)
  const [countdown,       setCountdown]      = useState(90)

  // New state
  const [elapsedSeconds,  setElapsedSeconds]  = useState(0)
  const [showTranscript,  setShowTranscript]  = useState(false)
  const [webcamStream,    setWebcamStream]    = useState(null)
  const [webcamError,     setWebcamError]     = useState('')

  const conversationEndRef   = useRef(null)
  const isHoldingRef         = useRef(false)
  const canRecordRef         = useRef(false)
  const recordingStartRef    = useRef(null)
  const currentIndexRef      = useRef(0)
  const followupGivenRef     = useRef(false)
  const countdownIntervalRef = useRef(null)
  const elapsedIntervalRef   = useRef(null)
  const sessionStartRef      = useRef(Date.now())
  const webcamVideoRef       = useRef(null)
  const faceMetricsRef       = useRef(null)
  const recordingUrlRef      = useRef(null)

  const faceMetrics = useFaceAnalysis(webcamVideoRef, !!webcamStream)
  faceMetricsRef.current = faceMetrics

  const { recordingUrl, startRecording, stopRecording } = useMediaRecorder()
  recordingUrlRef.current = recordingUrl

  useEffect(() => { currentIndexRef.current = currentQuestionIndex }, [currentQuestionIndex])

  // Elapsed timer — starts immediately, keeps counting for duration tracking
  useEffect(() => {
    elapsedIntervalRef.current = setInterval(() => setElapsedSeconds(s => s + 1), 1000)
    return () => clearInterval(elapsedIntervalRef.current)
  }, [])

  // Cleanup webcam on unmount
  useEffect(() => {
    return () => { webcamStream?.getTracks().forEach(t => t.stop()) }
  }, [webcamStream])

  const toggleWebcam = async () => {
    if (webcamStream) {

      // Stop recording before turning off the camera stream.
      stopRecording()
      webcamStream.getTracks().forEach(t => t.stop())
      setWebcamStream(null)
      setWebcamError('')
    } else {
      try {
        // We request both camera and microphone because the interview recording
        // should include the user's video and spoken answers.
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        setWebcamStream(stream)
        setWebcamError('')
        startRecording(stream)
      } catch {
        setWebcamError('Camera or microphone access denied.')
      }
    }
  }

  const { speak, isSupported: ttsSupported } = useTTS({ language })

  const handleFinalTranscript = useCallback(async (transcript) => {
    if (!transcript.trim()) {
      // STT ended with no speech (no-speech timeout, space pressed too fast, etc.)
      // Must reset status so the mic button becomes usable again.
      setStatus('idle')
      canRecordRef.current = true
      return
    }
    const durationSeconds = recordingStartRef.current ? (Date.now() - recordingStartRef.current) / 1000 : 0
    recordingStartRef.current = null
    const idx       = currentIndexRef.current
    const analytics = analyzeAnswer(transcript, durationSeconds)
    const hints     = getHints(analytics, idx)

    setConversationLog(prev => [
      ...prev,
      { role: 'user', content: transcript },
      ...(hints.length ? [{ role: 'coach', hints, analytics, questionIndex: idx }] : []),
    ])
    const newHistory = [...history, { role: 'user', content: transcript }]
    setStatus('thinking')

    try {
      const res = await fetch(`${BACKEND_URL}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          history: newHistory,
          user_answer: transcript,
          current_question_index: currentQuestionIndex,
          questions,
          role,
          cv_summary,
          difficulty,
          allow_followup: !followupGivenRef.current,
          language,
        }),
      })
      if (!res.ok) throw new Error('Failed to get response')
      const data = await res.json()
      const { reply, done, followup } = data

      const updatedHistory = [...newHistory, { role: 'assistant', content: reply }]
      setHistory(updatedHistory)
      setConversationLog(prev => [...prev, { role: 'assistant', content: reply }])

      if (followup) {
        followupGivenRef.current = true
        setStatus('speaking')
        canRecordRef.current = false
        let followupDone = false
        const followupComplete = () => {
          if (followupDone) return
          followupDone = true
          setStatus('idle')
          canRecordRef.current = true
        }
        const followupFallback = setTimeout(followupComplete, 12000)
        speak(reply, () => { clearTimeout(followupFallback); followupComplete() })
        return
      }

      followupGivenRef.current = false
      const updatedPairs = [...qaPairs, { question: questions[idx], answer: transcript, analytics }]
      setQaPairs(updatedPairs)
      setStatus('speaking')
      canRecordRef.current = false
      if (done) {
        const totalDuration = Math.round((Date.now() - sessionStartRef.current) / 1000)
        let completed = false
        const complete = () => {
          if (completed) return
          completed = true
          stopRecording()
          setTimeout(() => onComplete(updatedPairs, totalDuration, faceMetricsRef.current, recordingUrlRef.current), 800)
        }
        const fallbackTimer = setTimeout(complete, 12000)
        speak(reply, () => { clearTimeout(fallbackTimer); complete() })
      } else {
        let advanced = false
        const advance = () => {
          if (advanced) return
          advanced = true
          setCurrentQuestionIndex(i => i + 1)
          setStatus('idle')
          canRecordRef.current = true
        }
        const advanceFallback = setTimeout(advance, 12000)
        speak(reply, () => { clearTimeout(advanceFallback); advance() })
      }
    } catch {
      setError('Something went wrong, please try again.')
      setStatus('idle')
      canRecordRef.current = true
    }
  }, [history, questions, qaPairs, speak, onComplete, role, cv_summary, difficulty, language])

  const { start, stop, isListening, interimTranscript, isSupported: sttSupported } = useSTT({
    onFinalTranscript: handleFinalTranscript,
    language,
  })

  useEffect(() => {
    if (isListening) {
      setCountdown(90)
      countdownIntervalRef.current = setInterval(() => {
        setCountdown(prev => { if (prev <= 1) { stop(); return 90 } return prev - 1 })
      }, 1000)
    } else {
      clearInterval(countdownIntervalRef.current)
      setCountdown(90)
    }
    return () => clearInterval(countdownIntervalRef.current)
  }, [isListening, stop])

  useEffect(() => {
    if (!introPlayed) {
      setIntroPlayed(true)
      setConversationLog([{ role: 'assistant', content: intro_message }])
      setHistory([{ role: 'assistant', content: intro_message }])
      setStatus('speaking')
      canRecordRef.current = false
      speak(intro_message, () => { setStatus('idle'); canRecordRef.current = true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.code !== 'Space' || e.repeat) return
      const tag = document.activeElement.tagName
      if (tag === 'TEXTAREA' || tag === 'INPUT') return
      e.preventDefault()

      if (status === 'listening') {
        // Press Space to stop — works whether started by keyboard or mic button
        isHoldingRef.current = false
        stop()
      } else if (canRecordRef.current && status === 'idle') {
        isHoldingRef.current = true
        recordingStartRef.current = Date.now()
        setStatus('listening')
        start()
      }
    }
    const onKeyUp = (e) => {
      if (e.code !== 'Space') return
      e.preventDefault()
      // PTT release: stop if we started via keyboard hold
      if (isHoldingRef.current) {
        isHoldingRef.current = false
        stop()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp) }
  }, [start, stop, status])

  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conversationLog, interimTranscript])

  const handleMicDown = () => {
    if (!canRecordRef.current || status !== 'idle') return
    recordingStartRef.current = Date.now()
    setStatus('listening')
    start()
  }
  const handleMicUp = () => { if (isListening) stop() }

  const micDisabled = status !== 'idle' || !sttSupported
  const isSpeaking  = status === 'speaking'
  const isThinking  = status === 'thinking'
  const progressPct = Math.round((currentQuestionIndex / questions.length) * 100)

  return (
    <div className="h-screen bg-slate-50 dark:bg-slate-950 flex flex-col overflow-hidden relative">
      {/* Background orbs */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="animate-orb absolute top-0 right-0 w-72 h-72 rounded-full bg-emerald-500/6 blur-3xl" />
        <div className="animate-orb-r absolute bottom-0 left-0 w-64 h-64 rounded-full bg-cyan-500/6 blur-3xl" />
      </div>

      {/* ── Header ── */}
      <header className="relative z-10 glass border-b border-slate-200 dark:border-slate-700/50 px-4 py-3 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          {/* Left: logo + meta */}
          <div className="flex items-center gap-3">
            <span className="font-black text-lg">
              <span className="text-slate-900 dark:text-white">Mock</span><span className="gradient-text">Mate</span>
            </span>
            <span className="hidden sm:block text-slate-500 dark:text-slate-600 text-xs border border-slate-200 dark:border-slate-700/60 rounded-full px-2 py-0.5">{difficulty}</span>
            <span className="hidden sm:block text-slate-600 dark:text-slate-400 text-sm truncate max-w-[180px]">— {role}</span>
          </div>

          {/* Right: timer + controls + Q counter */}
          <div className="flex items-center gap-2">
            {/* Elapsed timer */}
            <div className="hidden sm:flex items-center gap-1.5 text-slate-600 dark:text-slate-500 text-xs font-mono bg-slate-100/80 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/40 rounded-full px-2.5 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {fmtTime(elapsedSeconds)}
            </div>

            {/* Transcript toggle */}
            <button
              onClick={() => setShowTranscript(o => !o)}
              title="View full transcript"
              className={`p-1.5 rounded-full text-sm transition-all border ${
                showTranscript ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' : 'glass-light border-slate-700/40 text-slate-500 hover:text-slate-300'
              }`}
            >
              📝
            </button>

          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700"
            style={{ width: `${progressPct}%`, background: 'linear-gradient(90deg,#10b981,#06b6d4)', boxShadow: '0 0 8px rgba(16,185,129,0.6)' }} />
        </div>
      </header>

      {webcamError && (
        <div className="relative z-10 bg-amber-500/10 border-b border-amber-500/25 px-6 py-2 text-amber-400 text-xs text-center">{webcamError}</div>
      )}
      {!sttSupported && (
        <div className="relative z-10 bg-amber-500/10 border-b border-amber-500/25 px-6 py-2 text-amber-400 text-sm text-center">
          Voice input not supported — please use Chrome.
        </div>
      )}

      <div className="flex-1 flex flex-col lg:flex-row gap-0 overflow-hidden relative z-10">
        {/* ── Left panel ── */}
        <div className="lg:w-72 glass-light border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-700/40
          flex flex-row lg:flex-col items-center justify-between lg:justify-center
          py-3 px-4 lg:py-8 lg:px-6 gap-3 lg:gap-6">

          {/* Avatar + webcam feed */}
          <div className="flex-shrink-0 flex flex-col items-center gap-3">
            <div className="block lg:hidden"><VideoAvatar status={status} compact /></div>
            <div className="hidden lg:block"><VideoAvatar status={status} /></div>
            {/* Webcam below Alex — desktop only */}
            <div className="hidden lg:block w-full px-1">
              <WebcamPiP ref={webcamVideoRef} stream={webcamStream} metrics={faceMetrics} />
            </div>
          </div>

          {/* Middle section */}
          <div className="flex-1 lg:flex-none flex flex-col lg:items-center gap-1.5 lg:gap-0">
            {isThinking && (
              <div className="flex items-center gap-2 text-yellow-400 text-xs lg:text-sm lg:mb-0">
                <div className="flex gap-1">
                  {[0,1,2].map(i => (
                    <span key={i} className="w-1.5 h-1.5 rounded-full bg-yellow-400"
                      style={{ animation: `pulse 1s ease-in-out ${i * 0.2}s infinite` }} />
                  ))}
                </div>
                Thinking...
              </div>
            )}
            {/* Question progress dots */}
            <div className="flex gap-1.5 lg:gap-2.5 lg:mt-0">
              {questions.map((_, i) => (
                <div key={i} className={`rounded-full transition-all duration-500 ${
                  i < currentQuestionIndex  ? 'w-2 h-2 lg:w-2.5 lg:h-2.5 bg-emerald-400 shadow-sm shadow-emerald-500/50' :
                  i === currentQuestionIndex ? 'w-2.5 h-2.5 lg:w-3 lg:h-3 bg-emerald-400 ring-2 ring-emerald-400/30 shadow-md shadow-emerald-500/50' :
                  'w-2 h-2 lg:w-2.5 lg:h-2.5 bg-slate-300 dark:bg-slate-700'
                }`} />
              ))}
            </div>
            {/* Elapsed time (mobile only) */}
            <div className="lg:hidden flex items-center gap-1.5 text-slate-500 text-xs font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {fmtTime(elapsedSeconds)}
            </div>
          </div>

          {/* Live Coach label — desktop only */}
          <div className="hidden lg:block text-center space-y-1 px-2">
            <p className="text-slate-600 dark:text-slate-500 text-xs font-semibold uppercase tracking-widest">Live Coach</p>
            <p className="text-slate-600 dark:text-slate-600 text-xs leading-relaxed">Instant feedback appears after each answer</p>
          </div>
        </div>

        {/* ── Right panel ── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Chat */}
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-3">
            {conversationLog.map((msg, i) => {
              if (msg.role === 'coach') return <HintCard key={i} hints={msg.hints} analytics={msg.analytics} questionIndex={msg.questionIndex} />
              return (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-up`}
                  style={{ animationDuration: '0.3s' }}>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-br from-emerald-500/25 to-teal-500/20 text-emerald-100 border border-emerald-500/25'
                      : 'glass-light text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700/40'
                  }`}>
                    {msg.role === 'assistant' && <p className="text-xs text-emerald-400/70 mb-1 font-bold tracking-wide">ALEX</p>}
                    {msg.content}
                  </div>
                </div>
              )
            })}

            {interimTranscript && (
              <div className="flex justify-end animate-fade-up">
                <div className="max-w-[80%] rounded-2xl px-4 py-3 text-sm bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 italic">
                  {interimTranscript}
                  <span className="inline-block w-0.5 h-4 bg-emerald-400 ml-1 animate-pulse align-middle" />
                </div>
              </div>
            )}
            <div ref={conversationEndRef} />
          </div>

          {/* ── Bottom controls ── */}
          <div className="border-t border-slate-200 dark:border-slate-700/40 glass px-4 sm:px-6 py-4 sm:py-5">
            {error && (
              <div className="mb-3 bg-red-500/10 border border-red-500/25 rounded-2xl px-4 py-2 text-red-400 text-sm text-center">
                {error}
                <button onClick={() => setError('')} className="ml-2 underline text-xs opacity-70">Dismiss</button>
              </div>
            )}
            <div className="flex flex-col items-center gap-2 sm:gap-3">
              <AudioWaveform active={isListening} />

              {/* Mic + Camera row */}
              <div className="flex items-center gap-4 sm:gap-5">
                {/* Camera — small minimal button */}
                <button
                  onClick={toggleWebcam}
                  title={webcamStream ? 'Turn off camera' : 'Turn on camera'}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 border ${
                    webcamStream
                      ? 'bg-blue-500/15 border-blue-500/35 text-blue-400'
                      : 'bg-slate-100/80 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/50 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-500'
                  }`}
                >
                  <CameraIcon on={!!webcamStream} />
                </button>

                {/* Mic — primary action */}
                <div className="relative w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center">
                  <CountdownRing seconds={countdown} total={90} visible={isListening} />
                  <button
                    onMouseDown={handleMicDown} onMouseUp={handleMicUp}
                    onTouchStart={(e) => { e.preventDefault(); handleMicDown() }}
                    onTouchEnd={(e)   => { e.preventDefault(); handleMicUp()   }}
                    disabled={micDisabled}
                    className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all duration-200 select-none z-10 ${
                      isListening
                        ? 'bg-gradient-to-br from-red-500 to-rose-600 text-white btn-recording scale-105'
                        : isSpeaking || isThinking
                        ? 'bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 text-slate-400 dark:text-slate-600 cursor-not-allowed'
                        : 'bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/30 hover:scale-105'
                    }`}
                  >
                    <MicIcon />
                  </button>
                </div>
              </div>

              <p className={`text-xs font-semibold tracking-wide transition-colors duration-300 text-center ${
                isListening ? 'text-red-400' : isSpeaking ? 'text-slate-600' : isThinking ? 'text-yellow-400' : 'text-slate-500'
              }`}>
                {isListening ? `${countdown}s remaining — press Space to send` :
                 isSpeaking  ? 'Alex is speaking...' :
                 isThinking  ? 'Processing your answer...' :
                 'Hold mic · or Space to start / stop'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Transcript panel */}
      {showTranscript && <TranscriptPanel log={conversationLog} onClose={() => setShowTranscript(false)} />}
    </div>
  )
}
