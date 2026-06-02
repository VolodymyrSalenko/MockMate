import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'

function PanelIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 3v18" />
    </svg>
  )
}

function NavItem({ icon, label, active, collapsed, onClick }) {
  return (
    <button
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={`w-full flex items-center gap-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
        collapsed ? 'justify-center px-0 py-2.5' : 'px-4 py-2.5'
      } ${
        active
          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/20'
          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
      }`}
    >
      <span className="text-base flex-shrink-0">{icon}</span>
      {!collapsed && <span>{label}</span>}
    </button>
  )
}

function PlanBadge({ plan, collapsed, onUpgradeClick }) {
  if (plan === 'pro') {
    return (
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 mb-2 ${collapsed ? 'justify-center px-0' : ''}`}>
        <span className="text-xs">👑</span>
        {!collapsed && <span className="text-amber-400 text-xs font-bold">Pro Plan</span>}
      </div>
    )
  }
  if (collapsed) {
    return (
      <button
        onClick={onUpgradeClick}
        title="Upgrade to Pro"
        className="w-full flex items-center justify-center py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white text-sm transition-all shadow-lg shadow-amber-500/20 mb-2"
      >
        <span>👑</span>
      </button>
    )
  }
  return (
    <button
      onClick={onUpgradeClick}
      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white text-sm font-bold transition-all shadow-lg shadow-amber-500/20 mb-2"
    >
      <span>👑</span>
      <span>Upgrade to Pro</span>
    </button>
  )
}

export default function Sidebar({ activeTab, onTab, collapsed, onToggle, onUpgradeClick }) {
  const { user, logout } = useAuth()
  const initial = user?.name?.[0]?.toUpperCase() || 'U'

  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef   = useRef(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!menuOpen) return
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  return (
    <aside
      className="fixed left-0 top-0 bottom-0 flex flex-col z-40 transition-all duration-300"
      style={{
        width: collapsed ? '4rem' : '15rem',
        background: 'rgba(2,6,23,0.95)',
        borderRight: '1px solid rgba(51,65,85,0.4)',
        backdropFilter: 'blur(20px)',
      }}
    >
      {/* Tab toggle — sticks out from right edge */}
      <button
        onClick={onToggle}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className="absolute top-4 -right-8 w-8 h-8 flex items-center justify-center rounded-r-xl text-slate-400 hover:text-slate-200 transition-colors z-50"
        style={{
          background: 'rgba(2,6,23,0.95)',
          borderTop: '1px solid rgba(51,65,85,0.4)',
          borderRight: '1px solid rgba(51,65,85,0.4)',
          borderBottom: '1px solid rgba(51,65,85,0.4)',
          backdropFilter: 'blur(20px)',
        }}
      >
        <PanelIcon />
      </button>

      {/* Logo */}
      {collapsed ? (
        <div className="flex flex-col items-center py-4 border-b border-slate-700/40">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
            <span className="text-white text-sm font-black">M</span>
          </div>
        </div>
      ) : (
        <div className="px-4 py-4 border-b border-slate-700/40 flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/30 flex-shrink-0">
            <span className="text-white text-sm font-black">M</span>
          </div>
          <div>
            <h1 className="text-lg font-black leading-none">
              <span className="text-white">Mock</span>
              <span className="gradient-text">Mate</span>
            </h1>
            <p className="text-slate-600 text-xs">AI Interview Coach</p>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className={`flex-1 py-3 space-y-1 overflow-y-auto ${collapsed ? 'px-2' : 'px-3'}`}>
        {!collapsed && (
          <p className="text-slate-600 text-xs font-bold uppercase tracking-widest px-4 pt-1 pb-1">Menu</p>
        )}
        <NavItem icon="📊" label="Dashboard" active={activeTab === 'dashboard'} collapsed={collapsed} onClick={() => onTab('dashboard')} />
        <NavItem icon="📋" label="Sessions"  active={activeTab === 'sessions'}  collapsed={collapsed} onClick={() => onTab('sessions')} />
        <NavItem icon="🎙" label="Practice"  active={activeTab === 'landing'}   collapsed={collapsed} onClick={() => onTab('landing')} />
      </nav>

      {/* Bottom section */}
      <div className={`border-t border-slate-700/40 ${collapsed ? 'p-2' : 'p-3'}`}>
        <PlanBadge plan={user?.plan} collapsed={collapsed} onUpgradeClick={onUpgradeClick} />

        {/* User area — clicking opens dropdown */}
        <div className="relative" ref={menuRef}>

          {/* Dropdown menu */}
          {menuOpen && (
            <div
              className="absolute bottom-full mb-2 left-0 right-0 rounded-2xl overflow-hidden shadow-2xl border border-slate-700/50 z-50"
              style={{ background: 'rgba(15,23,42,0.98)', backdropFilter: 'blur(20px)' }}
            >
              <button
                onClick={() => { setMenuOpen(false); onTab('settings') }}
                className="w-full flex items-center gap-3 px-4 py-3 text-slate-300 hover:text-emerald-400 hover:bg-emerald-500/8 transition-colors text-sm font-medium group"
              >
                <svg className="w-4 h-4 flex-shrink-0 text-slate-500 group-hover:text-emerald-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Profile
              </button>
              <div className="h-px bg-slate-800/80 mx-3" />
              <button
                onClick={() => { setMenuOpen(false); logout() }}
                className="w-full flex items-center gap-3 px-4 py-3 text-slate-300 hover:text-red-400 hover:bg-red-500/8 transition-colors text-sm font-medium group"
              >
                <svg className="w-4 h-4 flex-shrink-0 text-slate-500 group-hover:text-red-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Sign out
              </button>
            </div>
          )}

          {/* Trigger button */}
          <button
            onClick={() => setMenuOpen(v => !v)}
            title={collapsed ? 'Account menu' : undefined}
            className={`w-full flex items-center gap-3 rounded-xl hover:bg-slate-800/60 border transition-colors ${
              menuOpen ? 'border-slate-600/60 bg-slate-800/40' : 'border-slate-700/40'
            } ${collapsed ? 'justify-center p-2' : 'px-3 py-2.5'}`}
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-md">
              {initial}
            </div>
            {!collapsed && (
              <>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-slate-200 text-xs font-semibold truncate">{user?.name}</p>
                  <p className="text-slate-500 text-xs truncate">{user?.email}</p>
                </div>
                <svg className={`w-3.5 h-3.5 text-slate-600 flex-shrink-0 transition-transform ${menuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              </>
            )}
          </button>
        </div>
      </div>
    </aside>
  )
}
