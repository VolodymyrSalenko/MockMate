import { useCallback, useRef } from 'react'

function pickVoice(voices, language = 'en-US') {
  const langPrefix = language.split('-')[0]

  const matching = voices.filter((v) => {
    const normalized = v.lang.replace('_', '-')
    return normalized === language || normalized.startsWith(langPrefix + '-')
  })

  // Prefer male voices (David, Mark, James, Daniel, Guy, Fred, Alex)
  const isMale = (v) => /\b(Male|David|Mark|James|Daniel|Guy|Fred|Alex)\b/i.test(v.name)

  return (
    matching.find((v) => isMale(v) && /Natural/i.test(v.name)) ||
    matching.find((v) => isMale(v) && /Online/i.test(v.name)) ||
    matching.find((v) => isMale(v) && /Google/i.test(v.name)) ||
    matching.find((v) => isMale(v)) ||
    matching.find((v) => /Natural/i.test(v.name)) ||
    matching.find((v) => /Online/i.test(v.name)) ||
    matching.find((v) => /Google/i.test(v.name)) ||
    matching[0] ||
    voices[0]
  )
}

function toSentences(text) {
  const chunks = text.split(/(?<=[.!?])\s+/)
  return chunks.map((s) => s.trim()).filter(Boolean)
}

export function useTTS({ language = 'en-US' } = {}) {
  const keepAliveRef = useRef(null)
  const genRef       = useRef(0)

  const speak = useCallback((text, onEnd) => {
    // Increment generation BEFORE cancel so any onend fired by cancel()
    // sees the new generation and exits immediately.
    genRef.current += 1
    const myGen = genRef.current

    window.speechSynthesis.cancel()
    clearInterval(keepAliveRef.current)

    const trySpeak = (attemptsLeft) => {
      if (genRef.current !== myGen) return

      const voices = window.speechSynthesis.getVoices()
      if (voices.length === 0 && attemptsLeft > 0) {
        setTimeout(() => trySpeak(attemptsLeft - 1), 200)
        return
      }

      const voice     = pickVoice(voices, language)
      const sentences = toSentences(text)
      let idx         = 0

      const speakNext = () => {
        // Bail if a newer speak() or cancel() has taken over
        if (genRef.current !== myGen) return

        if (idx >= sentences.length) {
          if (onEnd) onEnd()
          return
        }

        const utterance = new SpeechSynthesisUtterance(sentences[idx++])
        if (voice) utterance.voice = voice
        utterance.lang   = language
        utterance.rate   = 0.90
        utterance.pitch  = 1.0
        utterance.volume = 1.0

        // Per-utterance flag so Chrome's occasional double-onend is also harmless
        let fired = false
        utterance.onend = () => {
          if (fired || genRef.current !== myGen) return
          fired = true
          setTimeout(speakNext, 120)
        }
        utterance.onerror = (e) => {
          if (e.error === 'interrupted') return
          if (!fired && genRef.current === myGen) {
            fired = true
            if (onEnd) onEnd()
          }
        }

        clearInterval(keepAliveRef.current)
        window.speechSynthesis.speak(utterance)

        keepAliveRef.current = setInterval(() => {
          if (!window.speechSynthesis.speaking) {
            clearInterval(keepAliveRef.current)
            return
          }
          window.speechSynthesis.resume()
        }, 10000)
      }

      speakNext()
    }

    trySpeak(10)
  }, [language])

  const cancel = useCallback(() => {
    genRef.current += 1
    clearInterval(keepAliveRef.current)
    window.speechSynthesis.cancel()
  }, [])

  const isSupported = typeof window !== 'undefined' && 'speechSynthesis' in window

  return { speak, cancel, isSupported }
}
