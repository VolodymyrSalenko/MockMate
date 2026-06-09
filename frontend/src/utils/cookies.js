const THIRTY_DAYS = 60 * 60 * 24 * 30
const ONE_YEAR    = 60 * 60 * 24 * 365

export function getCookie(name) {
  const value = `; ${document.cookie}`
  const parts = value.split(`; ${name}=`)
  if (parts.length === 2) return decodeURIComponent(parts.pop().split(';').shift())
  return null
}

export function setCookie(name, value, maxAge = THIRTY_DAYS) {
  const secure = location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; SameSite=Strict; Path=/${secure}`
}

export function deleteCookie(name) {
  document.cookie = `${name}=; Max-Age=0; SameSite=Strict; Path=/`
}

export function getConsent() {
  return getCookie('cookieConsent')  // 'accepted' | 'declined' | null
}

export function setConsent(value) {
  setCookie('cookieConsent', value, ONE_YEAR)
}
