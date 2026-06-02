import { createContext, useContext, useState, useEffect } from 'react'

import { BACKEND_URL } from '../utils/config'

const STORAGE_KEY = 'mockmate_auth'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [token,   setToken]   = useState(null)
  const [loading, setLoading] = useState(true)

  // On mount: restore and validate session from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) { setLoading(false); return }

    try {
      const { token: t, user: u } = JSON.parse(stored)
      fetch(`${BACKEND_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${t}` },
      })
        .then(res => {
          if (res.ok) return res.json().then(fresh => {
            // Use fresh data from server so email_verified etc. are always current
            const merged = { ...u, ...fresh }
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: t, user: merged }))
            setToken(t); setUser(merged)
          })
          localStorage.removeItem(STORAGE_KEY)
        })
        .catch(() => {
          // Network unavailable — trust cached session
          setToken(t); setUser(u)
        })
        .finally(() => setLoading(false))
    } catch {
      localStorage.removeItem(STORAGE_KEY)
      setLoading(false)
    }
  }, [])

  const login = (token, user) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, user }))
    setToken(token)
    setUser(user)
  }

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY)
    setToken(null)
    setUser(null)
  }

  const updateUser = (partial) => {
    setUser(prev => {
      const next = { ...prev, ...partial }
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...parsed, user: next }))
      }
      return next
    })
  }

  const refreshUser = async () => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return
    try {
      const { token: t, user: u } = JSON.parse(stored)
      const res = await fetch(`${BACKEND_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${t}` },
      })
      if (res.ok) {
        const fresh = await res.json()
        const merged = { ...u, ...fresh }
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: t, user: merged }))
        setUser(merged)
      }
    } catch {}
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout, updateUser, refreshUser, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}

/** Call this outside React components (e.g. in api.js) */
export function getStoredToken() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return JSON.parse(stored).token
  } catch {}
  return null
}
