import { useState } from 'react'
import { setAIConsent } from '../utils/api'
import { useAuth } from '../context/AuthContext'

export default function AIConsentModal({ onClose }) {
  const { updateUser } = useAuth()
  const [loading, setLoading] = useState(false)

  const handleChoice = async (consent) => {
    setLoading(true)
    try {
      await setAIConsent(consent)
      updateUser({ ai_consent: consent })
    } catch {}
    setLoading(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl shadow-black/60 overflow-hidden">

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center text-lg flex-shrink-0">
              🤖
            </div>
            <h2 className="text-white font-black text-lg">AI Data Processing</h2>
          </div>
          <p className="text-slate-400 text-sm leading-relaxed mt-2">
            MockMate uses a large language model (LLM) to power interviews, scoring, and CV analysis. Before we proceed, we need your consent to send certain data to our AI provider.
          </p>
        </div>

        {/* What gets sent */}
        <div className="px-6 py-4 space-y-3">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">What we send to the AI</p>
          <ul className="space-y-2">
            {[
              { icon: '📄', label: 'Your CV / resume text', note: 'for personalised questions and CV analysis' },
              { icon: '💼', label: 'Job description text', note: 'to generate relevant interview questions' },
              { icon: '🎤', label: 'Your interview answers', note: 'to score and give feedback on your responses' },
            ].map(({ icon, label, note }) => (
              <li key={label} className="flex items-start gap-3">
                <span className="text-base mt-0.5">{icon}</span>
                <div>
                  <span className="text-sm text-slate-200 font-medium">{label}</span>
                  <span className="text-xs text-slate-500 ml-1.5">{note}</span>
                </div>
              </li>
            ))}
          </ul>

          {/* What we don't send */}
          <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl px-4 py-3 space-y-1.5 mt-1">
            <p className="text-xs font-bold text-slate-400">We automatically remove before sending:</p>
            <p className="text-xs text-slate-500 leading-relaxed">
              Email addresses and phone numbers are stripped from your CV before it reaches the AI. Your name, account credentials, and payment details are <span className="text-slate-400 font-medium">never</span> sent.
            </p>
          </div>

          {/* Provider info */}
          <div className="bg-blue-500/8 border border-blue-500/20 rounded-xl px-4 py-3">
            <p className="text-xs text-slate-400 leading-relaxed">
              <span className="text-blue-400 font-semibold">Provider:</span> Data is processed via{' '}
              <span className="text-slate-300 font-medium">OpenRouter</span> and forwarded to the AI model in real time. It is <span className="text-slate-300 font-medium">not stored, logged, or used for training</span> by the provider.
            </p>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            This consent is recorded under Swiss DSG / GDPR Art. 6. You can withdraw it at any time in <span className="text-slate-500">Settings → AI &amp; Data Processing</span>.
          </p>
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 flex flex-col sm:flex-row gap-2">
          <button
            onClick={() => handleChoice(true)}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold text-sm shadow-md shadow-emerald-500/20 transition-all disabled:opacity-50"
          >
            {loading ? 'Saving…' : 'Accept — I consent to AI processing'}
          </button>
          <button
            onClick={() => handleChoice(false)}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl border border-slate-600 text-slate-400 hover:text-white hover:border-slate-500 text-sm font-medium transition-all disabled:opacity-50"
          >
            Decline
          </button>
        </div>
      </div>
    </div>
  )
}
