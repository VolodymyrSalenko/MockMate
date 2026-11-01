import { useCallback, useRef } from 'react'
import { BACKEND_URL } from '../utils/config'
import { getStoredToken, useAuth } from '../context/AuthContext'
import { hasFeature } from '../utils/plan'
import { routeToRecording, keepLastLine } from '../utils/recordingMix'

function browserSpeak(text, onEnd, onStart, language) {
  const utter = new SpeechSynthesisUtterance(text)
  if (language) utter.lang = language
  utter.onstart = () => { if (onStart) onStart() }
  utter.rate = 1.0
  utter.pitch = 1.0
  utter.onend = () => { if (onEnd) onEnd() }
  utter.onerror = () => { if (onEnd) onEnd() }
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(utter)
}

function ttsRequest(text, interviewer, voice) {
  const token = getStoredToken()
  return fetch(`${BACKEND_URL}/tts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ text, interviewer, voice }),
  })
    .then((res) => {
      if (!res.ok) {
        console.error('[TTS] backend returned', res.status)
        throw new Error(`TTS ${res.status}`)
      }
      return res.blob()
    })
    .then((blob) => URL.createObjectURL(blob))
}

export function useTTS({ language = 'en-US', interviewer, voice } = {}) {
  // Interviewer + voice pick the ElevenLabs voice; a ref keeps the stable callbacks below up to date
  const voiceRef = useRef({ interviewer, voice })
  voiceRef.current = { interviewer, voice }
  // Natural (ElevenLabs) voices are part of Pro; other plans hear the browser's voice
  const { user } = useAuth()
  const premiumRef = useRef(false)
  premiumRef.current = hasFeature(user, 'premium_voice')
  const langRef = useRef(language)
  langRef.current = language
  const audioRef  = useRef(null)
  const genRef    = useRef(0)
  const cacheRef  = useRef(new Map()) // text -> blobUrl (ready)
  const pendingRef = useRef(new Map()) // text -> Promise<blobUrl>

  const cancel = useCallback(() => {
    genRef.current += 1
    window.speechSynthesis.cancel()
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
      audioRef.current = null
    }
  }, [])

  // Call as early as possible to warm up the audio before speak() is called
  const prefetch = useCallback((text) => {
    if (!text?.trim() || !premiumRef.current) return
    if (cacheRef.current.has(text) || pendingRef.current.has(text)) return

    const p = ttsRequest(text, voiceRef.current.interviewer, voiceRef.current.voice)
      .then((url) => {
        cacheRef.current.set(text, url)
        pendingRef.current.delete(text)
        return url
      })
      .catch((err) => {
        console.error('[TTS] prefetch failed:', err)
        pendingRef.current.delete(text)
        return null
      })

    pendingRef.current.set(text, p)
  }, [])

  // onStart fires when sound actually begins (after the audio has downloaded)
  const speak = useCallback((text, onEnd, onStart) => {
    genRef.current += 1
    const myGen = genRef.current

    window.speechSynthesis.cancel()
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
      audioRef.current = null
    }

    if (!text?.trim()) {
      if (onEnd) onEnd()
      return
    }

    if (!premiumRef.current) {
      browserSpeak(text, onEnd, onStart, langRef.current)
      return
    }

    const playUrl = (url) => {
      if (genRef.current !== myGen) { URL.revokeObjectURL(url); return }
      const audio = new Audio(url)
      audioRef.current = audio
      routeToRecording(audio)   // the question is heard in the interview recording too
      audio.onplaying = () => {
        if (genRef.current === myGen && onStart) onStart()
      }
      audio.onended = () => {
        if (genRef.current !== myGen) return
        keepLastLine(url)   // kept for a recording that starts after this line
        cacheRef.current.delete(text)
        audioRef.current = null
        if (onEnd) onEnd()
      }
      audio.onerror = () => {
        URL.revokeObjectURL(url)
        cacheRef.current.delete(text)
        audioRef.current = null
        if (genRef.current !== myGen) return
        if (onEnd) onEnd()
      }
      audio.play().catch(() => {
        if (genRef.current !== myGen) return
        if (onEnd) onEnd()
      })
    }

    // Cache hit — play immediately, zero latency
    if (cacheRef.current.has(text)) {
      playUrl(cacheRef.current.get(text))
      return
    }

    // Prefetch in flight — wait for it instead of starting a second request
    if (pendingRef.current.has(text)) {
      pendingRef.current.get(text).then((url) => {
        if (genRef.current !== myGen) return
        if (url) playUrl(url)
        else browserSpeak(text, onEnd, onStart, langRef.current)
      })
      return
    }

    // No prefetch — fetch now
    ttsRequest(text, voiceRef.current.interviewer, voiceRef.current.voice)
      .then((url) => {
        if (genRef.current !== myGen) { URL.revokeObjectURL(url); return }
        playUrl(url)
      })
      .catch((err) => {
        console.error('[TTS] backend error, falling back to browser TTS:', err)
        if (genRef.current !== myGen) return
        browserSpeak(text, onEnd, onStart, langRef.current)
      })
  }, [])

  const isSupported = true

  return { speak, cancel, prefetch, isSupported }
}
