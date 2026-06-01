import { useState } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import Auth      from './components/Auth'
import Sidebar   from './components/Sidebar'
import Landing   from './components/Landing'
import Interview from './components/Interview'
import Debrief   from './components/Debrief'
import Dashboard from './components/Dashboard'
import Sessions  from './components/Sessions'

function AppInner() {
  const { user, loading } = useAuth()

  const [view,            setView]            = useState('dashboard')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [sessionData,     setSessionData]     = useState(null)
  const [qaPairs,         setQaPairs]         = useState([])
  const [duration,        setDuration]        = useState(0)
  const [faceMetrics,     setFaceMetrics]     = useState(null)
  const [recording,       setRecording]       = useState(null)

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-4 border-slate-800 border-t-emerald-500 animate-spin" />
      </div>
    )
  }

  if (!user) return <Auth />

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
  const fullScreen = view === 'interview' || view === 'debrief'
  const sidebarViews = ['dashboard', 'sessions', 'landing']

  return (
    <div className="flex min-h-screen bg-slate-950">
      {sidebarViews.includes(view) && (
        <Sidebar
          activeTab={view}
          onTab={setView}
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(c => !c)}
        />
      )}

      {/* Floating panel toggle — shown only when sidebar is collapsed */}
      {sidebarViews.includes(view) && sidebarCollapsed && (
        <button
          onClick={() => setSidebarCollapsed(false)}
          title="Expand sidebar"
          className="fixed top-4 left-[4.5rem] z-50 p-2 rounded-xl glass border border-slate-700/40 text-slate-400 hover:text-slate-200 hover:border-slate-600/60 transition-all"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M9 3v18" />
          </svg>
        </button>
      )}

      {/* Main content — offset by sidebar width when visible */}
      <main className={`flex-1 min-h-screen transition-all duration-300 ${
        sidebarViews.includes(view) ? (sidebarCollapsed ? 'ml-16' : 'ml-60') : ''
      }`}>
        {view === 'dashboard' && (
          <Dashboard onNavigate={setView} />
        )}
        {view === 'sessions' && (
          <Sessions onNavigate={setView} />
        )}
        {view === 'landing' && (
          <Landing onStart={handleStart} />
        )}
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
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  )
}
