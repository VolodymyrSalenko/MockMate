import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

function BgOrbs() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      <div className="animate-orb absolute -top-32 -left-32 w-96 h-96 rounded-full bg-emerald-500/10 blur-3xl" />
      <div className="animate-orb-r absolute bottom-0 right-0 w-80 h-80 rounded-full bg-cyan-500/8 blur-3xl" />
    </div>
  )
}

export default function Auth() {
  const { login } = useAuth()
  const [mode,     setMode]     = useState('login')   // 'login' | 'register'
  const [name,     setName]     = useState('')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  const switchMode = (m) => { setMode(m); setError('') }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const endpoint = mode === 'register' ? '/auth/register' : '/auth/login'
    const body     = mode === 'register'
      ? { email, password, name }
      : { email, password }

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
      login(data.token, data.user)
    } catch {
      setError('Could not connect to the server. Is the backend running?')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4 overflow-hidden">
      <BgOrbs />

      <div className="relative z-10 w-full max-w-md">

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
                <label className="block text-slate-300 text-sm font-semibold mb-1.5">
                  Full Name
                </label>
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
              <label className="block text-slate-300 text-sm font-semibold mb-1.5">
                Email
              </label>
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
              <input
                type="password"
                required
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-900/70 border border-slate-700/60 rounded-2xl px-4 py-3 text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/40 text-sm transition-all"
              />
            </div>

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
