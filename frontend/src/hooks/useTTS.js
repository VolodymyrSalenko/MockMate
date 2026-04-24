import { useCallback, useRef } from 'react'

export function useTTS() {
  const utteranceRef = useRef(null)

  const speak = useCallback((text, onEnd) => {
    window.speechSynthesis.cancel()

    const trySpeak = (attemptsLeft) => {
      const voices = window.speechSynthesis.getVoices()

      if (voices.length === 0 && attemptsLeft > 0) {
        setTimeout(() => trySpeak(attemptsLeft - 1), 200)
        return
      }

      const preferred =
        voices.find((v) => v.lang === 'en-US' && v.name.includes('Google')) ||
        voices.find((v) => v.lang === 'en-US') ||
        voices[0]

      const utterance = new SpeechSynthesisUtterance(text)
      if (preferred) utterance.voice = preferred
      utterance.rate = 0.95
      utterance.pitch = 1.0
      utterance.volume = 1.0
      utterance.onend = () => {
        if (onEnd) onEnd()
      }
      utterance.onerror = (e) => {
        // Ignore interrupted errors (caused by cancel())
        if (e.error !== 'interrupted' && onEnd) onEnd()
      }

      utteranceRef.current = utterance
      window.speechSynthesis.speak(utterance)
    }

    trySpeak(10)
  }, [])

  const cancel = useCallback(() => {
    window.speechSynthesis.cancel()
  }, [])

  const isSupported = typeof window !== 'undefined' && 'speechSynthesis' in window

  return { speak, cancel, isSupported }
}
