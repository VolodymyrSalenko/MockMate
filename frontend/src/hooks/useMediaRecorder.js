import { useCallback, useRef, useState } from 'react'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

export function useMediaRecorder() {
  const recorderRef = useRef(null)
  const chunksRef = useRef([])

  const [recordingUrl, setRecordingUrl] = useState(null)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingError, setRecordingError] = useState('')
  const [savedRecordingPath, setSavedRecordingPath] = useState(null)

  const uploadRecording = async (blob) => {
    // Send the recorded video to the FastAPI backend.
    // The backend saves it into the local backend/recordings folder.
    const formData = new FormData()
    formData.append('file', blob, 'interview-recording.webm')


  const uploadRecording = async (blob) => {
    const formData = new FormData()
    formData.append('file', blob, 'interview-recording.webm')
    const response = await fetch(`${BACKEND_URL}/upload-recording`, {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      throw new Error('Recording upload failed')
    }

    if (!response.ok) throw new Error('Recording upload failed')
    return response.json()
  }

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

      // MediaRecorder records the webcam stream as video/audio chunks.
      // The stream must include both video and audio tracks.
      const recorder = new MediaRecorder(stream, {
        mimeType: 'video/webm',
      })

      recorder.ondataavailable = (event) => {
        // Store only valid chunks. Empty chunks can happen in some browsers.
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
    try {
      chunksRef.current = []
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' })

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) chunksRef.current.push(event.data)
      }

      recorder.onstop = async () => {
        try {
          // Combine all recorded chunks into one playable video file.
          const blob = new Blob(chunksRef.current, { type: 'video/webm' })

          // Create a temporary browser URL for replay on the Debrief page.
          const url = URL.createObjectURL(blob)
          setRecordingUrl(url)

          // Upload the same recording to the backend for local file testing.
          const result = await uploadRecording(blob)
          setSavedRecordingPath(result.path || null)

          setRecordingError('')
        } catch (error) {
          console.error('Recording upload failed:', error)
          const blob = new Blob(chunksRef.current, { type: 'video/webm' })
          const url = URL.createObjectURL(blob)
          setRecordingUrl(url)
          await uploadRecording(blob)
          setRecordingError('')
        } catch {
          setRecordingError('Recording was created but could not be saved to backend.')
        } finally {
          setIsRecording(false)
        }
      }

      recorderRef.current = recorder
      recorder.start()

      setIsRecording(true)
      setRecordingError('')
      setSavedRecordingPath(null)
    } catch (error) {
      console.error('Recording failed to start:', error)
      setIsRecording(true)
      setRecordingError('')
    } catch {
      setRecordingError('Recording failed to start.')
    }
  }, [])

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current

    // Stop only if recorder exists and is currently active.
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop()
    }
  }, [])

  const clearRecording = useCallback(() => {
    // Release previous browser object URL to avoid memory leaks.
    if (recordingUrl) {
      URL.revokeObjectURL(recordingUrl)
    }

    chunksRef.current = []
    setRecordingUrl(null)
    setRecordingError('')
    setSavedRecordingPath(null)
    setIsRecording(false)
  }, [recordingUrl])

  return {
    recordingUrl,
    isRecording,
    recordingError,
    savedRecordingPath,
    startRecording,
    stopRecording,
    clearRecording,
  }
}
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
