import { useCallback, useRef } from 'react'

const ELEVENLABS_KEY  = import.meta.env.VITE_ELEVENLABS_API_KEY || ''
const ELEVENLABS_URL  = 'https://api.elevenlabs.io/v1/text-to-speech/onwK4e9ZLuTAKqWW03F9'

export function useTTS({ language = 'en-US' } = {}) {
  const audioRef = useRef(null)
  const genRef   = useRef(0)

  const cancel = useCallback(() => {
    genRef.current += 1
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
      audioRef.current = null
    }
  }, [])

  const speak = useCallback((text, onEnd) => {
    genRef.current += 1
    const myGen = genRef.current

    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
      audioRef.current = null
    }

    if (!text || !text.trim()) {
      if (onEnd) onEnd()
      return
    }

    fetch(ELEVENLABS_URL, {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`ElevenLabs ${res.status}`)
        return res.blob()
      })
      .then((blob) => {
        if (genRef.current !== myGen) return
        const url = URL.createObjectURL(blob)
        const audio = new Audio(url)
        audioRef.current = audio

        audio.onended = () => {
          if (genRef.current !== myGen) return
          URL.revokeObjectURL(url)
          audioRef.current = null
          if (onEnd) onEnd()
        }

        audio.onerror = () => {
          URL.revokeObjectURL(url)
          audioRef.current = null
          if (genRef.current !== myGen) return
          if (onEnd) onEnd()
        }

        audio.play().catch(() => {
          if (genRef.current !== myGen) return
          if (onEnd) onEnd()
        })
      })
      .catch(() => {
        if (genRef.current !== myGen) return
        if (onEnd) onEnd()
      })
  }, [])

  const isSupported = true

  return { speak, cancel, isSupported }
}
