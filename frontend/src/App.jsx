import { useState, useEffect } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider, useTheme } from './context/ThemeContext'
import { BACKEND_URL } from './utils/config'
import Auth         from './components/Auth'
import Homepage     from './components/Homepage'
import Sidebar      from './components/Sidebar'
import Landing      from './components/Landing'
import Interview    from './components/Interview'
import Debrief      from './components/Debrief'
import Dashboard    from './components/Dashboard'
import CVProfile    from './components/CVProfile'
import Sessions     from './components/Sessions'
import ProModal     from './components/ProModal'
import Settings     from './components/Settings'
import ErrorBoundary    from './components/ErrorBoundary'
import CookieBanner     from './components/CookieBanner'
import AIConsentModal   from './components/AIConsentModal'
import AdminPanel       from './components/AdminPanel'
import OnboardingModal, { shouldShowOnboarding } from './components/OnboardingModal'

function TopControls({ belowHeader, user, onUpgradeClick, actionButton }) {
  const { theme, toggleTheme } = useTheme()
  const top = belowHeader ? 'top-20' : 'top-4'
  return (
    <div className={`fixed right-4 z-[9999] flex items-center gap-2 ${top}`}>
      {actionButton}
      {user && user.plan !== 'pro' && (
        <button
          onClick={onUpgradeClick}
          className="flex items-center gap-1.5 px-3 h-9 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white text-xs font-bold shadow-lg shadow-amber-500/30 hover:shadow-amber-500/50 transition-all"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M2 19h20M2 19l3-9 5 5 2-8 2 8 5-5 3 9"/>
          </svg>
          GET PRO
        </button>
      )}
      <button
        onClick={toggleTheme}
        title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        className="w-9 h-9 flex items-center justify-center rounded-full glass border border-slate-200 dark:border-slate-700/50 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white shadow-sm hover:shadow-md transition-all"
      >
        {theme === 'dark' ? (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
          </svg>
        )}
      </button>
    </div>
  )
}

