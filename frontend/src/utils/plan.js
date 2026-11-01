// The user's plan as the server reports it (/auth/me → usage). The server checks every
// limit; pages use this only to explain them and to offer the next step.

export const PRO_PRICE = 'CHF 9.90'

// Free and Pro side by side: the upgrade dialog, Settings and the homepage all show this
export const PLAN_ROWS = [
  { label: 'Interviews',                       free: '3 a month',      pro: '30 a month' },
  { label: 'Languages',                        free: 'English',        pro: 'EN · DE · FR' },
  { label: 'Interviewer voice',                free: 'Browser voice',  pro: 'Natural voices' },
  { label: 'AI feedback after every interview', free: true,            pro: true },
  { label: 'Speech analytics and dashboard',    free: true,            pro: true },
  { label: 'Retry a question',                 free: 'Once',           pro: 'Up to 5 times' },
  { label: 'Video recording and body language', free: false,           pro: true },
  { label: "Coach's review of your progress",  free: false,            pro: true },
  { label: 'Resume analysis',                  free: false,            pro: true },
]

export const planOf = (user) => user?.usage?.plan || (user?.is_guest ? 'guest' : user?.plan === 'pro' ? 'pro' : 'free')
export const hasFeature = (user, feature) => Boolean(user?.usage?.features?.[feature])

// Any page can open the upgrade dialog or the sign-up page; App listens for these
export const openUpgrade = () => window.dispatchEvent(new Event('mockmate:upgrade'))
export const openSignup  = () => window.dispatchEvent(new Event('mockmate:signup'))
