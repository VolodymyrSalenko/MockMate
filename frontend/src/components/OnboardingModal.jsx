import { useEffect } from 'react'

const STORAGE_KEY = 'mm_onboarding_done'

export function shouldShowOnboarding() {
  try { return !localStorage.getItem(STORAGE_KEY) } catch { return false }
}

export function markOnboardingDone() {
  try { localStorage.setItem(STORAGE_KEY, '1') } catch {}
}

export default function OnboardingModal({ onUploadCV, onSkip }) {
  useEffect(() => { markOnboardingDone() }, [])

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden animate-fade-up">
        <div className="p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-3xl shadow-lg shadow-emerald-500/25">
            👋
          </div>
          <h2 className="text-2xl font-black text-white mb-2">Welcome to MockMate</h2>
          <p className="text-slate-400 text-sm leading-relaxed mb-7">
            Get tailored interview questions by uploading your CV. MockMate will personalise every session to your actual experience.
          </p>

          <div className="space-y-3">
            <button
              onClick={onUploadCV}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold text-sm shadow-md shadow-emerald-500/20 transition-all"
            >
              Upload my CV — takes 10 seconds
            </button>
            <button
              onClick={onSkip}
              className="w-full py-3 rounded-xl border border-slate-700/80 text-slate-500 hover:text-slate-300 hover:border-slate-600 text-sm font-medium transition-all"
            >
              Skip for now
            </button>
          </div>

          <p className="text-xs text-slate-600 mt-5 leading-relaxed">
            You can always upload your CV later in <span className="text-slate-500">Settings → CV Profile</span>
          </p>
        </div>
      </div>
    </div>
  )
}
