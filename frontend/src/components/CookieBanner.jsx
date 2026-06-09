import { useState } from 'react'
import { getConsent, setConsent } from '../utils/cookies'

export default function CookieBanner() {
  const [visible, setVisible] = useState(() => getConsent() === null)

  if (!visible) return null

  const accept = () => {
    setConsent('accepted')
    setVisible(false)
  }

  const decline = () => {
    setConsent('declined')
    setVisible(false)
  }

  return (
    <div className="fixed bottom-4 left-0 right-0 z-[10000] px-4">
      <div className="max-w-2xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3
        bg-slate-900 border border-slate-700/80 rounded-2xl px-5 py-4 shadow-2xl shadow-black/40">
        <div className="flex items-start gap-3">
          <span className="text-xl mt-0.5">🍪</span>
          <div>
            <p className="text-sm font-semibold text-white">We use cookies</p>
            <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
              MockMate uses cookies to keep you logged in and remember your session between visits.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
          <button
            onClick={decline}
            className="text-xs px-3.5 py-2 rounded-xl border border-slate-600 text-slate-400 hover:text-white hover:border-slate-500 transition-all"
          >
            Decline
          </button>
          <button
            onClick={accept}
            className="text-xs font-bold px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white shadow-md shadow-emerald-500/20 transition-all"
          >
            Accept cookies
          </button>
        </div>
      </div>
    </div>
  )
}
