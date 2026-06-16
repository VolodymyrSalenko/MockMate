import { useCallback, useRef } from 'react'
import { BACKEND_URL } from '../utils/config'
import { getStoredToken } from '../context/AuthContext'

function browserSpeak(text, onEnd) {
  const utter = new SpeechSynthesisUtterance(text)
  utter.rate = 1.0
  utter.pitch = 1.0
  utter.onend = () => { if (onEnd) onEnd() }
  utter.onerror = () => { if (onEnd) onEnd() }
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(utter)
}

function ttsRequest(text) {
  const token = getStoredToken()
  return fetch(`${BACKEND_URL}/tts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ text }),
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

export function useTTS({ language = 'en-US' } = {}) {
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
    if (!text?.trim()) return
    if (cacheRef.current.has(text) || pendingRef.current.has(text)) return

    const p = ttsRequest(text)
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

  const speak = useCallback((text, onEnd) => {
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

    const playUrl = (url) => {
      if (genRef.current !== myGen) { URL.revokeObjectURL(url); return }
      const audio = new Audio(url)
      audioRef.current = audio
      audio.onended = () => {
        if (genRef.current !== myGen) return
        URL.revokeObjectURL(url)
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
        else browserSpeak(text, onEnd)
      })
      return
    }

    // No prefetch — fetch now
    ttsRequest(text)
      .then((url) => {
        if (genRef.current !== myGen) { URL.revokeObjectURL(url); return }
        playUrl(url)
      })
      .catch((err) => {
        console.error('[TTS] backend error, falling back to browser TTS:', err)
        if (genRef.current !== myGen) return
        browserSpeak(text, onEnd)
      })
  }, [])

  const isSupported = true

  return { speak, cancel, prefetch, isSupported }
}
