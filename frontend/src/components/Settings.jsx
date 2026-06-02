import { useState } from 'react'
import { useAuth, getStoredToken } from '../context/AuthContext'

import { BACKEND_URL } from '../utils/config'

const isVerified = (user) => user?.email_verified === true

function Section({ title, children }) {
  return (
    <div className="glass border border-slate-700/40 rounded-2xl p-6 space-y-5">
      <p className="text-white font-bold text-base border-b border-slate-800/60 pb-3">{title}</p>
      {children}
    </div>
  )
}

function Field({ label, hint, children }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-slate-300 text-sm font-semibold">
        {label}
        {hint && <span className="ml-2 text-slate-600 font-normal text-xs">{hint}</span>}
      </label>
      {children}
    </div>
  )
}

function Input({ type = 'text', value, onChange, placeholder, autoComplete, right }) {
  return (
    <div className="relative">
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="w-full bg-slate-900/70 border border-slate-700/60 rounded-xl px-4 py-2.5 text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/40 text-sm transition-all pr-11"
      />
      {right && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">{right}</div>
      )}
    </div>
  )
}

function PasswordInput({ value, onChange, placeholder, autoComplete }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="w-full bg-slate-900/70 border border-slate-700/60 rounded-xl px-4 py-2.5 pr-11 text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/40 text-sm transition-all"
      />
      <button
        type="button"
        onClick={() => setShow(v => !v)}
        tabIndex={-1}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors p-1"
      >
        {show ? (
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
        )}
      </button>
    </div>
  )
}

function Toast({ type, message, onDismiss }) {
  const styles = type === 'success'
    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
    : 'bg-red-500/10 border-red-500/25 text-red-400'
  return (
    <div className={`flex items-center justify-between gap-3 border rounded-xl px-4 py-3 text-sm ${styles}`}>
      <span>{message}</span>
      <button onClick={onDismiss} className="opacity-60 hover:opacity-100 transition-opacity text-lg leading-none">×</button>
    </div>
  )
}

