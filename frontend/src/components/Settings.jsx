import { useState, useEffect, useRef } from 'react'
import { useAuth, getStoredToken } from '../context/AuthContext'
import { deleteCookie } from '../utils/cookies'
import { setAIConsent, fetchCVProfile, uploadCVProfile, analyseCV } from '../utils/api'
import { BACKEND_URL } from '../utils/config'
import { IconZap, IconBriefcase, IconGraduation, IconGlobe, IconAward, IconMail, IconPhone, IconMapPin, IconLink } from '../utils/icons'

// ── Shared primitives ──────────────────────────────────────────────────────────

function Toast({ type, message, onDismiss }) {
  const s = type === 'success'
    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
    : 'bg-red-500/10 border-red-500/25 text-red-400'
  return (
    <div className={`flex items-center justify-between gap-3 border rounded-xl px-4 py-3 text-sm ${s}`}>
      <span>{message}</span>
      <button onClick={onDismiss} className="opacity-60 hover:opacity-100 transition-opacity text-lg leading-none">×</button>
    </div>
  )
}

function PencilIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
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
        className="w-full bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700/60 rounded-xl px-4 py-2.5 pr-11 text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/40 text-sm transition-all"
      />
      <button type="button" onClick={() => setShow(v => !v)} tabIndex={-1}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors p-1">
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

// Inline-edit row: shows value + pencil → click to edit in place
function InlineRow({ label, value, onSave, loading, type = 'text', hint, suffix }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal]         = useState(value || '')
  const inputRef              = useRef(null)

  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])

  const save = async () => {
    if (val.trim() === (value || '').trim()) { setEditing(false); return }
    await onSave(val.trim())
    setEditing(false)
  }

  return (
    <div className="py-3.5 border-b border-slate-100 dark:border-slate-800/70 last:border-0">
      <p className="text-xs text-slate-500 font-medium mb-1">{label}</p>
      {editing ? (
        <div className="flex items-center gap-2 mt-1">
          <input
            ref={inputRef}
            type={type}
            value={val}
            onChange={e => setVal(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
            className="flex-1 bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700/60 rounded-xl px-3 py-2 text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          />
          <button onClick={save} disabled={loading}
            className="px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold transition-colors disabled:opacity-50">
            {loading ? '…' : 'Save'}
          </button>
          <button onClick={() => { setVal(value || ''); setEditing(false) }}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700/60 text-slate-500 text-xs hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
            Cancel
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{value || '—'}</span>
            {suffix}
          </div>
          {hint && <span className="text-xs text-slate-500">{hint}</span>}
          <button onClick={() => { setVal(value || ''); setEditing(true) }}
            className="flex-shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">
            <PencilIcon />
          </button>
        </div>
      )}
    </div>
  )
}

// ── CV sub-components (embedded in CV tab) ─────────────────────────────────────

const SKILL_COLORS = [
  'bg-emerald-500/15 text-emerald-300 border-emerald-500/25',
  'bg-cyan-500/15 text-cyan-300 border-cyan-500/25',
  'bg-violet-500/15 text-violet-300 border-violet-500/25',
  'bg-blue-500/15 text-blue-300 border-blue-500/25',
  'bg-amber-500/15 text-amber-300 border-amber-500/25',
  'bg-pink-500/15 text-pink-300 border-pink-500/25',
]

function SkillTag({ name, idx }) {
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${SKILL_COLORS[idx % SKILL_COLORS.length]}`}>
      {name}
    </span>
  )
}

function ContactPill({ icon, text }) {
  if (!text) return null
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 bg-slate-100/80 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/40 px-3 py-1.5 rounded-full">
      <span>{icon}</span>
      <span className="truncate max-w-[160px]">{text}</span>
    </span>
  )
}

function CVSectionCard({ title, icon, children }) {
  return (
    <div className="glass border border-slate-200 dark:border-slate-700/40 rounded-2xl p-5">
      <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-sm mb-3">{icon}<span>{title}</span></div>
      {children}
    </div>
  )
}

function ExperienceCard({ exp, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border border-slate-200 dark:border-slate-700/30 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-start gap-3 p-3.5 text-left hover:bg-slate-100/60 dark:hover:bg-slate-800/30 transition-colors">
        <div className="mt-1.5 w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-slate-700 dark:text-slate-200 font-semibold text-sm">{exp.title}</p>
          <p className="text-emerald-400/80 text-xs font-medium mt-0.5">{exp.company}</p>
          {exp.duration && <p className="text-slate-500 text-xs mt-0.5">{exp.duration}</p>}
        </div>
        <span className="text-slate-500 text-xs flex-shrink-0 mt-1">{open ? '▲' : '▼'}</span>
      </button>
      {open && exp.bullets?.length > 0 && (
        <div className="px-4 pb-4 space-y-1.5 border-t border-slate-200 dark:border-slate-800/60 pt-3">
          {exp.bullets.map((b, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-emerald-500 text-xs flex-shrink-0 mt-0.5">•</span>
              <p className="text-slate-600 dark:text-slate-400 text-xs leading-relaxed">{b}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ScoreBar({ score, max = 10, color = 'bg-emerald-500' }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700/60 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.round((score / max) * 100)}%` }} />
      </div>
      <span className="text-xs font-bold text-slate-700 dark:text-slate-300 w-6 text-right">{score}</span>
    </div>
  )
}

