import { useState, useEffect, useRef, useCallback, forwardRef } from 'react'
import { useTTS } from '../hooks/useTTS'
import { useSTT } from '../hooks/useSTT'
import { useFaceAnalysis } from '../hooks/useFaceAnalysis'
import { useMediaRecorder } from '../hooks/useMediaRecorder'
import { analyzeAnswer } from '../utils/speechAnalytics'
import { getStoredToken } from '../context/AuthContext'
import { getInterviewer, getVoice } from '../utils/interviewers'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

const MicIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <path d="M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"/>
    <path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v4M8 22h8"/>
  </svg>
)

const CameraIcon = ({ on }) => on ? (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <path d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.89L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/>
  </svg>
) : (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <path d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.89L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2zM3 3l18 18"/>
  </svg>
)

const TranscriptIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    <path d="M8 9h8M8 13h5"/>
  </svg>
)

const EndIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <path d="M3.5 14.5c4.7-4.2 12.3-4.2 17 0l-1.9 2.4a1 1 0 0 1-1.3.2l-2.4-1.5a1 1 0 0 1-.5-.9V12.8a12 12 0 0 0-4.8 0v1.9a1 1 0 0 1-.5.9l-2.4 1.5a1 1 0 0 1-1.3-.2z"/>
  </svg>
)

const WAVEFORM_DURATIONS = [0.45, 0.38, 0.52, 0.40, 0.48, 0.35, 0.50, 0.42, 0.55, 0.38, 0.45, 0.41, 0.49]

function CountdownRing({ seconds, total = 90, visible }) {
  const r = 44, circ = 2 * Math.PI * r
  const offset = circ * (1 - seconds / total)
  const color  = seconds > 20 ? '#10b981' : seconds > 10 ? '#f59e0b' : '#ef4444'
  if (!visible) return null
  return (
    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 96 96" style={{ transform: 'rotate(-90deg)' }}>
      <circle cx="48" cy="48" r={r} fill="none" stroke="rgba(100,116,139,0.18)" strokeWidth="4" />
      <circle cx="48" cy="48" r={r} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round"
        strokeDasharray={circ.toFixed(2)} strokeDashoffset={offset.toFixed(2)}
        style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s', filter: `drop-shadow(0 0 6px ${color})` }} />
    </svg>
  )
}

const TALK_BARS = [0, 1, 2, 3, 4]

// Small animated bars on a video tile while that person is talking
function TalkingBars({ color }) {
  return (
    <span className="flex items-center gap-0.5 h-3.5">
      {TALK_BARS.map(i => (
        <span key={i} style={{
          width: 3, height: 14, background: color, borderRadius: 2,
          animation: `waveBar ${WAVEFORM_DURATIONS[i]}s ease-in-out ${i * 0.07}s infinite`,
        }} />
      ))}
    </span>
  )
}

const TILE_LABEL = 'absolute bottom-2.5 left-2.5 sm:bottom-3 sm:left-3 flex items-center gap-2 bg-black/55 backdrop-blur-sm rounded-full px-2.5 sm:px-3 py-1 text-white text-[11px] sm:text-xs font-semibold'

// ── Interviewer "video" tile ─────────────────────────────────────────────────
// Three stacked layers, cross-faded by status:
//   idle (waiting for you) → a still frame, so the interviewer is not moving
//   you are answering / the interviewer is thinking → "listening" loop (nods, blinks)
//   the interviewer is speaking → "talking" loop
// Both loops start on a frame that matches the still, and each restarts from
// there, so going from still to video has no jump.
// Missing files fall back to the photo, and then to the initial.
const FADE_MS = 450

