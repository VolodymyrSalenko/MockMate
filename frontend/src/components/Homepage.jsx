import { useTheme } from '../context/ThemeContext'

function BgOrbs() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      <div className="animate-orb absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-emerald-500/6 blur-3xl" />
      <div className="animate-orb-r absolute bottom-0 -left-20 w-96 h-96 rounded-full bg-cyan-500/5 blur-3xl" />
      <div className="animate-orb-slow absolute top-1/2 left-1/3 w-64 h-64 rounded-full bg-teal-500/4 blur-3xl" />
    </div>
  )
}

const FEATURES = [
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <path d="M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"/>
        <path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v4M8 22h8"/>
      </svg>
    ),
    title: 'Voice Interview Practice',
    desc: 'Answer questions out loud just like a real interview. Hold to speak, release to submit — no typing.',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/>
        <path d="M9 18h6M10 22h4"/>
      </svg>
    ),
    title: 'Live AI Coaching',
    desc: 'Instant hints after each answer: STAR framework coverage, pacing tips, filler word count.',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    ),
    title: 'Speech Analytics',
    desc: 'Track words per minute, filler word habits, answer duration, and STAR completion per question.',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <path d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.89L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/>
      </svg>
    ),
    title: 'Body Language Analysis',
    desc: 'Optional webcam analysis of eye contact, head posture, and facial confidence shown in your debrief.',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>
      </svg>
    ),
    title: '5 Interview Modes',
    desc: 'Full interview, behavioral, technical, screening call, or focused practice by topic — your choice.',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
      </svg>
    ),
    title: 'Debrief Reports',
    desc: 'Per-question scores, written feedback, model answers, and PDF export after every session.',
  },
]

const STEPS = [
  {
    n: '1',
    title: 'Set up your session',
    desc: 'Paste a job description or pick a practice topic. Choose difficulty, language, and interview type.',
  },
  {
    n: '2',
    title: 'Answer out loud',
    desc: "The AI interviewer asks questions. Hold the mic button and speak your answer naturally.",
  },
  {
    n: '3',
    title: 'Review your debrief',
    desc: 'Get per-question scores, written feedback, speech analytics, and model answers instantly.',
  },
]