// ── Tab definitions ────────────────────────────────────────────────────────────

const TABS = [
  { id: 'profile',  label: 'Profile'  },
  { id: 'cv',       label: 'CV'       },
  { id: 'security', label: 'Security' },
  { id: 'privacy',  label: 'Privacy'  },
]

// ── Main component ─────────────────────────────────────────────────────────────

export default function Settings({ initialTab = 'profile' }) {
  const { user, updateUser, logout } = useAuth()

  // Resolve initial tab: URL param takes priority over prop
  const urlTab = new URLSearchParams(window.location.search).get('tab')
  const validTabs = TABS.map(t => t.id)
  const [tab, setTab] = useState(
    validTabs.includes(urlTab) ? urlTab : (validTabs.includes(initialTab) ? initialTab : 'profile')
  )

  // Keep URL in sync when tab changes
  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    p.set('tab', tab)
    window.history.replaceState({}, '', `?${p.toString()}`)
  }, [tab])

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${getStoredToken()}`,
  }

  // ── Profile tab state ────────────────────────────────────────────────────────
  const [nameLoading,    setNameLoading]    = useState(false)
  const [nameMsg,        setNameMsg]        = useState(null)
  const [emailPending,   setEmailPending]   = useState(user?.pending_email || null)
  const [newEmail,       setNewEmail]       = useState('')
  const [emailLoading,   setEmailLoading]   = useState(false)
  const [emailMsg,       setEmailMsg]       = useState(null)
  const [cancelLoading,  setCancelLoading]  = useState(false)
  const [resendLoading,  setResendLoading]  = useState(false)
  const [resendMsg,      setResendMsg]      = useState(null)
  const [showEmailForm,  setShowEmailForm]  = useState(false)

  // ── CV tab state ─────────────────────────────────────────────────────────────
  const [cvProfile,    setCvProfile]    = useState(null)
  const [cvLoading,    setCvLoading]    = useState(false)
  const [cvUploading,  setCvUploading]  = useState(false)
  const [cvError,      setCvError]      = useState(null)
  const [cvUpdatedAt,  setCvUpdatedAt]  = useState(null)
  const [analysis,     setAnalysis]     = useState(null)
  const [analysing,    setAnalysing]    = useState(false)
  const [analysisErr,  setAnalysisErr]  = useState(null)
  const cvInputRef     = useRef(null)
  const isPro          = user?.plan === 'pro'

  // ── Security tab state ───────────────────────────────────────────────────────
  const [currentPw,  setCurrentPw]  = useState('')
  const [newPw,      setNewPw]      = useState('')
  const [confirmPw,  setConfirmPw]  = useState('')
  const [pwMsg,      setPwMsg]      = useState(null)
  const [pwLoading,  setPwLoading]  = useState(false)

  // ── Privacy tab state ────────────────────────────────────────────────────────
  const [aiConsentLoading, setAiConsentLoading] = useState(false)
  const [aiConsentMsg,     setAiConsentMsg]     = useState(null)
  const [deleteConfirm,    setDeleteConfirm]    = useState(false)
  const [deleteMsg,        setDeleteMsg]        = useState(null)
  const [deleteLoading,    setDeleteLoading]    = useState(false)

  // Load CV when CV tab is first opened
  useEffect(() => {
    if (tab !== 'cv' || cvProfile !== null || cvLoading) return
    setCvLoading(true)
    fetchCVProfile().then(data => {
      if (data) { setCvProfile(data.parsed); setCvUpdatedAt(data.updated_at) }
      setCvLoading(false)
    })
  }, [tab]) // eslint-disable-line

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleSaveName = async (name) => {
    setNameLoading(true); setNameMsg(null)
    try {
      const res = await fetch(`${BACKEND_URL}/auth/profile`, {
        method: 'PATCH', headers: authHeaders, body: JSON.stringify({ name }),
      })
      if (res.ok) { updateUser({ name }); setNameMsg({ type: 'success', text: 'Name updated.' }) }
      else { const d = await res.json(); setNameMsg({ type: 'error', text: d.detail || 'Failed.' }) }
    } catch { setNameMsg({ type: 'error', text: 'Could not connect.' }) }
    finally { setNameLoading(false) }
  }

  const handleEmailChange = async (e) => {
    e.preventDefault()
    const trimmed = newEmail.trim().toLowerCase()
    if (!trimmed.includes('@')) { setEmailMsg({ type: 'error', text: 'Enter a valid email.' }); return }
    setEmailLoading(true); setEmailMsg(null)
    try {
      const res = await fetch(`${BACKEND_URL}/auth/email`, {
        method: 'PATCH', headers: authHeaders, body: JSON.stringify({ new_email: trimmed }),
      })
      const d = await res.json()
      if (res.ok) {
        if (d.pending) { setEmailPending(d.email); setEmailMsg({ type: 'success', text: `Verification sent to ${d.email}` }) }
        else { updateUser({ email: d.email }); setEmailMsg({ type: 'success', text: 'Email updated.' }) }
        setNewEmail(''); setShowEmailForm(false)
      } else setEmailMsg({ type: 'error', text: d.detail || 'Failed.' })
    } catch { setEmailMsg({ type: 'error', text: 'Could not connect.' }) }
    finally { setEmailLoading(false) }
  }

  const handleCancelEmailChange = async () => {
    setCancelLoading(true)
    try {
      await fetch(`${BACKEND_URL}/auth/cancel-email-change`, { method: 'POST', headers: authHeaders })
      setEmailPending(null); updateUser({ pending_email: null })
      setEmailMsg({ type: 'success', text: 'Email change cancelled.' })
    } catch { setEmailMsg({ type: 'error', text: 'Could not connect.' }) }
    finally { setCancelLoading(false) }
  }

  const handleResend = async () => {
    setResendLoading(true); setResendMsg(null)
    try {
      const res = await fetch(`${BACKEND_URL}/auth/resend-verification`, { method: 'POST', headers: authHeaders })
      const d = await res.json()
      if (res.ok) setResendMsg({ type: 'success', text: 'Verification email sent!' })
      else setResendMsg({ type: 'error', text: d.detail || 'Could not send.' })
    } catch { setResendMsg({ type: 'error', text: 'Could not connect.' }) }
    finally { setResendLoading(false) }
  }

  const handleCVFile = async (file) => {
    setCvUploading(true); setCvError(null)
    try {
      const data = await uploadCVProfile(file)
      setCvProfile(data.parsed); setCvUpdatedAt(new Date().toISOString())
    } catch (e) { setCvError(e.message || 'Upload failed.') }
    finally { setCvUploading(false) }
  }

  const handleAnalyse = async () => {
    if (!isPro) return
    setAnalysing(true); setAnalysisErr(null)
    try { setAnalysis(await analyseCV()) }
    catch (e) { setAnalysisErr(e.message || 'Analysis failed') }
    finally { setAnalysing(false) }
  }

  const handlePasswordSave = async (e) => {
    e.preventDefault()
    if (newPw !== confirmPw) { setPwMsg({ type: 'error', text: 'Passwords do not match.' }); return }
    if (newPw.length < 6) { setPwMsg({ type: 'error', text: 'Min 6 characters.' }); return }
    setPwLoading(true); setPwMsg(null)
    try {
      const res = await fetch(`${BACKEND_URL}/auth/password`, {
        method: 'PATCH', headers: authHeaders,
        body: JSON.stringify({ current_password: currentPw, new_password: newPw }),
      })
      if (res.ok) { setCurrentPw(''); setNewPw(''); setConfirmPw(''); setPwMsg({ type: 'success', text: 'Password changed.' }) }
      else { const d = await res.json(); setPwMsg({ type: 'error', text: d.detail || 'Failed.' }) }
    } catch { setPwMsg({ type: 'error', text: 'Could not connect.' }) }
    finally { setPwLoading(false) }
  }

  const handleAIConsent = async (consent) => {
    setAiConsentLoading(true); setAiConsentMsg(null)
    try {
      await setAIConsent(consent)
      updateUser({ ai_consent: consent })
      setAiConsentMsg({ type: 'success', text: consent ? 'AI features enabled.' : 'Consent withdrawn.' })
    } catch { setAiConsentMsg({ type: 'error', text: 'Could not connect.' }) }
    finally { setAiConsentLoading(false) }
  }

  const handleDeleteAccount = async () => {
    setDeleteLoading(true); setDeleteMsg(null)
    try {
      const res = await fetch(`${BACKEND_URL}/auth/account`, { method: 'DELETE', headers: authHeaders })
      if (res.ok) {
        deleteCookie('mockmate_token'); deleteCookie('mockmate_uid'); deleteCookie('mockmate_anon')
        logout()
      } else { const d = await res.json(); setDeleteMsg({ type: 'error', text: d.detail || 'Failed.' }) }
    } catch { setDeleteMsg({ type: 'error', text: 'Could not connect.' }) }
    finally { setDeleteLoading(false) }
  }

  const isVerified = user?.email_verified === true

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="animate-orb absolute top-0 right-0 w-96 h-96 rounded-full bg-emerald-500/6 blur-3xl" />
      </div>

      <div className="relative z-10 p-6 sm:p-8 max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">Settings</h1>
          <p className="text-slate-500 text-sm mt-0.5">{user?.email}</p>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 mb-6 bg-slate-100/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/60 rounded-xl p-1">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-all ${
                tab === t.id
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Profile tab ─────────────────────────────────────────────────────── */}
        {tab === 'profile' && (
          <div className="space-y-5">
            <div className="glass border border-slate-200 dark:border-slate-700/40 rounded-2xl p-6">
              {/* Avatar row */}
              <div className="flex items-center gap-4 mb-5 pb-5 border-b border-slate-100 dark:border-slate-800/70">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-2xl font-black text-white flex-shrink-0 shadow-md shadow-emerald-500/20">
                  {user?.name?.[0]?.toUpperCase() || '?'}
                </div>
                <div>
                  <p className="font-black text-slate-900 dark:text-white">{user?.name}</p>
                  <span className={`inline-flex items-center gap-1.5 mt-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                    user?.plan === 'pro'
                      ? 'bg-amber-500/15 text-amber-400 border-amber-500/25'
                      : 'bg-slate-200/80 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-slate-300 dark:border-slate-700/40'
                  }`}>
                    {user?.plan === 'pro' ? 'Pro' : 'Free'}
                  </span>
                </div>
              </div>

              {/* Inline fields */}
              <InlineRow
                label="Display Name"
                value={user?.name}
                onSave={handleSaveName}
                loading={nameLoading}
              />

              {/* Email row — read-only with badge, pencil shows change form */}
              <div className="py-3.5 border-b border-slate-100 dark:border-slate-800/70">
                <p className="text-xs text-slate-500 font-medium mb-1">Email</p>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{user?.email}</span>
                    {isVerified ? (
                      <span className="flex-shrink-0 text-xs font-semibold text-emerald-400 flex items-center gap-0.5">
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        Verified
                      </span>
                    ) : (
                      <span className="flex-shrink-0 text-xs font-semibold text-amber-400">Not verified</span>
                    )}
                  </div>
                  <button onClick={() => setShowEmailForm(v => !v)}
                    className="flex-shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">
                    <PencilIcon />
                  </button>
                </div>

                {/* Pending email change banner */}
                {emailPending && (
                  <div className="mt-3 flex items-start gap-3 bg-amber-500/10 border border-amber-500/25 rounded-xl px-4 py-3 text-sm text-amber-300">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-xs">Awaiting confirmation</p>
                      <p className="text-amber-400/80 text-xs mt-0.5 break-all">Verification link sent to <span className="font-semibold">{emailPending}</span></p>
                    </div>
                    <button onClick={handleCancelEmailChange} disabled={cancelLoading}
                      className="text-amber-500 hover:text-amber-300 text-xs font-semibold flex-shrink-0 transition-colors disabled:opacity-40">
                      {cancelLoading ? '…' : 'Cancel'}
                    </button>
                  </div>
                )}

                {/* Inline email change form */}
                {showEmailForm && !emailPending && (
                  <form onSubmit={handleEmailChange} className="mt-3 flex gap-2">
                    <input
                      type="email"
                      value={newEmail}
                      onChange={e => setNewEmail(e.target.value)}
                      placeholder="new@email.com"
                      autoComplete="email"
                      className="flex-1 bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700/60 rounded-xl px-3 py-2 text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    />
                    <button type="submit" disabled={emailLoading || !newEmail.trim()}
                      className="px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold transition-colors disabled:opacity-50">
                      {emailLoading ? '…' : 'Send link'}
                    </button>
                    <button type="button" onClick={() => { setShowEmailForm(false); setEmailMsg(null) }}
                      className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700/60 text-slate-500 text-xs hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
                      Cancel
                    </button>
                  </form>
                )}

                {/* Resend for unverified */}
                {!isVerified && !showEmailForm && (
                  <div className="mt-2 space-y-1.5">
                    {resendMsg && <Toast type={resendMsg.type} message={resendMsg.text} onDismiss={() => setResendMsg(null)} />}
                    <button onClick={handleResend} disabled={resendLoading}
                      className="text-emerald-400 hover:text-emerald-300 text-xs font-semibold transition-colors disabled:opacity-40">
                      {resendLoading ? 'Sending…' : '↻ Resend verification email'}
                    </button>
                  </div>
                )}

                {emailMsg && (
                  <div className="mt-2">
                    <Toast type={emailMsg.type} message={emailMsg.text} onDismiss={() => setEmailMsg(null)} />
                  </div>
                )}
              </div>

              {nameMsg && <div className="mt-3"><Toast type={nameMsg.type} message={nameMsg.text} onDismiss={() => setNameMsg(null)} /></div>}
            </div>
          </div>
        )}

        {/* ── CV tab ──────────────────────────────────────────────────────────── */}
        {tab === 'cv' && (
          <div className="space-y-4">
            {cvLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-10 h-10 rounded-full border-4 border-slate-800 border-t-emerald-500 animate-spin" />
              </div>
            ) : !cvProfile ? (
              /* Upload zone */
              <div className="glass border border-slate-200 dark:border-slate-700/40 rounded-2xl p-8">
                <div className="text-center mb-6">
                  <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-3xl">📄</div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white">Upload your CV</h2>
                  <p className="text-slate-500 text-sm mt-1">We'll parse it and use it to personalise your interviews</p>
                </div>
                <div
                  onClick={() => !cvUploading && cvInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-200 dark:border-slate-700/50 hover:border-emerald-500/50 rounded-2xl p-10 flex flex-col items-center gap-3 cursor-pointer transition-all"
                >
                  {cvUploading ? (
                    <>
                      <div className="w-10 h-10 rounded-full border-4 border-slate-800 border-t-emerald-500 animate-spin" />
                      <p className="text-slate-500 text-sm">Parsing with AI… ~10 seconds</p>
                    </>
                  ) : (
                    <>
                      <p className="text-slate-700 dark:text-slate-300 font-semibold text-sm">Drop file here or click to browse</p>
                      <p className="text-slate-500 text-xs">PDF · DOCX · TXT</p>
                    </>
                  )}
                </div>
                {cvError && <p className="mt-3 text-red-400 text-sm text-center">{cvError}</p>}
                <input ref={cvInputRef} type="file" accept=".pdf,.docx,.txt" className="hidden"
                  onChange={e => { if (e.target.files[0]) handleCVFile(e.target.files[0]) }} />
              </div>
            ) : (
              <>
                {/* CV header */}
                <div className="glass border border-slate-200 dark:border-slate-700/40 rounded-2xl p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-xl font-black text-white flex-shrink-0">
                        {cvProfile.name?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div className="min-w-0">
                        <p className="font-black text-slate-900 dark:text-white truncate">{cvProfile.name || 'Your CV'}</p>
                        {cvProfile.title && <p className="text-emerald-400 text-xs font-medium mt-0.5">{cvProfile.title}</p>}
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          <ContactPill icon={<IconMail className="w-3 h-3" />}   text={cvProfile.contact?.email} />
                          <ContactPill icon={<IconPhone className="w-3 h-3" />}  text={cvProfile.contact?.phone} />
                          <ContactPill icon={<IconMapPin className="w-3 h-3" />} text={cvProfile.contact?.location} />
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <button
                        onClick={handleAnalyse}
                        disabled={analysing}
                        className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl transition-all disabled:opacity-50 ${
                          isPro
                            ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white shadow-md shadow-emerald-500/20'
                            : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white shadow-md shadow-amber-500/20'
                        }`}
                      >
                        {analysing ? <><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />Analysing…</> : isPro ? '✨ Analyse' : '🔒 Analyse'}
                      </button>
                      <button onClick={() => cvInputRef.current?.click()} disabled={cvUploading}
                        className="text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-white border border-slate-200 dark:border-slate-700/50 hover:border-slate-400 dark:hover:border-slate-500 rounded-xl px-3 py-2 transition-all disabled:opacity-40">
                        {cvUploading ? 'Uploading…' : 'Replace CV'}
                      </button>
                      {cvUpdatedAt && (
                        <p className="text-slate-500 text-xs">
                          Updated {new Date(cvUpdatedAt).toLocaleDateString('en-CH', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      )}
                    </div>
                  </div>
                  {cvError && <p className="mt-3 text-red-400 text-xs">{cvError}</p>}
                  <input ref={cvInputRef} type="file" accept=".pdf,.docx,.txt" className="hidden"
                    onChange={e => { if (e.target.files[0]) handleCVFile(e.target.files[0]) }} />
                </div>

                {/* Analysis results */}
                {analysisErr && (
                  <div className="bg-red-500/8 border border-red-500/20 rounded-2xl px-4 py-3">
                    <p className="text-red-400 text-sm">{analysisErr}</p>
                  </div>
                )}
                {analysis && (
                  <CVSectionCard title="Resume Analysis" icon={<span className="text-sm">🔬</span>}>
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="bg-slate-100/60 dark:bg-slate-800/40 rounded-xl p-3 text-center">
                        <p className="text-slate-500 text-xs mb-1">Overall</p>
                        <p className={`text-2xl font-black ${analysis.overall_score >= 8 ? 'text-emerald-500' : analysis.overall_score >= 5 ? 'text-amber-500' : 'text-red-500'}`}>
                          {analysis.overall_score}<span className="text-sm font-semibold text-slate-400">/10</span>
                        </p>
                      </div>
                      <div className="bg-slate-100/60 dark:bg-slate-800/40 rounded-xl p-3 text-center">
                        <p className="text-slate-500 text-xs mb-1">ATS Score</p>
                        <p className={`text-2xl font-black ${analysis.ats_score >= 70 ? 'text-emerald-400' : analysis.ats_score >= 45 ? 'text-amber-400' : 'text-red-400'}`}>
                          {analysis.ats_score}<span className="text-sm font-semibold text-slate-400">%</span>
                        </p>
                      </div>
                    </div>
                    {analysis.verdict && (
                      <p className="text-slate-500 text-xs italic mb-3 leading-relaxed border-l-2 border-emerald-500/40 pl-3">{analysis.verdict}</p>
                    )}
                    {analysis.strengths?.length > 0 && (
                      <div className="mb-3">
                        <p className="text-slate-500 text-xs font-semibold uppercase tracking-wide mb-2">Strengths</p>
                        {analysis.strengths.map((s, i) => (
                          <div key={i} className="flex items-start gap-2 mb-1">
                            <span className="text-emerald-500 text-xs flex-shrink-0 mt-0.5">✓</span>
                            <p className="text-slate-500 text-xs leading-relaxed">{s}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    {analysis.improvements?.length > 0 && (
                      <div className="mb-3">
                        <p className="text-slate-500 text-xs font-semibold uppercase tracking-wide mb-2">Improvements</p>
                        {analysis.improvements.map((s, i) => (
                          <div key={i} className="flex items-start gap-2 mb-1">
                            <span className="text-amber-500 text-xs flex-shrink-0 mt-0.5">→</span>
                            <p className="text-slate-500 text-xs leading-relaxed">{s}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    {Object.entries(analysis.section_scores || {}).filter(([, v]) => v != null).length > 0 && (
                      <div className="mb-3">
                        <p className="text-slate-500 text-xs font-semibold uppercase tracking-wide mb-2">Section Scores</p>
                        <div className="space-y-1.5">
                          {Object.entries(analysis.section_scores).filter(([, v]) => v != null).map(([key, val]) => (
                            <div key={key} className="grid grid-cols-[70px_1fr] items-center gap-2">
                              <span className="text-slate-500 text-xs capitalize">{key}</span>
                              <ScoreBar score={val} color={val >= 8 ? 'bg-emerald-500' : val >= 5 ? 'bg-amber-500' : 'bg-red-500'} />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <button onClick={() => setAnalysis(null)} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Clear results</button>
                  </CVSectionCard>
                )}

                {/* CV sections */}
                {cvProfile.profile && (
                  <CVSectionCard title="Profile Summary" icon={<span className="text-sm">👤</span>}>
                    <p className="text-slate-500 text-sm leading-relaxed">{cvProfile.profile}</p>
                  </CVSectionCard>
                )}
                {cvProfile.skills?.length > 0 && (
                  <CVSectionCard title="Skills" icon={<IconZap className="w-4 h-4" />}>
                    <div className="flex flex-wrap gap-2">{cvProfile.skills.map((s, i) => <SkillTag key={i} name={s} idx={i} />)}</div>
                  </CVSectionCard>
                )}
                {cvProfile.experience?.length > 0 && (
                  <CVSectionCard title="Experience" icon={<IconBriefcase className="w-4 h-4" />}>
                    <div className="space-y-2">{cvProfile.experience.map((exp, i) => <ExperienceCard key={i} exp={exp} defaultOpen={i === 0} />)}</div>
                  </CVSectionCard>
                )}
                {cvProfile.education?.length > 0 && (
                  <CVSectionCard title="Education" icon={<IconGraduation className="w-4 h-4" />}>
                    <div className="space-y-3">
                      {cvProfile.education.map((edu, i) => (
                        <div key={i} className="flex items-start gap-3">
                          <div className="mt-1.5 w-2 h-2 rounded-full bg-cyan-500 flex-shrink-0" />
                          <div>
                            <p className="text-slate-700 dark:text-slate-200 font-semibold text-sm">{edu.degree}</p>
                            <p className="text-cyan-400/80 text-xs font-medium mt-0.5">{edu.institution}</p>
                            {edu.year && <p className="text-slate-500 text-xs mt-0.5">{edu.year}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CVSectionCard>
                )}
                {(cvProfile.languages?.length > 0 || cvProfile.certifications?.length > 0) && (
                  <div className={`grid gap-4 ${cvProfile.languages?.length > 0 && cvProfile.certifications?.length > 0 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                    {cvProfile.languages?.length > 0 && (
                      <CVSectionCard title="Languages" icon={<IconGlobe className="w-4 h-4" />}>
                        <div className="space-y-1">{cvProfile.languages.map((l, i) => <p key={i} className="text-slate-500 text-sm">{l}</p>)}</div>
                      </CVSectionCard>
                    )}
                    {cvProfile.certifications?.length > 0 && (
                      <CVSectionCard title="Certifications" icon={<IconAward className="w-4 h-4" />}>
                        <div className="space-y-1">{cvProfile.certifications.map((c, i) => <p key={i} className="text-slate-500 text-xs leading-relaxed">{c}</p>)}</div>
                      </CVSectionCard>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Security tab ─────────────────────────────────────────────────────── */}
        {tab === 'security' && (
          <div className="glass border border-slate-200 dark:border-slate-700/40 rounded-2xl p-6">
            <p className="text-slate-900 dark:text-white font-bold text-base mb-5">Change Password</p>
            <form onSubmit={handlePasswordSave} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-slate-600 dark:text-slate-300 text-xs font-semibold">Current Password</label>
                <PasswordInput value={currentPw} onChange={e => setCurrentPw(e.target.value)} placeholder="Enter current password" autoComplete="current-password" />
              </div>
              <div className="space-y-1.5">
                <label className="block text-slate-600 dark:text-slate-300 text-xs font-semibold">New Password <span className="text-slate-500 font-normal">min. 6 characters</span></label>
                <PasswordInput value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="Enter new password" autoComplete="new-password" />
              </div>
              <div className="space-y-1.5">
                <label className="block text-slate-600 dark:text-slate-300 text-xs font-semibold">Confirm New Password</label>
                <PasswordInput value={confirmPw} onChange={e => setConfirmPw(e.target.value)} placeholder="Repeat new password" autoComplete="new-password" />
              </div>
              {pwMsg && <Toast type={pwMsg.type} message={pwMsg.text} onDismiss={() => setPwMsg(null)} />}
              <button type="submit" disabled={pwLoading || !currentPw || !newPw || !confirmPw}
                className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-all">
                {pwLoading ? 'Updating…' : 'Update Password'}
              </button>
            </form>
          </div>
        )}

        {/* ── Privacy tab ──────────────────────────────────────────────────────── */}
        {tab === 'privacy' && (
          <div className="space-y-5">
            {/* AI consent */}
            <div className="glass border border-slate-200 dark:border-slate-700/40 rounded-2xl p-6 space-y-4">
              <p className="text-slate-900 dark:text-white font-bold text-base border-b border-slate-200 dark:border-slate-800/60 pb-3">AI & Data Processing</p>
              <div className="flex items-start gap-3">
                <div className={`mt-1 w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                  user?.ai_consent === true ? 'bg-emerald-500' : user?.ai_consent === false ? 'bg-red-500' : 'bg-amber-500'
                }`} />
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {user?.ai_consent === true ? 'Consent granted' : user?.ai_consent === false ? 'Consent declined' : 'No decision recorded'}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                    {user?.ai_consent === true
                      ? 'Your CV, job descriptions, and answers may be sent to our AI provider. Emails and phone numbers are stripped before transmission.'
                      : 'AI features require your consent to send data to our AI provider.'}
                  </p>
                </div>
              </div>
              {aiConsentMsg && <Toast type={aiConsentMsg.type} message={aiConsentMsg.text} onDismiss={() => setAiConsentMsg(null)} />}
              <div className="flex gap-2">
                {user?.ai_consent !== true && (
                  <button onClick={() => handleAIConsent(true)} disabled={aiConsentLoading}
                    className="text-sm font-bold px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white transition-all disabled:opacity-40">
                    {aiConsentLoading ? 'Saving…' : 'Grant consent'}
                  </button>
                )}
                {user?.ai_consent === true && (
                  <button onClick={() => handleAIConsent(false)} disabled={aiConsentLoading}
                    className="text-sm font-semibold px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all disabled:opacity-40">
                    {aiConsentLoading ? 'Saving…' : 'Withdraw consent'}
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Recorded under Swiss DSG / GDPR Art. 6. Withdrawal takes effect immediately.
              </p>
            </div>

            {/* Danger zone */}
            <div className="border border-red-500/20 rounded-2xl p-6 space-y-4">
              <p className="text-red-400 font-bold text-base border-b border-red-500/15 pb-3">Danger Zone</p>
              {!deleteConfirm ? (
                <div className="space-y-3">
                  <p className="text-sm text-slate-500 leading-relaxed">
                    Permanently delete your account and all data — sessions, CV, and personal information. This complies with your right to erasure under Swiss DSG / GDPR and <strong className="text-slate-400">cannot be undone</strong>.
                  </p>
                  <button onClick={() => setDeleteConfirm(true)}
                    className="text-sm font-semibold text-red-400 hover:text-red-300 border border-red-500/30 hover:border-red-500/50 hover:bg-red-500/5 px-4 py-2 rounded-xl transition-all">
                    Delete my account
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-red-500/8 border border-red-500/20 rounded-xl p-4 space-y-1.5">
                    <p className="text-sm font-bold text-red-400">This cannot be undone</p>
                    <p className="text-xs text-slate-500 leading-relaxed">All sessions, scores, CV profile, and your account will be permanently erased.</p>
                  </div>
                  {deleteMsg && <Toast type={deleteMsg.type} message={deleteMsg.text} onDismiss={() => setDeleteMsg(null)} />}
                  <div className="flex items-center gap-2">
                    <button onClick={handleDeleteAccount} disabled={deleteLoading}
                      className="text-sm font-bold px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-400 text-white shadow-md shadow-red-500/20 transition-all disabled:opacity-50">
                      {deleteLoading ? 'Deleting…' : 'Yes, delete everything'}
                    </button>
                    <button onClick={() => { setDeleteConfirm(false); setDeleteMsg(null) }}
                      className="text-sm px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-500 hover:text-slate-700 dark:hover:text-white transition-all">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