function InterviewerTile({ interviewer, status }) {
  const speaking  = status === 'speaking'
  const listening = status === 'listening' || status === 'thinking'
  const [stillSrc,    setStillSrc]    = useState(interviewer.idle || interviewer.photo)
  const [listeningOk, setListeningOk] = useState(true)
  const [talkingOk,   setTalkingOk]   = useState(true)
  const listeningRef = useRef(null)
  const talkingRef   = useRef(null)

  // Listening loop: start from its first frame (= the still); rewind after it fades out
  useEffect(() => {
    const v = listeningRef.current
    if (!v) return
    if (listening) {
      v.currentTime = 0
      v.play().catch(() => {})
      return
    }
    const t = setTimeout(() => { v.pause(); v.currentTime = 0 }, FADE_MS)
    return () => clearTimeout(t)
  }, [listening])

  // Talking loop: every phrase starts from its first frame (= the still); rewind after it fades out
  useEffect(() => {
    const v = talkingRef.current
    if (!v) return
    if (speaking) {
      v.currentTime = 0
      v.play().catch(() => {})
      return
    }
    const t = setTimeout(() => { v.pause(); v.currentTime = 0 }, FADE_MS)
    return () => clearTimeout(t)
  }, [speaking])

  const state =
    status === 'thinking'  ? { text: 'Thinking…',       cls: 'text-yellow-300' } :
    status === 'listening' ? { text: 'Listening',       cls: 'text-slate-200'  } :
                             { text: 'Waiting for you', cls: 'text-slate-300'  }
  const media = 'absolute inset-0 w-full h-full object-cover transition-opacity ease-in-out'
  const fade  = { transitionDuration: `${FADE_MS}ms` }

  return (
    <div
      className={`relative w-full aspect-video rounded-2xl sm:rounded-3xl overflow-hidden transition-all duration-300 ${
        speaking ? 'ring-4 ring-emerald-400/80 shadow-xl shadow-emerald-500/25' : 'ring-1 ring-slate-300 dark:ring-slate-700/60'
      }`}
      style={{ background: interviewer.background }}
    >
      <span className="absolute inset-0 flex items-center justify-center text-6xl font-black text-white/70 select-none">
        {interviewer.name[0]}
      </span>
      {stillSrc && (
        <img src={stillSrc} alt={interviewer.name} className={media} style={fade}
          onError={() => setStillSrc(s => (s === interviewer.idle ? interviewer.photo : null))} />
      )}
      {listeningOk && (
        <video ref={listeningRef} src={interviewer.listening} className={`${media} ${listening ? 'opacity-100' : 'opacity-0'}`} style={fade}
          loop muted playsInline preload="auto" onError={() => setListeningOk(false)} />
      )}
      {talkingOk && (
        <video ref={talkingRef} src={interviewer.talking} className={`${media} ${speaking ? 'opacity-100' : 'opacity-0'}`} style={fade}
          loop muted playsInline preload="auto" onError={() => setTalkingOk(false)} />
      )}
      <div className={TILE_LABEL}>
        <span>{interviewer.name} · Interviewer</span>
        {speaking
          ? <TalkingBars color="#34d399" />
          : <span className={`font-medium ${state.cls}`}>{state.text}</span>}
      </div>
    </div>
  )
}

// ── "End interview?" confirmation ────────────────────────────────────────────
function EndInterviewDialog({ answered, total, onFeedback, onLeave, onCancel }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(2,6,23,0.75)', backdropFilter: 'blur(8px)' }} onClick={onCancel}>
      <div className="w-full max-w-sm glass bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700/50 rounded-3xl p-6 shadow-2xl animate-fade-up"
        style={{ animationDuration: '0.2s' }} onClick={(e) => e.stopPropagation()}>
        <p className="text-slate-900 dark:text-white font-bold text-lg">End the interview?</p>
        <p className="text-slate-600 dark:text-slate-400 text-sm mt-1 mb-5">
          You have answered {answered} of {total} {total === 1 ? 'question' : 'questions'}.
        </p>
        <div className="space-y-2">
          {answered > 0 && (
            <button onClick={onFeedback}
              className="w-full py-3 rounded-2xl text-sm font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 transition-all">
              End and get feedback
            </button>
          )}
          <button onClick={onLeave}
            className="w-full py-3 rounded-2xl text-sm font-bold text-red-500 dark:text-red-400 border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 transition-all">
            Leave without feedback
          </button>
          <button onClick={onCancel}
            className="w-full py-3 rounded-2xl text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-all">
            Continue the interview
          </button>
        </div>
      </div>
    </div>
  )
}