export default function Homepage({ onLogin, onRegister }) {
  const { theme, toggleTheme } = useTheme()

  return (
    <div className="min-h-screen dark:bg-slate-950 overflow-x-hidden">
      <BgOrbs />

      {/* ── Nav ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-slate-200 dark:border-slate-700/40 px-5 sm:px-8 py-3.5 flex items-center justify-between">
        <span className="text-xl font-black">
          <span className="text-slate-900 dark:text-white">Mock</span>
          <span className="gradient-text">Mate</span>
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="w-9 h-9 flex items-center justify-center rounded-full glass border border-slate-200 dark:border-slate-700/50 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white shadow-sm transition-all"
          >
            {theme === 'dark' ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="4"/>
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            )}
          </button>
          <button
            onClick={onLogin}
            className="hidden sm:block text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white px-3 py-2 rounded-xl hover:bg-slate-100/80 dark:hover:bg-slate-800/60 transition-all"
          >
            Sign In
          </button>
          <button
            onClick={onRegister}
            className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white text-sm font-bold px-4 py-2.5 rounded-xl shadow-lg shadow-emerald-500/25 hover:scale-105 transition-all"
          >
            Get Started
          </button>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative z-10 pt-28 sm:pt-36 pb-16 px-6 flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-4 py-1.5 mb-6 animate-fade-up">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-emerald-400 text-xs font-bold uppercase tracking-widest">AI Interview Coach</span>
        </div>

        <h1
          className="text-5xl sm:text-6xl lg:text-7xl font-black text-slate-900 dark:text-white leading-[1.05] mb-5 max-w-3xl animate-fade-up"
          style={{ animationDelay: '0.05s' }}
        >
          Ace Your Next<br />
          <span className="gradient-text">Interview</span>
        </h1>

        <p
          className="text-slate-600 dark:text-slate-400 text-lg sm:text-xl max-w-lg mb-8 leading-relaxed animate-fade-up"
          style={{ animationDelay: '0.1s' }}
        >
          Practice with an AI interviewer, get real-time coaching hints, and walk in with confidence.
        </p>

        <div className="flex gap-3 animate-fade-up" style={{ animationDelay: '0.15s' }}>
          <button
            onClick={onRegister}
            className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold px-7 sm:px-9 py-3.5 rounded-2xl shadow-xl shadow-emerald-500/30 hover:scale-105 transition-all text-sm sm:text-base"
          >
            Start Free →
          </button>
          <button
            onClick={onLogin}
            className="glass border border-slate-200 dark:border-slate-700/50 text-slate-700 dark:text-slate-300 font-semibold px-7 sm:px-9 py-3.5 rounded-2xl hover:border-slate-300 dark:hover:border-slate-500 transition-all text-sm sm:text-base"
          >
            Sign In
          </button>
        </div>

        {/* Stats bar */}
        <div
          className="flex flex-wrap items-center justify-center gap-5 sm:gap-8 mt-10 text-xs text-slate-500 dark:text-slate-500 font-semibold uppercase tracking-wider animate-fade-up"
          style={{ animationDelay: '0.2s' }}
        >
          {['5 Interview Modes', '12 Practice Topics', '3 Languages', 'Real-time AI Scoring'].map(s => (
            <span key={s} className="flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-emerald-400/70" />
              {s}
            </span>
          ))}
        </div>
      </section>

      {/* ── Feature cards ── */}
      <section className="relative z-10 px-6 pb-20 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              className="glass border border-slate-200 dark:border-slate-700/40 rounded-2xl p-6 space-y-3 animate-fade-up hover:border-emerald-500/20 transition-all"
              style={{ animationDelay: `${0.04 * i}s` }}
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                {f.icon}
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white">{f.title}</h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="relative z-10 px-6 pb-20 max-w-2xl mx-auto">
        <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white text-center mb-10">How it works</h2>
        <div className="relative">
          <div className="absolute left-5 top-5 bottom-5 w-px bg-gradient-to-b from-emerald-400/60 via-emerald-400/20 to-transparent" />
          <div className="space-y-8">
            {STEPS.map((step, i) => (
              <div
                key={i}
                className="flex gap-5 pl-1 animate-fade-up"
                style={{ animationDelay: `${0.08 * i}s` }}
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white font-black text-sm flex-shrink-0 shadow-lg shadow-emerald-500/30 relative z-10">
                  {step.n}
                </div>
                <div className="pt-2">
                  <p className="font-bold text-slate-900 dark:text-white mb-1">{step.title}</p>
                  <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="relative z-10 px-6 pb-24 max-w-xl mx-auto text-center">
        <div
          className="glass border border-emerald-500/20 rounded-3xl p-10 space-y-4 animate-fade-up"
          style={{ boxShadow: '0 0 60px rgba(16,185,129,0.08)' }}
        >
          <h2 className="text-3xl font-black text-slate-900 dark:text-white">Ready to practise?</h2>
          <p className="text-slate-600 dark:text-slate-400 text-sm">Free to use. No credit card required.</p>
          <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2">
            <button
              onClick={onRegister}
              className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold px-8 py-3.5 rounded-2xl shadow-xl shadow-emerald-500/30 hover:scale-105 transition-all"
            >
              Create Free Account
            </button>
            <button
              onClick={onLogin}
              className="glass border border-slate-200 dark:border-slate-700/50 text-slate-700 dark:text-slate-300 font-semibold px-6 py-3.5 rounded-2xl hover:border-emerald-500/30 hover:text-emerald-400 transition-all"
            >
              Sign In
            </button>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="relative z-10 border-t border-slate-200 dark:border-slate-800 px-6 py-6 text-center">
        <p className="text-sm">
          <span className="font-black text-slate-900 dark:text-white">Mock</span>
          <span className="gradient-text font-black">Mate</span>
          <span className="text-slate-500 dark:text-slate-600 ml-2">— AI Interview Coach · Free to use</span>
        </p>
      </footer>
    </div>
  )
}
