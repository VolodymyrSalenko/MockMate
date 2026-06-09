import { getCookie, setCookie } from './cookies'

const UID_COOKIE  = 'mockmate_uid'
const ANON_COOKIE = 'mockmate_anon'

// In-memory fallback for users who declined cookies (resets on page reload)
let _sessionId = null

export function getUserId() {
  // Prefer the authenticated user ID set by AuthContext on login
  const uid = getCookie(UID_COOKIE)
  if (uid) return uid

  // Anonymous user — persist in a cookie so sessions/CV survive page reloads
  let anon = getCookie(ANON_COOKIE)
  if (anon) return anon

  // Migrate from old localStorage anonymous ID
  try {
    const old = localStorage.getItem('mockmate_user_id')
    if (old) {
      setCookie(ANON_COOKIE, old, 60 * 60 * 24 * 365)
      localStorage.removeItem('mockmate_user_id')
      return old
    }
  } catch {}

  // Generate and persist a new anonymous ID
  const newId = crypto.randomUUID()
  setCookie(ANON_COOKIE, newId, 60 * 60 * 24 * 365)
  return newId
}
