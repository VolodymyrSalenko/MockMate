import { useCallback, useRef, useState } from 'react'
import { startRecordingMix } from '../utils/recordingMix'

export function useMediaRecorder() {
  const recorderRef = useRef(null)
  const chunksRef   = useRef([])

  const [recordingUrl,   setRecordingUrl]   = useState(null)
  const [isRecording,    setIsRecording]    = useState(false)
  const [recordingError, setRecordingError] = useState('')

  const startRecording = useCallback((stream) => {
    if (!stream) {
      setRecordingError('Recording cannot start because camera stream is not available.')
      return
    }
    if (!window.MediaRecorder) {
      setRecordingError('MediaRecorder is not supported in this browser.')
      return
    }

    try {
      chunksRef.current = []
      // Camera video + microphone mixed with the interviewer's voice
      const mix = startRecordingMix(stream)
      const recorder = new MediaRecorder(mix.stream, { mimeType: 'video/webm' })

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) chunksRef.current.push(event.data)
      }

      // The recording stays in the browser; the debrief stores it with the saved session
      recorder.onstop = () => {
        mix.stop()
        const blob = new Blob(chunksRef.current, { type: 'video/webm' })
        setRecordingUrl(URL.createObjectURL(blob))
        setIsRecording(false)
      }

      recorderRef.current = recorder
      recorder.start()
      setIsRecording(true)
      setRecordingError('')
    } catch {
      setRecordingError('Recording failed to start.')
    }
  }, [])

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') recorder.stop()
  }, [])

  const clearRecording = useCallback(() => {
    if (recordingUrl) URL.revokeObjectURL(recordingUrl)
    chunksRef.current = []
    setRecordingUrl(null)
    setRecordingError('')
    setIsRecording(false)
  }, [recordingUrl])

  return { recordingUrl, isRecording, recordingError, startRecording, stopRecording, clearRecording }
}
