import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { BACKEND_URL } from '../utils/config'

const FEATURES = [
  { label: 'Practice sessions per day',   free: '3',          pro: 'Unlimited' },
  { label: 'Interview modes',             free: '3 modes',    pro: 'All 5 modes' },
  { label: 'AI scoring & feedback',       free: true,         pro: true },
  { label: 'Speech analytics',           free: true,         pro: true },
  { label: 'Debrief reports',            free: true,         pro: true },
  { label: 'Job description upload',     free: false,        pro: true },
  { label: 'Body language analysis',     free: false,        pro: true },
  { label: 'Video recording & playback', free: false,        pro: true },
  { label: 'PDF export',                 free: false,        pro: true },
]

function FeatureValue({ v }) {
  if (v === true)  return <span className="text-emerald-400 text-base">✓</span>
  if (v === false) return <span className="text-slate-700 text-base">—</span>
  return <span className="text-xs font-semibold text-slate-300">{v}</span>
}

export default function ProModal({ onClose }) {
  const { token } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

  const handleUpgrade = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${BACKEND_URL}/billing/checkout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Could not start checkout')
      const { url } = await res.json()
      window.location.href = url
    } catch (e) {
      setError(e.message || 'Something went wrong')
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ background: 'rgba(2,6,23,0.75)', backdropFilter: 'blur(8px)' }}
    >
      <div
        className="relative w-full max-w-lg rounded-3xl border border-slate-700/50 shadow-2xl overflow-hidden"
        style={{ background: 'rgba(15,23,42,0.98)', backdropFilter: 'blur(24px)' }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-600 hover:text-slate-300 transition-colors p-1.5 rounded-lg hover:bg-slate-800/60"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <div className="px-8 pt-8 pb-6 text-center border-b border-slate-800/60">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
            <span className="text-2xl">👑</span>
          </div>
          <h2 className="text-2xl font-black text-white">MockMate Pro</h2>
          <p className="text-slate-400 text-sm mt-1.5">Unlock the full interview coaching experience</p>

          {/* Price */}
          <div className="mt-4 flex items-baseline justify-center gap-1">
            <span className="text-4xl font-black text-white">$9</span>
            <span className="text-slate-500 text-sm font-medium">/ month</span>
          </div>
          <p className="text-slate-600 text-xs mt-1">Cancel any time · No hidden fees</p>
        </div>

        {/* Feature table */}
        <div className="px-8 py-5">
          <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 mb-2 px-1">
            <span />
            <span className="text-slate-500 text-xs font-bold uppercase tracking-wide text-center w-16">Free</span>
            <span className="text-amber-400 text-xs font-bold uppercase tracking-wide text-center w-16">Pro</span>
          </div>
          <div className="space-y-0.5">
            {FEATURES.map((f, i) => (
              <div
                key={i}
                className="grid grid-cols-[1fr_auto_auto] gap-x-4 items-center px-3 py-2 rounded-xl hover:bg-slate-800/40 transition-colors"
              >
                <span className="text-slate-300 text-sm">{f.label}</span>
                <div className="w-16 flex justify-center"><FeatureValue v={f.free} /></div>
                <div className="w-16 flex justify-center"><FeatureValue v={f.pro} /></div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA footer */}
        <div className="px-8 pb-8 space-y-3">
          {error && (
            <p className="text-center text-red-400 text-xs">{error}</p>
          )}
          <button
            onClick={handleUpgrade}
            disabled={loading}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-bold text-sm shadow-lg shadow-amber-500/30 hover:shadow-amber-500/50 hover:scale-[1.02] transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:scale-100"
          >
            {loading ? 'Redirecting to checkout…' : 'Upgrade to Pro →'}
          </button>
          <p className="text-center text-slate-700 text-xs">
            Secure checkout via{' '}
            <span className="text-slate-500 font-semibold">Polar</span>
            {' '}· Payments processed by Stripe
          </p>
        </div>
      </div>
    </div>
  )
}
