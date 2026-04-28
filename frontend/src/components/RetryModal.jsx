import { useState, useEffect, useRef, useCallback } from 'react'
import { useTTS } from '../hooks/useTTS'
import { useSTT } from '../hooks/useSTT'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

const MicIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
  </svg>
)

const WAVEFORM_HEIGHTS = [0.4, 0.7, 0.5, 0.9, 0.65, 1.0, 0.55, 0.8, 0.45]

function MiniWaveform({ active }) {
  return (
    <div className={`flex items-center gap-0.5 h-8 transition-all duration-300 ${active ? 'opacity-100' : 'opacity-0'}`}>
      {WAVEFORM_HEIGHTS.map((h, i) => (
        <div key={i} style={{
          width: '3px', height: '32px',
          background: 'linear-gradient(180deg,#f87171,#fb923c)',
          borderRadius: '3px',
          transformOrigin: 'center',
          animation: active ? `waveBar ${0.35 + i * 0.05}s ease-in-out ${i * 0.06}s infinite` : 'none',
          transform: active ? undefined : `scaleY(${h * 0.2})`,
        }} />
      ))}
    </div>
  )
}

function ScoreDiff({ original, updated }) {
  const diff = parseFloat((updated - original).toFixed(1))
  const color = diff > 0 ? 'text-emerald-400' : diff < 0 ? 'text-red-400' : 'text-slate-400'
  const sign  = diff > 0 ? '+' : ''
  return (
    <div className="flex items-center justify-center gap-6">
      <div className="text-center">
        <p className="text-slate-500 text-xs mb-1">Original</p>
        <p className="text-3xl font-black text-slate-400">{original}<span className="text-lg">/10</span></p>
      </div>
      <div className="text-3xl text-slate-600">→</div>
      <div className="text-center">
        <p className="text-slate-500 text-xs mb-1">Retry</p>
        <p className="text-3xl font-black text-white">{updated}<span className="text-lg">/10</span></p>
      </div>
      {diff !== 0 && (
        <div className={`text-xl font-black ${color}`}>{sign}{diff}</div>
      )}
    </div>
  )
}