function AppInner() {
  const { user, loading, refreshUser } = useAuth()

  const [view,             setView]             = useState('landing')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [showProModal,     setShowProModal]     = useState(false)
  const [showAuth,         setShowAuth]         = useState(
    () => new URLSearchParams(window.location.search).has('reset_token')
  )
  const [authMode,         setAuthMode]         = useState('login')
  const [sessionData,      setSessionData]      = useState(null)
  const [qaPairs,          setQaPairs]          = useState([])
  const [duration,         setDuration]         = useState(0)
  const [faceMetrics,      setFaceMetrics]      = useState(null)
  const [recording,        setRecording]        = useState(null)
  const [banner,           setBanner]           = useState(null)
  const [showAIConsent,    setShowAIConsent]    = useState(false)
  const [showOnboarding,   setShowOnboarding]   = useState(false)
  const [settingsTab,      setSettingsTab]      = useState('profile')

  // Show AI consent modal once for users who haven't decided yet
  useEffect(() => {
    if (user && user.ai_consent == null) setShowAIConsent(true)
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Show onboarding once for new users
  useEffect(() => {
    if (user && shouldShowOnboarding()) setShowOnboarding(true)
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Wake up the Render backend immediately so it's ready when the user acts
  useEffect(() => {
    fetch(`${BACKEND_URL}/health`).catch(() => {})
  }, [])

  // Read initial page from URL on mount (shared links)
  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    // Don't interfere with special redirect params
    if (p.has('checkout') || p.has('email_changed') || p.has('email_change_error') || p.has('dev')) return
    const page = p.get('page')
    if (page && ['landing', 'dashboard', 'sessions', 'settings', 'admin'].includes(page)) {
      setView(page)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Write current page to URL whenever view changes
  useEffect(() => {
    if (!user) return
    const p = new URLSearchParams(window.location.search)
    if (p.has('checkout') || p.has('email_changed') || p.has('email_change_error')) return
    p.set('page', view)
    // Strip landing-specific params when leaving the landing page
    if (view !== 'landing') {
      ['mode', 'type', 'difficulty', 'lang', 'topic', 'company'].forEach(k => p.delete(k))
    }
    // Strip settings tab param when leaving settings
    if (view !== 'settings') p.delete('tab')
    window.history.replaceState({}, '', `?${p.toString()}`)
  }, [view]) // eslint-disable-line react-hooks/exhaustive-deps

  // Handle redirect params from auth backend and Polar checkout
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)

    if (params.get('checkout') === 'success') {
      refreshUser()
      setBanner({ type: 'success', text: "You're now on Pro! Welcome to MockMate Pro 👑" })
      window.history.replaceState({}, '', window.location.pathname)
    } else if (params.get('email_changed') === 'true') {
      refreshUser()
      setBanner({ type: 'success', text: 'Email address updated successfully!' })
      window.history.replaceState({}, '', window.location.pathname)
    } else if (params.get('email_change_error')) {
      const reason = params.get('email_change_error')
      setBanner({
        type: 'error',
        text: reason === 'taken'
          ? 'That email is already in use by another account.'
          : 'Email change link is invalid or has expired.',
      })
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  // Dev shortcut: ?dev=debrief (or dashboard, cv, sessions, landing) skips straight to that view
  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get('dev')
    if (!param) return
    if (param === 'debrief') {
      import(/* @vite-ignore */ './dev/mockData.js').then(({ mockQaPairs, mockSessionData, mockFaceMetrics, mockRecording }) => {
        setSessionData(mockSessionData)
        setQaPairs(mockQaPairs)
        setDuration(487)
        setFaceMetrics(mockFaceMetrics)
        setRecording(mockRecording)
        setView('debrief')
      })
    } else if (['dashboard', 'cv', 'sessions', 'landing', 'settings'].includes(param)) {
      setView(param)
    }
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <TopControls />
        <div className="w-10 h-10 rounded-full border-4 border-slate-800 border-t-emerald-500 animate-spin" />
      </div>
    )
  }

  if (!user) {
    if (showAuth) return <><TopControls /><Auth defaultMode={authMode} /></>
    return (
      <Homepage
        onLogin={() => { setAuthMode('login'); setShowAuth(true) }}
        onRegister={() => { setAuthMode('register'); setShowAuth(true) }}
      />
    )
  }

  const handleStart = (data) => {
    setSessionData(data)
    setQaPairs([])
    setDuration(0)
    setFaceMetrics(null)
    setRecording(null)
    setView('interview')
  }

  const handleComplete = (pairs, totalDuration, metrics, recordingData) => {
    setQaPairs(pairs)
    setDuration(totalDuration || 0)
    setFaceMetrics(metrics || null)
    setRecording(recordingData || null)
    setView('debrief')
  }

  const handleRetry = () => {
    setSessionData(null)
    setQaPairs([])
    setDuration(0)
    setFaceMetrics(null)
    setRecording(null)
    setView('dashboard')
  }

  // Interview and debrief are full-screen — no sidebar
  const sidebarViews = ['dashboard', 'sessions', 'landing', 'settings', 'admin']

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      <TopControls
        belowHeader={view === 'interview' || view === 'debrief'}
        user={user}
        onUpgradeClick={() => setShowProModal(true)}
        actionButton={
          (view === 'dashboard' || view === 'sessions') ? (
            <button
              onClick={() => setView('landing')}
              className="flex items-center gap-1.5 px-3 h-9 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white text-xs font-bold shadow-lg shadow-emerald-500/25 transition-all whitespace-nowrap"
            >
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/>
              </svg>
              {view === 'sessions' ? 'New Interview' : 'Start Interview'}
            </button>
          ) : null
        }
      />

      {sidebarViews.includes(view) && (
        <Sidebar
          activeTab={view}
          onTab={setView}
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(c => !c)}
          onUpgradeClick={() => setShowProModal(true)}
        />
      )}

      {showProModal    && <ProModal onClose={() => setShowProModal(false)} />}
      {showAIConsent   && <AIConsentModal onClose={() => setShowAIConsent(false)} />}
      {showOnboarding  && (
        <OnboardingModal
          onUploadCV={() => {
            setShowOnboarding(false)
            const p = new URLSearchParams(window.location.search)
            p.set('page', 'settings'); p.set('tab', 'cv')
            window.history.replaceState({}, '', `?${p.toString()}`)
            setView('settings')
          }}
          onSkip={() => setShowOnboarding(false)}
        />
      )}

      {/* Global notification banner (e.g. email changed redirect) */}
      {banner && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl border text-sm font-semibold shadow-xl backdrop-blur-sm transition-all ${
          banner.type === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
            : 'bg-red-500/10 border-red-500/25 text-red-400'
        }`}>
          <span>{banner.text}</span>
          <button onClick={() => setBanner(null)} className="opacity-60 hover:opacity-100 text-lg leading-none transition-opacity">×</button>
        </div>
      )}

      {/* Main content — offset by sidebar width when visible */}
      <main className={`flex-1 min-h-screen transition-all duration-300 ${
        sidebarViews.includes(view) ? (sidebarCollapsed ? 'ml-16' : 'ml-60') : ''
      }`}>
        {view === 'dashboard' && <Dashboard  onNavigate={setView} />}
        {view === 'sessions'  && <Sessions   onNavigate={setView} />}
        {view === 'settings'  && <Settings initialTab={settingsTab} />}
        {view === 'admin'     && user?.is_admin && <AdminPanel />}
        {view === 'cv'        && <CVProfile user={user} onUpgrade={() => setShowProModal(true)} />}
        {view === 'landing'   && <Landing   onStart={handleStart} user={user} onUpgrade={() => setShowProModal(true)} />}
        {view === 'interview' && sessionData && (
          <Interview sessionData={sessionData} onComplete={handleComplete} />
        )}
        {view === 'debrief' && (
          <Debrief
            qaPairs={qaPairs}
            role={sessionData?.role || 'the position'}
            difficulty={sessionData?.difficulty || 'Mid'}
            interviewType={sessionData?.interview_type || 'full'}
            language={sessionData?.language || 'en-US'}
            duration={duration}
            faceMetrics={faceMetrics}
            recording={recording}
            onRetry={handleRetry}
          />
        )}
      </main>
    </div>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <ErrorBoundary>
        <AuthProvider>
          <AppInner />
        </AuthProvider>
        <CookieBanner />
      </ErrorBoundary>
    </ThemeProvider>
  )
}
