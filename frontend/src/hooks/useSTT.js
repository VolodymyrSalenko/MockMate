import { useRef, useState, useCallback } from 'react'

export function useSTT({ onFinalTranscript, language = 'en-US' }) {
  const recognitionRef = useRef(null)
  const [interimTranscript, setInterimTranscript] = useState('')
  const [isListening, setIsListening] = useState(false)
  const finalRef        = useRef('')
  const lastInterimRef  = useRef('')

  const isSupported =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

  const start = useCallback(() => {
    if (!isSupported) return

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    recognition.lang = language
    recognition.interimResults = true
    recognition.continuous = true
    recognitionRef.current = recognition
    finalRef.current = ''
    lastInterimRef.current = ''

    recognition.onstart = () => setIsListening(true)

    recognition.onresult = (event) => {
      let interim = ''
      let final = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          final += transcript
        } else {
          interim += transcript
        }
      }
      if (final) finalRef.current += final
      const display = interim || finalRef.current
      lastInterimRef.current = display
      setInterimTranscript(display)
    }

    recognition.onend = () => {
      setIsListening(false)
      setInterimTranscript('')
      // Fall back to last interim if the engine never produced a final result.
      // Always call onFinalTranscript — even with '' — so Interview can reset
      // status to idle when STT ends with no speech (no-speech timeout, etc.)
      const result = finalRef.current.trim() || lastInterimRef.current.trim()
      if (onFinalTranscript) onFinalTranscript(result)
      finalRef.current = ''
      lastInterimRef.current = ''
    }

    recognition.onerror = (e) => {
      if (e.error !== 'no-speech' && e.error !== 'aborted') {
        console.error('STT error:', e.error)
      }
      setIsListening(false)
      setInterimTranscript('')
    }

    try {
      recognition.start()
    } catch (e) {
      console.error('Could not start recognition:', e)
    }
  }, [isSupported, onFinalTranscript, language])

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch (e) {
        // already stopped
      }
    }
  }, [])

  return { start, stop, isListening, interimTranscript, isSupported }
}