export default function Settings({ onNavigate }) {
  const { user, updateUser } = useAuth()

  // Profile
  const [name,           setName]           = useState(user?.name || '')
  const [profileMsg,     setProfileMsg]     = useState(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [resendMsg,      setResendMsg]      = useState(null)
  const [resendLoading,  setResendLoading]  = useState(false)

  // Email change
  const [newEmail,      setNewEmail]      = useState('')
  const [emailMsg,      setEmailMsg]      = useState(null)
  const [emailLoading,  setEmailLoading]  = useState(false)
  const [emailPending,  setEmailPending]  = useState(user?.pending_email || null)
  const [cancelLoading, setCancelLoading] = useState(false)

  // Password
  const [currentPw,  setCurrentPw]  = useState('')
  const [newPw,      setNewPw]      = useState('')
  const [confirmPw,  setConfirmPw]  = useState('')
  const [pwMsg,      setPwMsg]      = useState(null)
  const [pwLoading,  setPwLoading]  = useState(false)

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${getStoredToken()}`,
  }

  const handleResend = async () => {
    setResendLoading(true)
    setResendMsg(null)
    try {
      const res = await fetch(`${BACKEND_URL}/auth/resend-verification`, {
        method: 'POST', headers: authHeaders,
      })
      const d = await res.json()
      if (res.ok) setResendMsg({ type: 'success', text: 'Verification email sent! Check your inbox.' })
      else        setResendMsg({ type: 'error',   text: d.detail || 'Could not send email.' })
    } catch {
      setResendMsg({ type: 'error', text: 'Could not connect to server.' })
    } finally {
      setResendLoading(false)
    }
  }

  const handleEmailChange = async (e) => {
    e.preventDefault()
    const trimmed = newEmail.trim().toLowerCase()
    if (!trimmed || !trimmed.includes('@')) {
      setEmailMsg({ type: 'error', text: 'Enter a valid email address.' }); return
    }
    setEmailLoading(true)
    setEmailMsg(null)
    try {
      const res = await fetch(`${BACKEND_URL}/auth/email`, {
        method: 'PATCH', headers: authHeaders,
        body: JSON.stringify({ new_email: trimmed }),
      })
      const d = await res.json()
      if (res.ok) {
        if (d.pending) {
          setEmailPending(d.email)
          setEmailMsg({ type: 'success', text: `Verification link sent to ${d.email}. Click it to confirm.` })
        } else {
          updateUser({ email: d.email })
          setEmailMsg({ type: 'success', text: 'Email updated successfully.' })
        }
        setNewEmail('')
      } else {
        setEmailMsg({ type: 'error', text: d.detail || 'Failed to change email.' })
      }
    } catch {
      setEmailMsg({ type: 'error', text: 'Could not connect to server.' })
    } finally {
      setEmailLoading(false)
    }
  }

  const handleCancelEmailChange = async () => {
    setCancelLoading(true)
    try {
      await fetch(`${BACKEND_URL}/auth/cancel-email-change`, {
        method: 'POST', headers: authHeaders,
      })
      setEmailPending(null)
      updateUser({ pending_email: null })
      setEmailMsg({ type: 'success', text: 'Email change cancelled.' })
    } catch {
      setEmailMsg({ type: 'error', text: 'Could not connect to server.' })
    } finally {
      setCancelLoading(false)
    }
  }

  const handleProfileSave = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setProfileLoading(true)
    setProfileMsg(null)
    try {
      const res = await fetch(`${BACKEND_URL}/auth/profile`, {
        method: 'PATCH', headers: authHeaders,
        body: JSON.stringify({ name: name.trim() }),
      })
      if (res.ok) {
        updateUser({ name: name.trim() })
        setProfileMsg({ type: 'success', text: 'Name updated successfully.' })
      } else {
        const d = await res.json()
        setProfileMsg({ type: 'error', text: d.detail || 'Failed to update name.' })
      }
    } catch {
      setProfileMsg({ type: 'error', text: 'Could not connect to server.' })
    } finally {
      setProfileLoading(false)
    }
  }

  const handlePasswordSave = async (e) => {
    e.preventDefault()
    if (newPw !== confirmPw) {
      setPwMsg({ type: 'error', text: 'New passwords do not match.' }); return
    }
    if (newPw.length < 6) {
      setPwMsg({ type: 'error', text: 'New password must be at least 6 characters.' }); return
    }
    setPwLoading(true)
    setPwMsg(null)
    try {
      const res = await fetch(`${BACKEND_URL}/auth/password`, {
        method: 'PATCH', headers: authHeaders,
        body: JSON.stringify({ current_password: currentPw, new_password: newPw }),
      })
      if (res.ok) {
        setCurrentPw(''); setNewPw(''); setConfirmPw('')
        setPwMsg({ type: 'success', text: 'Password changed successfully.' })
      } else {
        const d = await res.json()
        setPwMsg({ type: 'error', text: d.detail || 'Failed to change password.' })
      }
    } catch {
      setPwMsg({ type: 'error', text: 'Could not connect to server.' })
    } finally {
      setPwLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 relative overflow-hidden">
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="animate-orb absolute top-0 right-0 w-96 h-96 rounded-full bg-emerald-500/6 blur-3xl" />
      </div>

      <div className="relative z-10 p-6 sm:p-8 max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('dashboard')}
            className="text-slate-500 hover:text-slate-300 transition-colors p-1.5 rounded-lg hover:bg-slate-800/60"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-black text-white">Account Settings</h1>
            <p className="text-slate-500 text-sm mt-0.5">{user?.email}</p>
          </div>
        </div>

        {/* Profile */}
        <Section title="👤 Profile">
          <form onSubmit={handleProfileSave} className="space-y-4">
            <Field label="Display Name">
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your name"
                autoComplete="name"
                className="w-full bg-slate-900/70 border border-slate-700/60 rounded-xl px-4 py-2.5 text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/40 text-sm transition-all"
              />
            </Field>
            <Field label="Email">
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={user?.email || ''}
                  disabled
                  className="flex-1 bg-slate-900/30 border border-slate-800/60 rounded-xl px-4 py-2.5 text-slate-500 text-sm cursor-not-allowed"
                />
                {isVerified(user) ? (
                  <span className="text-emerald-400 text-xs font-semibold flex items-center gap-1 flex-shrink-0">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Verified
                  </span>
                ) : (
                  <span className="text-amber-400 text-xs font-semibold flex items-center gap-1 flex-shrink-0">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    Not verified
                  </span>
                )}
              </div>
              {/* Resend option for unverified accounts */}
              {!isVerified(user) && (
                <div className="mt-2 space-y-2">
                  <p className="text-slate-600 text-xs">
                    Your email is not verified. Click below to receive a new verification link.
                  </p>
                  {resendMsg && (
                    <Toast type={resendMsg.type} message={resendMsg.text} onDismiss={() => setResendMsg(null)} />
                  )}
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resendLoading}
                    className="text-emerald-400 hover:text-emerald-300 text-xs font-semibold transition-colors disabled:opacity-40"
                  >
                    {resendLoading ? 'Sending…' : '↻ Resend verification email'}
                  </button>
                </div>
              )}
            </Field>
            {profileMsg && (
              <Toast type={profileMsg.type} message={profileMsg.text} onDismiss={() => setProfileMsg(null)} />
            )}
            <button
              type="submit"
              disabled={profileLoading || !name.trim() || name.trim() === user?.name}
              className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-all"
            >
              {profileLoading ? 'Saving…' : 'Save Name'}
            </button>
          </form>
        </Section>

        {/* Email change */}
        <Section title="📧 Change Email">
          {emailPending && (
            <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/25 rounded-xl px-4 py-3 text-sm text-amber-300">
              <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div className="flex-1 min-w-0">
                <p className="font-semibold">Awaiting confirmation</p>
                <p className="text-amber-400/80 text-xs mt-0.5 break-all">
                  A verification link was sent to <span className="font-semibold">{emailPending}</span>. Click it to confirm the change.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCancelEmailChange}
                disabled={cancelLoading}
                className="text-amber-500 hover:text-amber-300 text-xs font-semibold flex-shrink-0 transition-colors disabled:opacity-40"
              >
                {cancelLoading ? '…' : 'Cancel'}
              </button>
            </div>
          )}
          <form onSubmit={handleEmailChange} className="space-y-4">
            <Field label="New Email Address">
              <input
                type="email"
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                placeholder="new@example.com"
                autoComplete="email"
                className="w-full bg-slate-900/70 border border-slate-700/60 rounded-xl px-4 py-2.5 text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/40 text-sm transition-all"
              />
            </Field>
            {emailMsg && (
              <Toast type={emailMsg.type} message={emailMsg.text} onDismiss={() => setEmailMsg(null)} />
            )}
            <button
              type="submit"
              disabled={emailLoading || !newEmail.trim()}
              className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-all"
            >
              {emailLoading ? 'Sending…' : 'Send verification link'}
            </button>
          </form>
        </Section>

        {/* Password */}
        <Section title="🔒 Change Password">
          <form onSubmit={handlePasswordSave} className="space-y-4">
            <Field label="Current Password">
              <PasswordInput
                value={currentPw}
                onChange={e => setCurrentPw(e.target.value)}
                placeholder="Enter current password"
                autoComplete="current-password"
              />
            </Field>
            <Field label="New Password" hint="min. 6 characters">
              <PasswordInput
                value={newPw}
                onChange={e => setNewPw(e.target.value)}
                placeholder="Enter new password"
                autoComplete="new-password"
              />
            </Field>
            <Field label="Confirm New Password">
              <PasswordInput
                value={confirmPw}
                onChange={e => setConfirmPw(e.target.value)}
                placeholder="Repeat new password"
                autoComplete="new-password"
              />
            </Field>
            {pwMsg && (
              <Toast type={pwMsg.type} message={pwMsg.text} onDismiss={() => setPwMsg(null)} />
            )}
            <button
              type="submit"
              disabled={pwLoading || !currentPw || !newPw || !confirmPw}
              className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-all"
            >
              {pwLoading ? 'Updating…' : 'Update Password'}
            </button>
          </form>
        </Section>

      </div>
    </div>
  )
}