// ── You: webcam tile (or a placeholder while the camera is off) ──────────────
const YouTile = forwardRef(function YouTile({ stream, metrics, listening, onTurnOnCamera, className = '' }, ref) {
  useEffect(() => {
    if (ref.current && stream) ref.current.srcObject = stream
  }, [stream, ref])

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
  const badge = 'text-white text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full backdrop-blur-sm'

  return (
    <div className={`relative aspect-video rounded-xl sm:rounded-3xl overflow-hidden bg-slate-200 dark:bg-slate-800 transition-all duration-300 ${
      listening ? 'ring-4 ring-red-400/80 shadow-xl shadow-red-500/25' : 'ring-1 ring-slate-300 dark:ring-slate-700/60'
    } ${className}`}>
      {stream ? (
        <>
          <video ref={ref} autoPlay muted playsInline className="w-full h-full object-cover scale-x-[-1]" />
          {exprMeta && (
            <span className={`absolute top-2.5 right-2.5 hidden sm:inline ${exprMeta.color} ${badge}`}>
              {exprMeta.icon} {exprMeta.label}
            </span>
          )}
          {ready && (
            <div className="absolute top-2.5 left-2.5 hidden sm:flex gap-1">
              <span className={`${eyeColor} ${badge}`}>👁 {metrics.eyeContactPct}%</span>
              {headLabel && <span className={`${headColor} ${badge}`}>{headLabel}</span>}
            </div>
          )}
        </>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 sm:gap-3 p-2">
          <button
            onClick={onTurnOnCamera}
            title="Turn on camera"
            className="w-10 h-10 sm:w-14 sm:h-14 rounded-full bg-slate-300 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center hover:bg-emerald-500 hover:text-white transition-all"
          >
            <CameraIcon on={false} />
          </button>
          <p className="hidden sm:block text-slate-600 dark:text-slate-400 text-sm font-medium">Your camera is off</p>
          <button
            onClick={onTurnOnCamera}
            className="hidden sm:block text-emerald-600 dark:text-emerald-400 text-xs font-semibold hover:underline"
          >
            Turn on camera
          </button>
        </div>
      )}
      <div className={`${TILE_LABEL} ${stream ? '' : 'hidden sm:flex'}`}>
        <span>You</span>
        {listening && <TalkingBars color="#f87171" />}
      </div>
    </div>
  )
})

