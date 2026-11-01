// Filters shared by the Dashboard and Sessions pages: one choice applies to both
import { useState } from 'react'
import { langInfo } from '../utils/scoring'

// Every option the app offers, so a filter can also show that something was never practised
export const TYPE_LABELS = { full: 'Full', behavioral: 'Behavioral (STAR)', technical: 'Technical' }
export const LEVELS      = ['Junior', 'Mid', 'Senior']
export const LANGUAGES   = ['en-US', 'de-DE', 'fr-FR']
export const NO_FILTERS  = { period: 'all', level: 'all', type: 'all', language: 'all' }

const FILTERS_KEY = 'mockmate.sessionFilters'

function loadFilters() {
  try { return { ...NO_FILTERS, ...JSON.parse(localStorage.getItem(FILTERS_KEY) || '{}') } } catch { return NO_FILTERS }
}

// The chosen filters, remembered in this browser
export function useSessionFilters() {
  const [filters, setFilters] = useState(loadFilters)
  const change = (f) => {
    setFilters(f)
    try { localStorage.setItem(FILTERS_KEY, JSON.stringify(f)) } catch { /* filters just won't be remembered */ }
  }
  return [filters, change]
}

export const isFiltered = (f) => Object.keys(NO_FILTERS).some(k => f[k] !== 'all')

export function applyFilters(sessions, f) {
  const since = f.period === 'all' ? 0 : Date.now() - Number(f.period) * 86400000
  return sessions.filter(s =>
    new Date(s.created_at).getTime() >= since &&
    (f.level === 'all'    || (s.difficulty || 'Mid') === f.level) &&
    (f.type === 'all'     || (s.interview_type || 'full') === f.type) &&
    (f.language === 'all' || (s.language || 'en-US') === f.language))
}

function Chip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`text-xs px-3 py-1.5 rounded-xl font-semibold transition-all ${
        active
          ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
          : 'glass border border-slate-200 dark:border-slate-700/40 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
      }`}
    >
      {children}
    </button>
  )
}

export function FilterBar({ filters, onChange, children }) {
  const groups = [
    { key: 'period', label: 'Period', options: [['all', 'All time'], ['7', '7 days'], ['30', '30 days']] },
    { key: 'level', label: 'Level', options: LEVELS.map(l => [l, l]) },
    { key: 'type', label: 'Type', options: Object.entries(TYPE_LABELS) },
    { key: 'language', label: 'Language', options: LANGUAGES.map(c => [c, `${langInfo(c).flag} ${langInfo(c).label}`]) },
  ]

  return (
    <div className="glass border border-slate-200 dark:border-slate-700/40 rounded-2xl p-4 flex flex-wrap items-center gap-x-5 gap-y-3">
      {groups.map(g => (
        <div key={g.key} className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mr-1">{g.label}</span>
          {g.key !== 'period' && <Chip active={filters[g.key] === 'all'} onClick={() => onChange({ ...filters, [g.key]: 'all' })}>All</Chip>}
          {g.options.map(([value, text]) => (
            <Chip key={value} active={filters[g.key] === value} onClick={() => onChange({ ...filters, [g.key]: value })}>{text}</Chip>
          ))}
        </div>
      ))}
      {/* Anything extra for this page, e.g. a search box */}
      {children}
      {isFiltered(filters) && (
        <button onClick={() => onChange(NO_FILTERS)} className="ml-auto text-xs font-semibold text-slate-500 hover:text-red-500 transition-colors">
          Clear filters
        </button>
      )}
    </div>
  )
}
