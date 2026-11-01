import { createContext, useContext, useState, useEffect } from 'react'
import { BACKEND_URL } from '../utils/config'
import { getCookie, setCookie, deleteCookie } from '../utils/cookies'

const TOKEN_COOKIE  = 'mockmate_token'
const UID_COOKIE    = 'mockmate_uid'
const OLD_LS_KEY    = 'mockmate_auth'   // legacy localStorage key — migrate on first load

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [token,   setToken]   = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let t = getCookie(TOKEN_COOKIE)

    // One-time migration from old localStorage session
    if (!t) {
      try {
        const stored = localStorage.getItem(OLD_LS_KEY)
        if (stored) {
          const parsed = JSON.parse(stored)
          if (parsed?.token) {
            t = parsed.token
            setCookie(TOKEN_COOKIE, t)
            if (parsed.user?.id) setCookie(UID_COOKIE, parsed.user.id)
          }
          localStorage.removeItem(OLD_LS_KEY)
        }
      } catch {}
    }

    if (!t) { setLoading(false); return }

    fetch(`${BACKEND_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${t}` },
    })
      .then(res => {
        if (res.ok) return res.json().then(fresh => {
          setCookie(TOKEN_COOKIE, t)
          setCookie(UID_COOKIE, fresh.id)
          setToken(t)
          setUser(fresh)
        })
        else {
          deleteCookie(TOKEN_COOKIE)
          deleteCookie(UID_COOKIE)
        }
      })
      .catch(() => {
        // Network unavailable — surface token so UI stays responsive
        setToken(t)
      })
      .finally(() => setLoading(false))
  }, [])

  // The sign-in reply is a short profile; the full one carries the plan and what it includes
  const loadProfile = async (t) => {
    try {
      const res = await fetch(`${BACKEND_URL}/auth/me`, { headers: { Authorization: `Bearer ${t}` } })
      if (res.ok) setUser(await res.json())
    } catch {}
  }

  const login = (t, u) => {
    setCookie(TOKEN_COOKIE, t)
    setCookie(UID_COOKIE, u.id)
    setToken(t)
    setUser(u)
    loadProfile(t)
  }

  // Try MockMate without an account: a guest gets one interview
  const loginAsGuest = async () => {
    const res = await fetch(`${BACKEND_URL}/auth/guest`, { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.detail || 'Could not start a trial right now')
    login(data.token, data.user)
    await loadProfile(data.token)
  }

  const logout = () => {
    deleteCookie(TOKEN_COOKIE)
    deleteCookie(UID_COOKIE)
    setToken(null)
    setUser(null)
  }

  const updateUser = (partial) => {
    setUser(prev => ({ ...prev, ...partial }))
  }

  const refreshUser = async () => {
    const t = token || getCookie(TOKEN_COOKIE)
    if (!t) return
    try {
      const res = await fetch(`${BACKEND_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${t}` },
      })
      if (res.ok) {
        const fresh = await res.json()
        setCookie(UID_COOKIE, fresh.id)
        setUser(fresh)
      }
    } catch {}
  }

  return (
    <AuthContext.Provider value={{ user, token, login, loginAsGuest, logout, updateUser, refreshUser, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}

/** Call this outside React components (e.g. in api.js, Settings.jsx) */
export function getStoredToken() {
  return getCookie(TOKEN_COOKIE)
}