// ── Transcript slide-in panel ────────────────────────────────────────────────
function TranscriptPanel({ log, interviewerName, onClose }) {
  return (
    <div className="fixed inset-y-0 inset-x-0 sm:inset-x-auto sm:right-0 z-40 sm:w-96 glass bg-white/95 dark:bg-slate-950/95 border-l border-slate-200 dark:border-slate-700/50 flex flex-col shadow-2xl animate-fade-up"
      style={{ animationDuration: '0.25s' }}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700/40">
        <span className="text-slate-900 dark:text-white font-bold text-sm">📝 Full conversation</span>
        <button onClick={onClose} className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 transition text-lg leading-none">✕</button>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 text-sm">
        {log.map((msg, i) => (
          <div key={i}>
            <p className={`text-xs font-bold uppercase tracking-widest mb-1 ${msg.role === 'assistant' ? 'text-emerald-400/70' : 'text-slate-500'}`}>
              {msg.role === 'assistant' ? interviewerName : 'You'}
            </p>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{msg.content}</p>
          </div>
        ))}
        {log.length === 0 && (
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

export default function Interview({ sessionData, onComplete, onExit }) {
  const { role, questions, question_plan, intro_message, cv_summary, difficulty = 'Mid', language = 'en-US' } = sessionData
  const interviewer = getInterviewer(sessionData.interviewer)

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
  const [showEndDialog,   setShowEndDialog]   = useState(false)

  const conversationEndRef   = useRef(null)
  const isHoldingRef         = useRef(false)
  const canRecordRef         = useRef(false)
  const recordingStartRef    = useRef(null)
  const currentIndexRef      = useRef(0)
  const followupRef          = useRef(null)   // { first_answer, followup_question } while a follow-up is open
  const countdownIntervalRef = useRef(null)
  const elapsedIntervalRef   = useRef(null)
  const sessionStartRef      = useRef(Date.now())
  const webcamVideoRef       = useRef(null)
  const faceMetricsRef       = useRef(null)
  const recordingUrlRef      = useRef(null)
  const endedRef             = useRef(false)  // set once the user ends the interview early

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

  const { speak, prefetch, cancel: cancelTTS, isSupported: ttsSupported } = useTTS({ language, interviewer: interviewer.id, voice: getVoice(interviewer.id) })

  // The interviewer's lips move only while sound is actually playing, not while the audio is still loading
  const [audioPlaying, setAudioPlaying] = useState(false)
  const say = useCallback((text, onEnd) => {
    setAudioPlaying(false)
    speak(text, () => { setAudioPlaying(false); onEnd?.() }, () => setAudioPlaying(true))
  }, [speak])

  // Kick off TTS fetch for the intro immediately on first render — before any useEffect fires
  const prefetchedRef = useRef(false)
  if (!prefetchedRef.current) {
    prefetchedRef.current = true
    prefetch(intro_message)
  }

  const handleFinalTranscript = useCallback(async (transcript) => {
    if (endedRef.current) return
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
    // Speech stats are kept for the final report; no feedback is shown during the interview
    const analytics = analyzeAnswer(transcript, durationSeconds)

    setConversationLog(prev => [...prev, { role: 'user', content: transcript }])
    const newHistory = [...history, { role: 'user', content: transcript }]
    setStatus('thinking')

    try {
      const res = await fetch(`${BACKEND_URL}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getStoredToken()}` },
        body: JSON.stringify({
          history: newHistory,
          user_answer: transcript,
          current_question_index: currentQuestionIndex,
          questions,
          question_plan,
          role,
          cv_summary,
          difficulty,
          allow_followup: !followupRef.current,
          language,
          interviewer: interviewer.id,
        }),
      })
      if (!res.ok) throw new Error('Failed to get response')
      const data = await res.json()
      if (endedRef.current) return
      const { reply, done, followup } = data

      const updatedHistory = [...newHistory, { role: 'assistant', content: reply }]
      setHistory(updatedHistory)
      setConversationLog(prev => [...prev, { role: 'assistant', content: reply }])

      if (followup) {
        // Keep the first answer and the follow-up so the debrief sees the whole exchange
        followupRef.current = { first_answer: transcript, followup_question: reply }
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
        say(reply, () => { clearTimeout(followupFallback); followupComplete() })
        return
      }

      const updatedPairs = [...qaPairs, { question: questions[idx], answer: transcript, analytics, ...(followupRef.current || {}) }]
      followupRef.current = null
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
        say(reply, () => { clearTimeout(fallbackTimer); complete() })
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
        say(reply, () => { clearTimeout(advanceFallback); advance() })
      }
    } catch {
      setError('Something went wrong, please try again.')
      setStatus('idle')
      canRecordRef.current = true
    }
  }, [history, questions, question_plan, qaPairs, say, onComplete, role, cv_summary, difficulty, language, interviewer.id])

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
      say(intro_message, () => { setStatus('idle'); canRecordRef.current = true })
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

  // ── Ending the interview early ──
  const stopEverything = () => {
    endedRef.current = true
    canRecordRef.current = false
    cancelTTS()
    setAudioPlaying(false)
    stop()
    stopRecording()
  }
  const endWithFeedback = () => {
    stopEverything()
    setShowEndDialog(false)
    const totalDuration = Math.round((Date.now() - sessionStartRef.current) / 1000)
    // Give the recorder a moment to produce the recording URL, as on a normal finish
    setTimeout(() => onComplete(qaPairs, totalDuration, faceMetricsRef.current, recordingUrlRef.current), 800)
  }
  const leaveInterview = () => {
    stopEverything()
    onExit?.()
  }

  const micDisabled = status !== 'idle' || !sttSupported
  // While the reply audio is still loading, the interviewer keeps listening (or stays still before the first answer)
  const tileStatus = status === 'speaking' && !audioPlaying
    ? (conversationLog.some(m => m.role === 'user') ? 'thinking' : 'idle')
    : status
  const isSpeaking  = status === 'speaking'
  const isThinking  = status === 'thinking'
  const progressPct = Math.round((currentQuestionIndex / questions.length) * 100)

  // Captions: the interviewer's latest line and your answer to it
  const lastInterviewerIdx = conversationLog.map(m => m.role).lastIndexOf('assistant')
  const lastLine    = lastInterviewerIdx >= 0 ? conversationLog[lastInterviewerIdx] : null
  const yourAnswer  = conversationLog.slice(lastInterviewerIdx + 1).find(m => m.role === 'user')
  const yourLine    = interimTranscript || yourAnswer?.content

  const roundBtn = 'w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all duration-200 border'

  return (
    <div className="h-screen dark:bg-slate-950 flex flex-col overflow-hidden relative">
      {/* Background orbs */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="animate-orb absolute top-0 right-0 w-72 h-72 rounded-full bg-emerald-500/6 blur-3xl" />
        <div className="animate-orb-r absolute bottom-0 left-0 w-64 h-64 rounded-full bg-cyan-500/6 blur-3xl" />
      </div>

      {/* ── Header ── */}
      <header className="relative z-10 glass border-b border-slate-200 dark:border-slate-700/50 px-4 py-3 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          {/* Left: logo + meta */}
          <div className="flex items-center gap-3 min-w-0">
            <span className="font-black text-lg flex-shrink-0">
              <span className="text-slate-900 dark:text-white">Mock</span><span className="gradient-text">Mate</span>
            </span>
            <span className="hidden sm:block text-slate-500 dark:text-slate-600 text-xs border border-slate-200 dark:border-slate-700/60 rounded-full px-2 py-0.5">{difficulty}</span>
            <span className="hidden sm:block text-slate-600 dark:text-slate-400 text-sm truncate max-w-[260px]">— {role}</span>
          </div>

          {/* Right: question progress + timer */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-slate-600 dark:text-slate-400 text-xs font-semibold">
                Q{Math.min(currentQuestionIndex + 1, questions.length)}/{questions.length}
              </span>
              <div className="hidden sm:flex gap-1.5">
                {questions.map((_, i) => (
                  <div key={i} className={`rounded-full transition-all duration-500 ${
                    i < currentQuestionIndex   ? 'w-2 h-2 bg-emerald-400' :
                    i === currentQuestionIndex ? 'w-2.5 h-2.5 bg-emerald-400 ring-2 ring-emerald-400/30' :
                    'w-2 h-2 bg-slate-300 dark:bg-slate-700'
                  }`} />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-500 text-xs font-mono bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/40 rounded-full px-2.5 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {fmtTime(elapsedSeconds)}
            </div>
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

      <div className="flex-1 flex flex-col overflow-hidden relative z-10">
        {/* ── Video tiles: the interviewer and you, side by side like a video call ── */}
        {/* Width is capped by screen height so both tiles and the captions fit */}
        <div className="w-full mx-auto px-3 sm:px-6 pt-3 sm:pt-5" style={{ maxWidth: 'min(72rem, calc(150vh - 6rem))' }}>
          <div className="relative grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <InterviewerTile interviewer={interviewer} status={tileStatus} />
            {/* On phones your tile floats in the corner of the interviewer's tile */}
            <YouTile
              ref={webcamVideoRef}
              stream={webcamStream}
              metrics={faceMetrics}
              listening={isListening}
              onTurnOnCamera={toggleWebcam}
              className="!absolute top-2.5 right-2.5 w-[34%] z-10 shadow-lg sm:!relative sm:top-auto sm:right-auto sm:w-full sm:shadow-none"
            />
          </div>
        </div>

        {/* ── Captions ── */}
        <div className="flex-1 overflow-y-auto">
          <div className="w-full mx-auto px-3 sm:px-6 py-3 sm:py-4 space-y-2.5" style={{ maxWidth: 'min(72rem, calc(150vh - 6rem))' }}>
            {lastLine && (
              <div key={lastInterviewerIdx} className="glass-light border border-slate-200 dark:border-slate-700/40 rounded-2xl px-4 sm:px-5 py-3 animate-fade-up" style={{ animationDuration: '0.3s' }}>
                <p className="text-xs text-emerald-500 dark:text-emerald-400/80 mb-1 font-bold tracking-widest">{interviewer.name.toUpperCase()}</p>
                <p className="text-slate-800 dark:text-slate-100 text-base sm:text-lg leading-relaxed font-medium">{lastLine.content}</p>
              </div>
            )}

            {yourLine && (
              <div className="rounded-2xl px-4 sm:px-5 py-3 bg-emerald-500/10 border border-emerald-500/25 animate-fade-up" style={{ animationDuration: '0.3s' }}>
                <p className="text-xs text-slate-500 mb-1 font-bold tracking-widest">YOU</p>
                <p className={`text-sm sm:text-base leading-relaxed ${interimTranscript ? 'italic text-emerald-700 dark:text-emerald-300' : 'text-slate-700 dark:text-slate-200'}`}>
                  {yourLine}
                  {interimTranscript && <span className="inline-block w-0.5 h-4 bg-emerald-400 ml-1 animate-pulse align-middle" />}
                </p>
              </div>
            )}

            {conversationLog.length > 1 && (
              <button
                onClick={() => setShowTranscript(true)}
                className="text-xs font-semibold text-slate-500 hover:text-emerald-500 transition-colors"
              >
                📝 Show the full conversation
              </button>
            )}
            <div ref={conversationEndRef} />
          </div>
        </div>

        {/* ── Control bar ── */}
        <div className="px-4 pb-4 pt-1 flex flex-col items-center gap-2">
          {error && (
            <div className="bg-red-500/10 border border-red-500/25 rounded-2xl px-4 py-2 text-red-400 text-sm text-center">
              {error}
              <button onClick={() => setError('')} className="ml-2 underline text-xs opacity-70">Dismiss</button>
            </div>
          )}

          <p className={`text-xs font-semibold tracking-wide transition-colors duration-300 text-center ${
            isListening ? 'text-red-400' : isSpeaking ? 'text-slate-500' : isThinking ? 'text-yellow-500' : 'text-slate-500'
          }`}>
            {isListening ? `${countdown}s remaining — release the mic or press Space to send` :
             isSpeaking  ? `${interviewer.name} is speaking…` :
             isThinking  ? 'Processing your answer…' :
             'Hold the mic to answer · or press Space to start / stop'}
          </p>

          <div className="glass border border-slate-200 dark:border-slate-700/50 rounded-full px-3 sm:px-4 py-2 flex items-center gap-3 sm:gap-4 shadow-xl">
            {/* Camera */}
            <button
              onClick={toggleWebcam}
              title={webcamStream ? 'Turn off camera' : 'Turn on camera'}
              className={`${roundBtn} ${
                webcamStream
                  ? 'bg-blue-500/15 border-blue-500/35 text-blue-500 dark:text-blue-400'
                  : 'bg-red-500/10 border-red-500/30 text-red-500 dark:text-red-400 hover:bg-red-500/20'
              }`}
            >
              <CameraIcon on={!!webcamStream} />
            </button>

            {/* Mic — primary action */}
            <div className="relative w-16 h-16 sm:w-[72px] sm:h-[72px] flex items-center justify-center">
              <CountdownRing seconds={countdown} total={90} visible={isListening} />
              <button
                onMouseDown={handleMicDown} onMouseUp={handleMicUp}
                onTouchStart={(e) => { e.preventDefault(); handleMicDown() }}
                onTouchEnd={(e)   => { e.preventDefault(); handleMicUp()   }}
                disabled={micDisabled}
                title="Hold to answer"
                className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition-all duration-200 select-none z-10 ${
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

            {/* Full conversation */}
            <button
              onClick={() => setShowTranscript(o => !o)}
              title="Show the full conversation"
              className={`${roundBtn} ${
                showTranscript
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-500 dark:text-emerald-400'
                  : 'bg-slate-100 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/50 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-500'
              }`}
            >
              <TranscriptIcon />
            </button>

            {/* End the interview */}
            <span className="w-px h-8 bg-slate-200 dark:bg-slate-700/60" />
            <button
              onClick={() => setShowEndDialog(true)}
              title="End the interview"
              className="h-11 sm:h-12 px-4 rounded-full flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white text-sm font-bold transition-all shadow-md shadow-red-500/25"
            >
              <EndIcon />
              <span className="hidden sm:inline">End</span>
            </button>
          </div>
        </div>
      </div>

      {/* Transcript panel */}
      {showTranscript && <TranscriptPanel log={conversationLog} interviewerName={interviewer.name} onClose={() => setShowTranscript(false)} />}

      {showEndDialog && (
        <EndInterviewDialog
          answered={qaPairs.length}
          total={questions.length}
          onFeedback={endWithFeedback}
          onLeave={leaveInterview}
          onCancel={() => setShowEndDialog(false)}
        />
      )}
    </div>
  )
}
