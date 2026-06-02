import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { BACKEND_URL } from '../utils/config'

function BgOrbs() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      <div className="animate-orb absolute -top-32 -left-32 w-96 h-96 rounded-full bg-emerald-500/10 blur-3xl" />
      <div className="animate-orb-r absolute bottom-0 right-0 w-80 h-80 rounded-full bg-cyan-500/8 blur-3xl" />
    </div>
  )
}

function EyeIcon({ open }) {
  return open ? (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
  ) : (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  )
}

export default function Auth() {
  const { login } = useAuth()
  const [mode,          setMode]          = useState('login')
  const [name,          setName]          = useState('')
  const [email,         setEmail]         = useState('')
  const [password,        setPassword]        = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPass,        setShowPass]        = useState(false)
  const [showConfirmPass, setShowConfirmPass] = useState(false)
  const [error,           setError]           = useState('')
  const [loading,       setLoading]       = useState(false)
  const [verifyPending, setVerifyPending] = useState(null) // email string when awaiting verification
  const [verifiedBanner, setVerifiedBanner] = useState(null) // 'success' | 'error'

  // Handle ?verified=true or ?verified=error coming back from the email link
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const v = params.get('verified')
    if (v === 'true')  setVerifiedBanner('success')
    if (v === 'error') setVerifiedBanner('error')
    if (v) window.history.replaceState({}, '', window.location.pathname)
  }, [])

  const switchMode = (m) => {
    setMode(m); setError(''); setShowPass(false); setShowConfirmPass(false); setConfirmPassword('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (mode === 'register' && password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)

    const endpoint = mode === 'register' ? '/auth/register' : '/auth/login'
    const body     = mode === 'register' ? { email, password, name } : { email, password }

    try {
      const res  = await fetch(`${BACKEND_URL}${endpoint}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.detail || 'Something went wrong.')
        return
      }
      if (data.needs_verification) {
        setVerifyPending(data.email)
        return
      }
      login(data.token, data.user)
    } catch {
      setError('Could not connect to the server. Is the backend running?')
    } finally {
      setLoading(false)
    }
  }

  // ── "Check your email" screen ─────────────────────────────────────────────
  if (verifyPending) {
    return (
      <div className="relative min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4 overflow-hidden">
        <BgOrbs />
        <div className="relative z-10 w-full max-w-md text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-2xl font-black text-white mb-2">Check your email</h2>
          <p className="text-slate-400 text-sm mb-1">We sent a verification link to</p>
          <p className="text-emerald-400 font-semibold text-sm mb-6">{verifyPending}</p>
          <p className="text-slate-600 text-xs mb-8">
            Click the link in the email to activate your account.<br />
            It may take a minute to arrive.
          </p>
          <button
            onClick={() => { setVerifyPending(null); setMode('login') }}
            className="text-slate-500 hover:text-slate-300 text-sm transition-colors"
          >
            ← Back to sign in
          </button>
        </div>
      </div>
    )
  }

  // ── Main auth form ────────────────────────────────────────────────────────
  return (
    <div className="relative min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4 overflow-hidden">
      <BgOrbs />

      <div className="relative z-10 w-full max-w-md">

        {/* Email verified banner */}
        {verifiedBanner === 'success' && (
          <div className="mb-4 flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl px-4 py-3 text-emerald-400 text-sm">
            <span className="text-base">✅</span>
            <span>Email verified! You can now sign in.</span>
          </div>
        )}
        {verifiedBanner === 'error' && (
          <div className="mb-4 flex items-center gap-3 bg-red-500/10 border border-red-500/25 rounded-2xl px-4 py-3 text-red-400 text-sm">
            <span className="text-base">❌</span>
            <span>Verification link is invalid or has expired.</span>
          </div>
        )}

        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-black tracking-tight">
            <span className="text-white">Mock</span>
            <span className="gradient-text">Mate</span>
          </h1>
          <p className="text-slate-500 text-sm mt-2">AI-Powered Voice Interview Practice</p>
        </div>

        {/* Card */}
        <div className="glass border border-slate-700/40 rounded-3xl p-8 shadow-2xl"
          style={{ boxShadow: '0 0 60px rgba(16,185,129,0.06), 0 25px 50px rgba(0,0,0,0.5)' }}>

          {/* Mode tabs */}
          <div className="flex gap-2 mb-7">
            {[
              { key: 'login',    label: 'Sign In' },
              { key: 'register', label: 'Create Account' },
            ].map(t => (
              <button
                key={t.key}
                onClick={() => switchMode(t.key)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  mode === t.key
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Name — register only */}
            {mode === 'register' && (
              <div>
                <label className="block text-slate-300 text-sm font-semibold mb-1.5">Full Name</label>
                <input
                  type="text"
                  required
                  autoComplete="name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Jane Smith"
                  className="w-full bg-slate-900/70 border border-slate-700/60 rounded-2xl px-4 py-3 text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/40 text-sm transition-all"
                />
              </div>
            )}

            {/* Email */}
            <div>
              <label className="block text-slate-300 text-sm font-semibold mb-1.5">Email</label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="jane@example.com"
                className="w-full bg-slate-900/70 border border-slate-700/60 rounded-2xl px-4 py-3 text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/40 text-sm transition-all"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-slate-300 text-sm font-semibold mb-1.5">
                Password
                {mode === 'register' && (
                  <span className="ml-2 text-slate-500 font-normal text-xs">min. 6 characters</span>
                )}
              </label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  required
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-900/70 border border-slate-700/60 rounded-2xl px-4 py-3 pr-11 text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/40 text-sm transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  tabIndex={-1}
                  title={showPass ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors p-1"
                >
                  <EyeIcon open={showPass} />
                </button>
              </div>
            </div>

            {/* Confirm Password — register only */}
            {mode === 'register' && (
              <div>
                <label className="block text-slate-300 text-sm font-semibold mb-1.5">Confirm Password</label>
                <div className="relative">
                  <input
                    type={showConfirmPass ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className={`w-full bg-slate-900/70 border rounded-2xl px-4 py-3 pr-11 text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 text-sm transition-all ${
                      confirmPassword && confirmPassword !== password
                        ? 'border-red-500/60 focus:ring-red-500/40 focus:border-red-500/50'
                        : confirmPassword && confirmPassword === password
                          ? 'border-emerald-500/50 focus:ring-emerald-500/40 focus:border-emerald-500/50'
                          : 'border-slate-700/60 focus:ring-emerald-500/50 focus:border-emerald-500/40'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPass(v => !v)}
                    tabIndex={-1}
                    title={showConfirmPass ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors p-1"
                  >
                    <EyeIcon open={showConfirmPass} />
                  </button>
                  {confirmPassword && confirmPassword === password && (
                    <span className="absolute right-9 top-1/2 -translate-y-1/2 text-emerald-400 text-xs">✓</span>
                  )}
                </div>
                {confirmPassword && confirmPassword !== password && (
                  <p className="text-red-400 text-xs mt-1.5 ml-1">Passwords do not match</p>
                )}
              </div>
            )}

            {/* Email verification notice — register only */}
            {mode === 'register' && (
              <div className="flex items-start gap-2.5 bg-slate-900/50 border border-slate-700/40 rounded-2xl px-4 py-3">
                <span className="text-base mt-0.5">📧</span>
                <p className="text-slate-500 text-xs leading-relaxed">
                  We'll send a verification link to your email address to activate your account.
                </p>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/25 rounded-2xl px-4 py-3 text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-2xl transition-all duration-300 hover:scale-[1.02] shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                  {mode === 'register' ? 'Creating account...' : 'Signing in...'}
                </>
              ) : (
                mode === 'register' ? 'Create Account' : 'Sign In'
              )}
            </button>
          </form>

          {/* Switch mode link */}
          <p className="text-center text-slate-600 text-sm mt-5">
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button
              onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
              className="text-emerald-400 hover:text-emerald-300 font-semibold transition"
            >
              {mode === 'login' ? 'Create one' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
