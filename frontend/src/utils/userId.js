const ANON_KEY = 'mockmate_user_id'
const AUTH_KEY = 'mockmate_auth'

export function getUserId() {
  // Prefer the ID of the logged-in user
  try {
    const auth = localStorage.getItem(AUTH_KEY)
    if (auth) {
      const { user } = JSON.parse(auth)
      if (user?.id) return user.id
    }
  } catch {}

  // Fall back to anonymous UUID for unauthenticated requests
  let id = localStorage.getItem(ANON_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(ANON_KEY, id)
  }
  return id
}