export default function RetryModal({ question, originalScore, role, onClose }) {
  const [phase,         setPhase]         = useState('intro')   // intro | idle | listening | thinking | result
  const [transcript,    setTranscript]    = useState('')
  const [result,        setResult]        = useState(null)
  const [error,         setError]         = useState('')
  const [countdown,     setCountdown]     = useState(90)
  const [showIdeal,     setShowIdeal]     = useState(false)

  const isHoldingRef         = useRef(false)
  const canRecordRef         = useRef(false)
  const countdownIntervalRef = useRef(null)

  const { speak } = useTTS()

  const handleFinalTranscript = useCallback(async (text) => {
    if (!text.trim()) return
    setTranscript(text)
    setPhase('thinking')
    try {
      const res = await fetch(`${BACKEND_URL}/debrief`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qa_pairs: [{ question, answer: text }], role }),
      })
      if (!res.ok) throw new Error('Debrief failed')
      const data = await res.json()
      setResult(data.answers?.[0] || null)
      setPhase('result')
    } catch {
      setError('Could not evaluate your answer. Please try again.')
      setPhase('idle')
      canRecordRef.current = true
    }
  }, [question, role])

  const { start, stop, isListening, interimTranscript } = useSTT({
    onFinalTranscript: handleFinalTranscript,
  })

  // Speak the question on mount
  useEffect(() => {
    speak(question, () => {
      setPhase('idle')
      canRecordRef.current = true
    })
    return () => { clearInterval(countdownIntervalRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Countdown while recording
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

  // Spacebar push-to-talk
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.code === 'Space' && !isHoldingRef.current && canRecordRef.current && phase === 'idle') {
        e.preventDefault()
        isHoldingRef.current = true
        setPhase('listening')
        start()
      }
    }
    const onKeyUp = (e) => {
      if (e.code === 'Space' && isHoldingRef.current) {
        e.preventDefault()
        isHoldingRef.current = false
        stop()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp) }
  }, [phase, start, stop])

  const handleMicDown = () => {
    if (!canRecordRef.current || phase !== 'idle') return
    setPhase('listening')
    start()
  }
  const handleMicUp = () => { if (isListening) stop() }

  const handleRetryAgain = () => {
    setPhase('intro')
    setTranscript('')
    setResult(null)
    setError('')
    setShowIdeal(false)
    canRecordRef.current = false
    speak(question, () => { setPhase('idle'); canRecordRef.current = true })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(2,6,23,0.85)', backdropFilter: 'blur(12px)' }}>
      <div className="w-full max-w-lg glass border border-slate-700/50 rounded-3xl overflow-hidden shadow-2xl animate-fade-up">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/40">
          <div className="flex items-center gap-2">
            <span className="text-lg">🔄</span>
            <span className="text-white font-bold">Retry Question</span>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition text-xl leading-none">✕</button>
        </div>

        <div className="p-6 space-y-5">
          {/* Question */}
          <div className="bg-slate-900/60 border border-slate-700/40 rounded-2xl p-4">
            <p className="text-xs text-emerald-400/70 font-bold uppercase tracking-widest mb-2">Question</p>
            <p className="text-slate-200 text-sm leading-relaxed">{question}</p>
          </div>

          {/* Phase: intro/speaking */}
          {phase === 'intro' && (
            <div className="flex items-center justify-center gap-3 py-4 text-emerald-400">
              <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>
              <span className="text-sm">Alex is reading the question...</span>
            </div>
          )}

          {/* Phase: idle or listening */}
          {(phase === 'idle' || phase === 'listening') && (
            <div className="flex flex-col items-center gap-4 py-2">
              <MiniWaveform active={phase === 'listening'} />

              <button
                onMouseDown={handleMicDown}
                onMouseUp={handleMicUp}
                onTouchStart={(e) => { e.preventDefault(); handleMicDown() }}
                onTouchEnd={(e) => { e.preventDefault(); handleMicUp() }}
                className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-200 ${
                  phase === 'listening'
                    ? 'bg-gradient-to-br from-red-500 to-rose-600 text-white btn-recording scale-110'
                    : 'bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-xl shadow-emerald-500/30 hover:scale-105 animate-idle-ring'
                }`}
              >
                <MicIcon />
              </button>

              <p className={`text-xs font-semibold ${phase === 'listening' ? 'text-red-400' : 'text-slate-500'}`}>
                {phase === 'listening'
                  ? `Listening... (${countdown}s — release to send)`
                  : 'Hold to answer · or hold Spacebar'}
              </p>

              {/* Live transcript */}
              {interimTranscript && (
                <div className="w-full bg-emerald-500/10 border border-emerald-500/20 rounded-2xl px-4 py-3 text-sm text-emerald-300 italic">
                  {interimTranscript}
                  <span className="inline-block w-0.5 h-4 bg-emerald-400 ml-1 animate-pulse align-middle" />
                </div>
              )}
            </div>
          )}

          {/* Phase: thinking */}
          {phase === 'thinking' && (
            <div className="flex items-center justify-center gap-3 py-4 text-yellow-400">
              <div className="flex gap-1">
                {[0,1,2].map(i => (
                  <span key={i} className="w-1.5 h-1.5 rounded-full bg-yellow-400"
                    style={{ animation: `pulse 1s ease-in-out ${i*0.2}s infinite` }} />
                ))}
              </div>
              <span className="text-sm">Evaluating your answer...</span>
            </div>
          )}

          {/* Phase: result */}
          {phase === 'result' && result && (
            <div className="space-y-4">
              {/* Score comparison */}
              <div className="bg-slate-900/60 border border-slate-700/40 rounded-2xl p-5">
                <ScoreDiff original={originalScore} updated={result.score} />
              </div>

              {/* Feedback */}
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-1.5">Feedback</p>
                  <p className="text-slate-300 text-sm leading-relaxed">{result.feedback}</p>
                </div>
                <div className="bg-emerald-500/8 border border-emerald-500/20 rounded-2xl p-4">
                  <p className="text-xs text-emerald-400 font-bold mb-1.5">💡 Pro Tip</p>
                  <p className="text-emerald-200/90 text-sm leading-relaxed">{result.tip}</p>
                </div>
              </div>

              {/* Ideal answer toggle */}
              {result.ideal_answer && (
                <div>
                  <button
                    onClick={() => setShowIdeal(o => !o)}
                    className="w-full text-left flex items-center justify-between px-4 py-3 glass-light border border-slate-700/40 rounded-2xl text-sm text-slate-400 hover:border-slate-600 transition"
                  >
                    <span className="flex items-center gap-2"><span>⭐</span> See model answer</span>
                    <span className="text-xs">{showIdeal ? '▲' : '▼'}</span>
                  </button>
                  {showIdeal && (
                    <div className="mt-2 bg-amber-500/8 border border-amber-500/20 rounded-2xl p-4">
                      <p className="text-amber-200/90 text-sm leading-relaxed">{result.ideal_answer}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <button
                  onClick={handleRetryAgain}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-semibold py-3 rounded-2xl transition text-sm"
                >
                  🔄 Try Again
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold py-3 rounded-2xl transition text-sm shadow-lg shadow-emerald-500/25"
                >
                  Done
                </button>
              </div>
            </div>
          )}

          {error && (
            <p className="text-red-400 text-sm text-center">{error}</p>
          )}
        </div>
      </div>
    </div>
  )
}
