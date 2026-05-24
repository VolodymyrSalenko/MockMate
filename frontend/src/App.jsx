import { useState } from 'react'
import Landing from './components/Landing'
import Interview from './components/Interview'
import Debrief from './components/Debrief'

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

  return (
    <>
      {view === 'landing' && <Landing onStart={handleStart} />}
      {view === 'interview' && sessionData && (
        <Interview sessionData={sessionData} onComplete={handleComplete} />
      )}
      {view === 'debrief' && (
        <Debrief
          qaPairs={qaPairs}
          role={sessionData?.role || 'the position'}
          difficulty={sessionData?.difficulty || 'Mid'}
          duration={duration}
          faceMetrics={faceMetrics}
          recording={recording}
          onRetry={handleRetry}
        />
      )}
    </>
  )
}
