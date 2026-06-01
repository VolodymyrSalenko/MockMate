// TODO: Fill in the FREE and PRO feature lists after team discussion.
// The FEATURES array below is intentionally left as a placeholder.
// Each item: { label: string, free: boolean, pro: boolean }
const FEATURES = [
  // { label: 'Unlimited interviews',   free: false, pro: true },
  // { label: 'AI scoring',             free: true,  pro: true },
  // { label: 'Video playback',         free: false, pro: true },
  // Add more rows here...
]

export default function ProModal({ onClose }) {
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
          <p className="text-slate-500 text-sm mt-1.5">The full interview coaching experience</p>
        </div>

        {/* Feature table */}
        <div className="px-8 py-6">
          {FEATURES.length === 0 ? (
            /* Placeholder shown until the team fills in FEATURES above */
            <div className="text-center py-8 space-y-3">
              <span className="text-4xl">🛠</span>
              <p className="text-slate-300 font-semibold">Feature list coming soon</p>
              <p className="text-slate-600 text-sm max-w-xs mx-auto">
                We're finalising what's included in each plan.<br />
                Check back soon for the full breakdown.
              </p>
            </div>
          ) : (
            <>
              {/* Column headers */}
              <div className="grid grid-cols-[1fr_auto_auto] gap-x-6 mb-3 px-1">
                <span />
                <span className="text-slate-500 text-xs font-bold uppercase tracking-wide text-center w-12">Free</span>
                <span className="text-amber-400 text-xs font-bold uppercase tracking-wide text-center w-12">Pro</span>
              </div>
              <div className="space-y-1">
                {FEATURES.map((f, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-[1fr_auto_auto] gap-x-6 items-center px-3 py-2.5 rounded-xl hover:bg-slate-800/40 transition-colors"
                  >
                    <span className="text-slate-300 text-sm">{f.label}</span>
                    <div className="w-12 flex justify-center">
                      {f.free
                        ? <span className="text-emerald-400 text-base">✓</span>
                        : <span className="text-slate-700 text-base">—</span>}
                    </div>
                    <div className="w-12 flex justify-center">
                      {f.pro
                        ? <span className="text-amber-400 text-base">✓</span>
                        : <span className="text-slate-700 text-base">—</span>}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* CTA footer */}
        <div className="px-8 pb-8 space-y-3">
          <button
            disabled
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-sm opacity-50 cursor-not-allowed"
          >
            Coming Soon
          </button>
          <p className="text-center text-slate-700 text-xs">
            Pricing and availability will be announced shortly.
          </p>
        </div>
      </div>
    </div>
  )
}
