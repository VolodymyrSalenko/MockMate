import { useState, useRef, useEffect } from 'react'
import { INTERVIEWERS, getVoice, setVoice, voiceSample } from '../utils/interviewers'

// Settings → Interviewers: listen to each voice and pick one per interviewer
export default function InterviewerVoices() {
  const [chosen,  setChosen]  = useState(() => Object.fromEntries(INTERVIEWERS.map(i => [i.id, getVoice(i.id)])))
  const [playing, setPlaying] = useState(null)   // "interviewerId/voiceId"
  const audioRef = useRef(null)

  useEffect(() => () => audioRef.current?.pause(), [])

  const togglePlay = (interviewerId, voiceId) => {
    const key = `${interviewerId}/${voiceId}`
    audioRef.current?.pause()
    if (playing === key) { setPlaying(null); return }
    const audio = new Audio(voiceSample(interviewerId, voiceId))
    audio.onended = () => setPlaying(p => (p === key ? null : p))
    audio.onerror = () => setPlaying(p => (p === key ? null : p))
    audio.play().catch(() => setPlaying(null))
    audioRef.current = audio
    setPlaying(key)
  }

  const choose = (interviewerId, voiceId) => {
    setVoice(interviewerId, voiceId)
    setChosen(c => ({ ...c, [interviewerId]: voiceId }))
  }

  return (
    <div className="space-y-5">
      {INTERVIEWERS.map(iv => (
        <div key={iv.id} className="glass border border-slate-200 dark:border-slate-700/40 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800/60 pb-3">
            <img src={iv.photo} alt="" className="w-11 h-11 rounded-full object-cover" style={{ background: iv.background }} />
            <div>
              <p className="text-slate-900 dark:text-white font-bold text-base">{iv.name}</p>
              <p className="text-slate-500 text-xs">Choose the voice {iv.name} speaks with</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {iv.voices.map((v, i) => {
              const selected  = chosen[iv.id] === v.id
              const isPlaying = playing === `${iv.id}/${v.id}`
              return (
                // The whole card selects the voice; only the play button just plays the sample
                <div
                  key={v.id}
                  role="radio"
                  aria-checked={selected}
                  tabIndex={0}
                  onClick={() => choose(iv.id, v.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(iv.id, v.id) } }}
                  className={`group flex items-center gap-3 rounded-xl border px-3 py-2.5 cursor-pointer transition-all ${
                    selected
                      ? 'border-emerald-500/60 bg-emerald-500/10'
                      : 'border-slate-200 dark:border-slate-700/50 hover:border-emerald-500/40 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <button
                    onClick={(e) => { e.stopPropagation(); togglePlay(iv.id, v.id) }}
                    title={isPlaying ? 'Stop' : `Listen to ${v.label}`}
                    className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                      isPlaying
                        ? 'bg-emerald-500 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-emerald-500 hover:text-white'
                    }`}
                  >
                    {isPlaying
                      ? <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
                      : <svg className="w-3.5 h-3.5 ml-0.5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l11-6.5a1 1 0 0 0 0-1.72l-11-6.5A1 1 0 0 0 8 5.5z" /></svg>}
                  </button>
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      {v.label}
                      {i === 0 && <span className="ml-1.5 text-xs font-normal text-slate-500">· default</span>}
                    </p>
                    <p className="text-xs text-slate-500 truncate">{v.description}</p>
                  </div>
                  <span className={`w-5 h-5 rounded-full border-2 flex-shrink-0 transition-all ${
                    selected
                      ? 'border-emerald-500 bg-emerald-500 shadow-[inset_0_0_0_3px_white] dark:shadow-[inset_0_0_0_3px_#0f172a]'
                      : 'border-slate-300 dark:border-slate-600 group-hover:border-emerald-500 group-hover:bg-emerald-500/15'
                  }`} />
                </div>
              )
            })}
          </div>
        </div>
      ))}
      <p className="text-slate-500 text-xs px-1">Your choice is saved in this browser and used in your next interview.</p>
    </div>
  )
}
