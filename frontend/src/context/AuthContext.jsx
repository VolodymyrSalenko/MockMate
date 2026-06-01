import { createContext, useContext, useState, useEffect } from 'react'

const STORAGE_KEY = 'mockmate_auth'
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

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
          if (res.ok) { setToken(t); setUser(u) }
          else        { localStorage.removeItem(STORAGE_KEY) }
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

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
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
