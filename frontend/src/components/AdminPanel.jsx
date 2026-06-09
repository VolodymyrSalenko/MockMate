import { useState, useEffect, useCallback } from 'react'
import { adminListUsers, adminSetPlan, adminSetAdmin, adminDeleteUser } from '../utils/api'

function PlanBadge({ plan }) {
  return plan === 'pro'
    ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/25">Pro</span>
    : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-700/60 text-slate-400 border border-slate-700/60">Free</span>
}

function AdminBadge({ isAdmin }) {
  if (!isAdmin) return null
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-purple-500/15 text-purple-400 border border-purple-500/25">Admin</span>
}

function ConsentDot({ consent }) {
  if (consent === true)  return <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" title="AI consent granted" />
  if (consent === false) return <span className="inline-block w-2 h-2 rounded-full bg-red-400" title="AI consent declined" />
  return <span className="inline-block w-2 h-2 rounded-full bg-slate-600" title="Not decided" />
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-CH', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function AdminPanel() {
  const [users,       setUsers]       = useState([])
  const [total,       setTotal]       = useState(0)
  const [pages,       setPages]       = useState(1)
  const [page,        setPage]        = useState(1)
  const [search,      setSearch]      = useState('')
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState(null)
  const [actionState, setActionState] = useState({}) // { [userId]: { loading, confirm } }

  const load = useCallback(async (p = page, s = search) => {
    setLoading(true)
    setError(null)
    try {
      const data = await adminListUsers(s, p)
      setUsers(data.users)
      setTotal(data.total)
      setPages(data.pages)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [page, search])

  useEffect(() => { load(1, search) }, [search]) // eslint-disable-line
  useEffect(() => { load(page, search) }, [page])  // eslint-disable-line

  const act = (userId, key, value) =>
    setActionState(s => ({ ...s, [userId]: { ...s[userId], [key]: value } }))

  const handleSetPlan = async (user, plan) => {
    act(user.id, 'loading', true)
    try {
      await adminSetPlan(user.id, plan)
      setUsers(us => us.map(u => u.id === user.id ? { ...u, plan } : u))
    } catch (e) { alert(e.message) }
    act(user.id, 'loading', false)
  }

  const handleToggleAdmin = async (user) => {
    act(user.id, 'loading', true)
    try {
      await adminSetAdmin(user.id, !user.is_admin)
      setUsers(us => us.map(u => u.id === user.id ? { ...u, is_admin: !u.is_admin } : u))
    } catch (e) { alert(e.message) }
    act(user.id, 'loading', false)
  }

  const handleDeleteConfirm = (userId) => act(userId, 'confirm', true)
  const handleDeleteCancel  = (userId) => act(userId, 'confirm', false)

  const handleDelete = async (userId) => {
    act(userId, 'loading', true)
    try {
      await adminDeleteUser(userId)
      setUsers(us => us.filter(u => u.id !== userId))
      setTotal(t => t - 1)
    } catch (e) { alert(e.message) }
    act(userId, 'loading', false)
    act(userId, 'confirm', false)
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/25 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white">Admin Panel</h1>
            <p className="text-xs text-slate-500">{total} total users</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4 flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search by email or name…"
            className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 text-slate-900 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
          />
        </div>
        <button
          onClick={() => load(page, search)}
          className="px-4 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-medium hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-sm">{error}</div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">User</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Plan</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Sessions</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">AI</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Joined</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading && users.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-500 text-sm">Loading…</td></tr>
              )}
              {!loading && users.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-500 text-sm">No users found</td></tr>
              )}
              {users.map(user => {
                const state = actionState[user.id] || {}
                return (
                  <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    {/* User */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                          {(user.name || user.email || '?')[0].toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-slate-900 dark:text-slate-100 truncate max-w-[140px]">{user.name || '—'}</span>
                            <AdminBadge isAdmin={user.is_admin} />
                          </div>
                          <span className="text-xs text-slate-500 truncate block max-w-[180px]">{user.email}</span>
                        </div>
                      </div>
                    </td>
                    {/* Plan */}
                    <td className="px-4 py-3"><PlanBadge plan={user.plan} /></td>
                    {/* Sessions */}
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{user.session_count ?? 0}</td>
                    {/* AI consent */}
                    <td className="px-4 py-3"><ConsentDot consent={user.ai_consent} /></td>
                    {/* Joined */}
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatDate(user.created_at)}</td>
                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2 flex-wrap">
                        {state.loading ? (
                          <span className="text-xs text-slate-500">Saving…</span>
                        ) : state.confirm ? (
                          <>
                            <span className="text-xs text-red-400 font-medium">Delete user?</span>
                            <button onClick={() => handleDelete(user.id)} className="px-2.5 py-1 rounded-lg bg-red-500/15 text-red-400 border border-red-500/25 text-xs font-bold hover:bg-red-500/25 transition-colors">Confirm</button>
                            <button onClick={() => handleDeleteCancel(user.id)} className="px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-medium hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors">Cancel</button>
                          </>
                        ) : (
                          <>
                            {/* Plan toggle */}
                            {user.plan === 'pro' ? (
                              <button onClick={() => handleSetPlan(user, 'free')} className="px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-medium hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors">Set Free</button>
                            ) : (
                              <button onClick={() => handleSetPlan(user, 'pro')} className="px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/25 text-xs font-bold hover:bg-amber-500/25 transition-colors">Set Pro</button>
                            )}
                            {/* Admin toggle */}
                            <button
                              onClick={() => handleToggleAdmin(user)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                                user.is_admin
                                  ? 'bg-purple-500/15 text-purple-400 border border-purple-500/25 hover:bg-purple-500/25'
                                  : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-700'
                              }`}
                            >
                              {user.is_admin ? 'Revoke Admin' : 'Make Admin'}
                            </button>
                            {/* Delete */}
                            <button onClick={() => handleDeleteConfirm(user.id)} className="px-2.5 py-1 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-medium hover:bg-red-500/20 transition-colors">Delete</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <span className="text-xs text-slate-500">Page {page} of {pages} · {total} users</span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-medium disabled:opacity-40 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >Previous</button>
              <button
                onClick={() => setPage(p => Math.min(pages, p + 1))}
                disabled={page >= pages}
                className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-medium disabled:opacity-40 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
