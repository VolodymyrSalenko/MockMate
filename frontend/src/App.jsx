import { useState } from 'react'
import Landing from './components/Landing'
import Interview from './components/Interview'
import Debrief from './components/Debrief'
import Dashboard from './components/Dashboard'
import CVProfile from './components/CVProfile'

// ── Top navigation (shown on landing + dashboard, hidden during interview/debrief)
function TopNav({ activeTab, onTab }) {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-3 px-4 pointer-events-none">
      <div className="pointer-events-auto flex gap-1.5 glass border border-slate-700/50 rounded-2xl p-1 shadow-xl backdrop-blur-md">
        {[
          { key: 'landing',   label: '🎙 Practice' },
          { key: 'dashboard', label: '📊 Dashboard' },
          { key: 'cv',        label: '📄 My CV' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => onTab(t.key)}
            className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
              activeTab === t.key
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
    </nav>
  )
}

export default function App() {
  const [view,        setView]        = useState('landing')
  const [sessionData, setSessionData] = useState(null)
  const [qaPairs,     setQaPairs]     = useState([])
  const [duration,    setDuration]    = useState(0)
  const [faceMetrics, setFaceMetrics] = useState(null)
  const [recording,   setRecording]   = useState(null)

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
    setView('landing')
  }

  // Show top nav only on landing, dashboard and cv tabs
  const showNav = view === 'landing' || view === 'dashboard' || view === 'cv'

  return (
    <>
      {showNav && <TopNav activeTab={view} onTab={setView} />}

      {/* Add top padding on pages with the nav bar */}
      <div className={showNav ? 'pt-16' : ''}>
        {view === 'landing' && <Landing onStart={handleStart} />}
        {view === 'dashboard' && <Dashboard />}
        {view === 'cv' && <CVProfile />}
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
      </div>
    </>
  )
}
