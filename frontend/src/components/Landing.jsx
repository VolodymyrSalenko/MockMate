import { useState, useEffect, useRef } from 'react'
import { loadHistory, clearHistory, getProgressData } from '../utils/history'
import { fetchCVProfile, uploadCVProfile } from '../utils/api'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { IconMic } from '../utils/icons'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

function IconUpload({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="17 8 12 3 7 8"/>
      <line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  )
}
function IconPaste({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
    </svg>
  )
}
function IconCheck({ className = 'w-3.5 h-3.5' }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <path d="M5 13l4 4L19 7"/>
    </svg>
  )
}
function IconX({ className = 'w-3.5 h-3.5' }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <path d="M6 18L18 6M6 6l12 12"/>
    </svg>
  )
}
function IconChevron({ className = 'w-3 h-3', open = false }) {
  return (
    <svg className={`${className} transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <path d="M6 9l6 6 6-6"/>
    </svg>
  )
}

function BgOrbs() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      <div className="animate-orb absolute -top-32 -left-32 w-96 h-96 rounded-full bg-emerald-500/8 blur-3xl" />
      <div className="animate-orb-r absolute top-1/3 -right-24 w-80 h-80 rounded-full bg-cyan-500/6 blur-3xl" />
      <div className="animate-orb-slow absolute bottom-0 left-1/4 w-72 h-72 rounded-full bg-teal-500/6 blur-3xl" />
    </div>
  )
}

const JOB_TEMPLATES = [
  { label: 'Software Engineer', jd: `We are hiring a Software Engineer to design and build scalable backend systems. You will work with distributed systems, RESTful APIs, and microservices. Required: 3+ years with Python or Go, experience with cloud platforms (AWS/GCP), SQL and NoSQL databases, CI/CD pipelines, and strong problem-solving skills. Nice to have: Kubernetes, gRPC, event-driven architectures.` },
  { label: 'Frontend Developer', jd: `We are looking for a Frontend Developer to build beautiful and performant user interfaces. You will work closely with designers and product managers. Required: 2+ years with React, TypeScript, CSS-in-JS, responsive design, and state management (Redux/Zustand). Nice to have: Next.js, accessibility (WCAG), performance optimization, and testing with Jest/Cypress.` },
  { label: 'Full Stack Developer', jd: `Join our team as a Full Stack Developer building end-to-end features across our web application. Required: Proficiency in React and Node.js, experience with REST APIs, PostgreSQL, authentication patterns, and deployment. Nice to have: TypeScript, Docker, GraphQL, and experience with agile development teams.` },
  { label: 'Data Scientist', jd: `We are seeking a Data Scientist to build predictive models and derive insights from large datasets. Required: Strong Python skills, experience with pandas, scikit-learn, and SQL. Ability to communicate insights to non-technical stakeholders. Nice to have: Deep learning (PyTorch/TensorFlow), A/B testing, MLOps, and experience with cloud data platforms.` },
  { label: 'Product Manager', jd: `We are hiring a Product Manager to drive the vision and roadmap for our core product. You will work cross-functionally with engineering, design, and sales. Required: 3+ years in product management, strong analytical skills, experience with user research, data-driven decision making, and roadmap prioritization. Nice to have: Technical background, SQL, experience at a SaaS company.` },
  { label: 'DevOps / SRE', jd: `Join us as a DevOps / Site Reliability Engineer to build and maintain our cloud infrastructure. Required: Experience with AWS or GCP, Kubernetes, Terraform, CI/CD (GitHub Actions / Jenkins), monitoring (Prometheus/Grafana), and incident response. Nice to have: FinOps, security automation, and on-call experience at scale.` },
  { label: 'ML Engineer', jd: `We are looking for a Machine Learning Engineer to take models from research to production. Required: Python, PyTorch or TensorFlow, MLOps tools (MLflow, Kubeflow), REST API development, and experience deploying models at scale. Nice to have: ONNX, model quantization, LLM fine-tuning, and real-time inference systems.` },
  { label: 'UX Designer', jd: `We are hiring a UX Designer to craft intuitive experiences for our product. Required: Portfolio demonstrating end-to-end design process, proficiency in Figma, experience with user research, usability testing, and interaction design. Nice to have: Design systems, motion design, accessibility expertise, and experience working with engineering teams.` },
]

const CATEGORIES = [
  { label: 'Behavioral / STAR',  value: 'Behavioral/STAR' },
  { label: 'System Design',      value: 'System Design' },
  { label: 'React / Frontend',   value: 'React/Frontend' },
  { label: 'Node.js / Backend',  value: 'Node.js/Backend' },
  { label: 'Python',             value: 'Python' },
  { label: 'SQL / Databases',    value: 'SQL/Databases' },
  { label: 'Leadership',         value: 'Leadership' },
  { label: 'Product Thinking',   value: 'Product Thinking' },
  { label: 'DevOps / Cloud',     value: 'DevOps/Cloud' },
  { label: 'Machine Learning',   value: 'Machine Learning' },
  { label: 'DS & Algorithms',    value: 'Data Structures & Algorithms' },
  { label: 'Communication',      value: 'Communication' },
]

const INTERVIEW_TYPES = [
  { value: 'full',       label: 'Full Interview',  desc: '2 behavioral, 2 technical, 1 motivation' },
  { value: 'behavioral', label: 'Behavioral',      desc: '5 STAR situational questions' },
  { value: 'technical',  label: 'Technical',       desc: '5 technical, progressively harder' },
  { value: 'screening',  label: 'Screening Call',  desc: '5 easy intro questions' },
]

const DIFFICULTY_INFO = {
  Junior: 'Foundational · Learning potential',
  Mid: 'Examples · Technical depth',
  Senior: 'System design · Leadership · Impact',
}

const LANGUAGES = [
  { code: 'en-US', label: 'English',  flag: '🇬🇧' },
  { code: 'de-DE', label: 'Deutsch',  flag: '🇩🇪' },
  { code: 'fr-FR', label: 'Français', flag: '🇫🇷' },
]

function scoreColor(s) {
  return s >= 8 ? '#10b981' : s >= 5 ? '#f59e0b' : '#ef4444'
}

function ProgressChart() {
  const data = getProgressData()
  if (data.length < 2) return null
  const avg = (data.reduce((s, d) => s + d.score, 0) / data.length).toFixed(1)
  return (
    <div className="mt-5 glass border border-slate-200 dark:border-slate-700/40 rounded-2xl p-5 animate-fade-up">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-slate-700 dark:text-slate-200 text-sm font-semibold">Progress</p>
          <p className="text-slate-500 dark:text-slate-500 text-xs">{data.length} sessions · avg {avg}/10</p>
        </div>
        <span className={`text-sm font-black px-2.5 py-0.5 rounded-lg ${
          parseFloat(avg) >= 8 ? 'bg-emerald-500/15 text-emerald-400' :
          parseFloat(avg) >= 5 ? 'bg-yellow-500/15 text-yellow-400' : 'bg-red-500/15 text-red-400'
        }`}>{avg}</span>
      </div>
      <ResponsiveContainer width="100%" height={100}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis domain={[0, 10]} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} ticks={[0, 5, 10]} />
          <ReferenceLine y={7} stroke="rgba(16,185,129,0.2)" strokeDasharray="4 4" />
          <Tooltip
            contentStyle={{ backgroundColor: 'rgba(15,23,42,0.95)', border: '1px solid rgba(51,65,85,0.5)', borderRadius: 10 }}
            labelStyle={{ color: '#e2e8f0', fontWeight: 600, fontSize: 11 }}
            itemStyle={{ color: '#94a3b8', fontSize: 11 }}
            formatter={(v, _, props) => [`${v}/10 — ${props.payload?.role || ''}`, 'Score']}
          />
          <Line
            type="monotone" dataKey="score" stroke="#10b981" strokeWidth={2}
            dot={(props) => {
              const { cx, cy, payload } = props
              return <circle key={props.key} cx={cx} cy={cy} r={3.5} fill={scoreColor(payload.score)} stroke="#020617" strokeWidth={2} />
            }}
            activeDot={{ r: 5, fill: '#10b981' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function PastSessions() {
  const [open, setOpen] = useState(false)
  const [sessions, setSessions] = useState(() => loadHistory())
  if (!sessions.length) return null
  return (
    <div className="mt-3 animate-fade-up" style={{ animationDelay: '0.3s' }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between glass border border-slate-200 dark:border-slate-700/50 rounded-xl px-4 py-2.5 text-sm text-slate-600 dark:text-slate-400 hover:border-emerald-500/25 transition-all"
      >
        <span>Past Sessions ({sessions.length})</span>
        <IconChevron className="w-3.5 h-3.5" open={open} />
      </button>
      {open && (
        <div className="mt-2 space-y-1.5">
          {sessions.map(s => (
            <div key={s.id} className="glass border border-slate-200 dark:border-slate-700/40 rounded-xl px-4 py-2.5 flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-slate-700 dark:text-slate-200 text-sm truncate">{s.role}</p>
                <p className="text-slate-500 dark:text-slate-500 text-xs">{s.difficulty || 'Mid'} · {new Date(s.date || s.id).toLocaleDateString()}</p>
              </div>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-lg flex-shrink-0 ${
                s.overall_score >= 8 ? 'bg-emerald-500/15 text-emerald-400' :
                s.overall_score >= 5 ? 'bg-yellow-400/15 text-yellow-400' : 'bg-red-500/15 text-red-400'
              }`}>{parseFloat(s.overall_score).toFixed(1)}</span>
            </div>
          ))}
          <button onClick={() => { clearHistory(); setSessions([]) }}
            className="w-full text-slate-500 hover:text-red-400 text-xs py-2 transition text-center">
            Clear history
          </button>
        </div>
      )}
    </div>
  )
}

// Shared pill button style
function pillCls(active) {
  return `flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${
    active
      ? 'bg-emerald-500/15 border border-emerald-500/35 text-emerald-400'
      : 'bg-slate-100/80 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/40 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
  }`
}

export default function Landing({ onStart }) {
  const [tab,           setTab]           = useState('job')
  const [jd,            setJd]            = useState('')
  const [jdInputMode,   setJdInputMode]   = useState(null)   // 'paste' | 'upload' | null
  const [companyName,   setCompanyName]   = useState('')
  const [loading,       setLoading]       = useState(false)
  const [error,         setError]         = useState('')
  const [difficulty,    setDifficulty]    = useState('Mid')
  const [language,      setLanguage]      = useState('en-US')
  const [interviewType, setInterviewType] = useState('full')
  const [showTemplates, setShowTemplates] = useState(false)

  const [cvFile,      setCvFile]      = useState(null)
  const [cvText,      setCvText]      = useState(null)
  const [cvLoading,   setCvLoading]   = useState(false)
  const [cvError,     setCvError]     = useState('')
  const [cvFromSaved, setCvFromSaved] = useState(false)
  const [isDragging,  setIsDragging]  = useState(false)
  const fileInputRef    = useRef(null)
  const jdFileInputRef  = useRef(null)

  const [jdFile,    setJdFile]    = useState(null)
  const [jdLoading, setJdLoading] = useState(false)
  const [jdError,   setJdError]   = useState('')

  const [selectedCategory, setSelectedCategory] = useState(null)
  const [practiceLoading,  setPracticeLoading]  = useState(false)
  const [practiceError,    setPracticeError]    = useState('')

  useEffect(() => {
    fetchCVProfile().then(data => {
      if (data?.raw_text) {
        setCvFile({ name: data.filename || 'Saved CV' })
        setCvText(data.raw_text)
        setCvFromSaved(true)
      }
    }).catch(() => {})
  }, [])

  const handleFileSelect = async (file) => {
    if (!file) return
    const ext = file.name.toLowerCase()
    if (!ext.endsWith('.pdf') && !ext.endsWith('.docx') && !ext.endsWith('.txt')) {
      setCvError('Please upload a PDF, DOCX, or TXT file.'); return
    }
    setCvFile(file); setCvText(null); setCvError(''); setCvFromSaved(false); setCvLoading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`${BACKEND_URL}/extract-cv`, { method: 'POST', body: formData })
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.detail || 'Failed to read CV') }
      setCvText((await res.json()).cv_text)
      uploadCVProfile(file).catch(() => {})
    } catch (err) {
      setCvError(err.message || 'Failed to read CV.'); setCvFile(null)
    } finally {
      setCvLoading(false)
    }
  }

  const handleDrop = (e) => { e.preventDefault(); setIsDragging(false); handleFileSelect(e.dataTransfer.files[0]) }
  const clearCV = () => { setCvFile(null); setCvText(null); setCvError(''); setCvFromSaved(false); if (fileInputRef.current) fileInputRef.current.value = '' }

  const handleJdFileSelect = async (file) => {
    if (!file) return
    const ext = file.name.toLowerCase()
    if (!ext.endsWith('.pdf') && !ext.endsWith('.docx') && !ext.endsWith('.txt')) {
      setJdError('Please upload a PDF, DOCX, or TXT file.'); return
    }
    setJdFile(file); setJdError(''); setJdLoading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`${BACKEND_URL}/extract-text`, { method: 'POST', body: formData })
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.detail || 'Failed to read file') }
      setJd((await res.json()).text || '')
      setJdInputMode(null)
    } catch (err) {
      setJdError(err.message || 'Failed to read file.'); setJdFile(null)
    } finally {
      setJdLoading(false)
    }
  }

  const clearJD = () => {
    setJd(''); setJdFile(null); setJdError(''); setJdInputMode(null)
    if (jdFileInputRef.current) jdFileInputRef.current.value = ''
  }

  const handleStart = async () => {
    if (!jd.trim()) return
    setLoading(true); setError('')
    try {
      const res = await fetch(`${BACKEND_URL}/parse-jd`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jd_text: jd, cv_text: cvText || null, difficulty, company_name: companyName.trim() || null, interview_type: interviewType, language }),
      })
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.detail || 'Failed to parse JD') }
      onStart({ ...(await res.json()), difficulty, interview_type: interviewType, language })
    } catch (err) {
      setError(err.message || 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  const handlePracticeStart = async () => {
    if (!selectedCategory) return
    setPracticeLoading(true); setPracticeError('')
    try {
      const res = await fetch(`${BACKEND_URL}/question-bank`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: selectedCategory, difficulty, language }),
      })
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.detail || 'Failed to load questions') }
      onStart({ ...(await res.json()), difficulty, interview_type: 'practice', language })
    } catch (err) {
      setPracticeError(err.message || 'Something went wrong.')
    } finally {
      setPracticeLoading(false)
    }
  }

  const canStart    = jd.trim() && !loading && !cvLoading && !jdLoading
  const canPractice = selectedCategory && !practiceLoading
  // JD is "committed" (show badge) when it has content and no input mode is open
  const jdCommitted = Boolean(jd.trim() && jdInputMode === null)

  const Spinner = () => (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
    </svg>
  )

  // Shared level + language row used in both tabs
  const SettingsRow = () => (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="block text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wide mb-1.5">Level</label>
        <div className="flex gap-1">
          {['Junior', 'Mid', 'Senior'].map(d => (
            <button key={d} onClick={() => setDifficulty(d)} className={pillCls(difficulty === d)}>{d}</button>
          ))}
        </div>
        <p className="text-slate-400 dark:text-slate-600 text-xs mt-1">{DIFFICULTY_INFO[difficulty]}</p>
      </div>
      <div>
        <label className="block text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wide mb-1.5">Language</label>
        <div className="flex gap-1">
          {LANGUAGES.map(lang => (
            <button key={lang.code} onClick={() => setLanguage(lang.code)} title={lang.label}
              className={pillCls(language === lang.code) + ' text-base'}
            >
              {lang.flag}
            </button>
          ))}
        </div>
      </div>
    </div>
  )

  return (
    <div className="relative min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center px-3 sm:px-4 py-10 overflow-hidden">
      <BgOrbs />

      <div className="relative z-10 w-full max-w-xl">

        {/* Heading */}
        <div className="mb-6 animate-fade-up">
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">Practice Interview</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Configure your session and start when ready.</p>
        </div>

        {/* Mode tabs — segmented control */}
        <div className="flex gap-1 mb-5 p-1 bg-slate-100/80 dark:bg-slate-800/60 rounded-xl animate-fade-up" style={{ animationDelay: '0.04s' }}>
          {[
            { key: 'job',      label: 'Job Interview' },
            { key: 'practice', label: 'Practice Mode'  },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                tab === t.key
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Main card */}
        <div
          className="animate-fade-up glass border border-slate-200 dark:border-slate-700/40 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xl"
          style={{ animationDelay: '0.08s' }}
        >

          {/* ── JOB INTERVIEW TAB ── */}
          {tab === 'job' && (
            <>
              {/* Company */}
              <div>
                <label className="block text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wide mb-1.5">
                  Company <span className="font-normal normal-case text-slate-400 dark:text-slate-600">— optional</span>
                </label>
                <input
                  type="text"
                  className="w-full bg-slate-100/80 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/50 rounded-xl px-3 py-2.5 text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/30 text-sm transition-all"
                  placeholder="e.g. Google, Stripe, Amazon…"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                />
              </div>

              {/* Job Description */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wide">
                    Job Description <span className="text-emerald-500">*</span>
                  </label>
                  {!jdCommitted && (
                    <button
                      onClick={() => setShowTemplates(o => !o)}
                      className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-500 hover:text-emerald-400 transition-colors"
                    >
                      Use template <IconChevron className="w-3 h-3" open={showTemplates} />
                    </button>
                  )}
                </div>

                {/* Templates grid */}
                {showTemplates && !jdCommitted && (
                  <div className="mb-2 grid grid-cols-2 gap-1">
                    {JOB_TEMPLATES.map(t => (
                      <button
                        key={t.label}
                        onClick={() => { setJd(t.jd); setJdInputMode(null); setShowTemplates(false) }}
                        className="text-left text-xs px-2.5 py-2 bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/40 rounded-lg text-slate-600 dark:text-slate-400 hover:border-emerald-500/25 hover:text-slate-700 dark:hover:text-slate-300 transition-all"
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                )}

                {jdCommitted ? (
                  /* JD loaded badge */
                  <div className="flex items-center gap-2.5 px-3 py-2.5 border border-emerald-500/30 bg-emerald-500/8 rounded-xl">
                    <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 flex-shrink-0">
                      <IconCheck />
                    </div>
                    <span className="text-sm text-slate-700 dark:text-slate-200 flex-1 truncate">
                      {jdFile ? jdFile.name : `${jd.trim().split(/\s+/).length} words pasted`}
                    </span>
                    <button onClick={clearJD} className="text-slate-400 hover:text-red-400 transition-colors">
                      <IconX />
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Toggle buttons */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => setJdInputMode(m => m === 'paste' ? null : 'paste')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                          jdInputMode === 'paste'
                            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                            : 'bg-slate-100/80 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/50 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
                        }`}
                      >
                        <IconPaste /> Paste text
                      </button>
                      <button
                        onClick={() => setJdInputMode(m => m === 'upload' ? null : 'upload')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                          jdInputMode === 'upload'
                            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                            : 'bg-slate-100/80 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/50 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
                        }`}
                      >
                        <IconUpload /> Upload file
                      </button>
                    </div>

                    {/* Paste textarea */}
                    {jdInputMode === 'paste' && (
                      <textarea
                        className="mt-2 w-full h-36 bg-slate-100/80 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/50 rounded-xl p-3 text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/30 resize-none text-sm leading-relaxed transition-all"
                        placeholder="Paste the job description here…"
                        value={jd}
                        onChange={(e) => setJd(e.target.value)}
                        onBlur={() => { if (jd.trim()) setJdInputMode(null) }}
                        autoFocus
                      />
                    )}

                    {/* Upload zone */}
                    {jdInputMode === 'upload' && (
                      <div className="mt-2">
                        {jdLoading ? (
                          <div className="flex items-center gap-3 px-3 py-3 border border-slate-200 dark:border-slate-700/50 bg-slate-100/60 dark:bg-slate-800/30 rounded-xl">
                            <Spinner />
                            <span className="text-sm text-slate-500 truncate flex-1">{jdFile?.name}</span>
                            <span className="text-xs text-slate-400">Extracting…</span>
                          </div>
                        ) : (
                          <div
                            onClick={() => jdFileInputRef.current?.click()}
                            className="border-2 border-dashed rounded-xl p-5 flex flex-col items-center gap-2 cursor-pointer transition-all border-slate-200 dark:border-slate-700/50 hover:border-emerald-500/30 hover:bg-slate-100/50 dark:hover:bg-slate-800/30"
                          >
                            <IconUpload className="w-5 h-5 text-slate-400" />
                            <p className="text-sm text-slate-500 dark:text-slate-400">Click to upload</p>
                            <p className="text-xs text-slate-400 dark:text-slate-600">PDF · DOCX · TXT</p>
                            <input ref={jdFileInputRef} type="file" accept=".pdf,.docx,.txt" className="hidden"
                              onChange={(e) => handleJdFileSelect(e.target.files[0])} />
                          </div>
                        )}
                        {jdError && <p className="mt-1.5 text-red-400 text-xs">{jdError}</p>}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* CV Upload */}
              <div>
                <label className="block text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wide mb-1.5">
                  CV / Resume <span className="font-normal normal-case text-slate-400 dark:text-slate-600">— optional, personalises questions</span>
                </label>
                {!cvFile ? (
                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl px-4 py-3 flex items-center gap-3 cursor-pointer transition-all ${
                      isDragging ? 'border-emerald-400 bg-emerald-500/8' : 'border-slate-200 dark:border-slate-700/50 hover:border-emerald-500/25 hover:bg-slate-100/50 dark:hover:bg-slate-800/30'
                    }`}
                  >
                    <IconUpload className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <span className="text-sm text-slate-500 dark:text-slate-400 flex-1">Upload CV</span>
                    <span className="text-xs text-slate-400 dark:text-slate-600">PDF · DOCX · TXT</span>
                    <input ref={fileInputRef} type="file" accept=".pdf,.docx,.txt" className="hidden" onChange={(e) => handleFileSelect(e.target.files[0])} />
                  </div>
                ) : (
                  <div className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all ${
                    cvLoading ? 'border-slate-200 dark:border-slate-700/50 bg-slate-100/50 dark:bg-slate-800/30' :
                    cvText ? 'border-emerald-500/30 bg-emerald-500/8' : 'border-red-500/30 bg-red-500/8'
                  }`}>
                    {cvLoading ? <Spinner /> : cvText
                      ? <div className="text-emerald-400 flex-shrink-0"><IconCheck /></div>
                      : <div className="text-red-400 flex-shrink-0"><IconX /></div>
                    }
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-700 dark:text-slate-200 truncate">{cvFile.name}</p>
                      <p className={`text-xs ${cvLoading ? 'text-slate-500' : cvText ? 'text-emerald-400' : 'text-red-400'}`}>
                        {cvLoading ? 'Extracting…' : cvText ? (cvFromSaved ? 'Saved CV loaded' : 'CV parsed') : 'Failed to read'}
                      </p>
                    </div>
                    <button onClick={clearCV} className="text-slate-400 hover:text-red-400 transition-colors flex-shrink-0"><IconX /></button>
                  </div>
                )}
                {cvError && <p className="mt-1.5 text-red-400 text-xs">{cvError}</p>}
              </div>

              {/* Interview type */}
              <div>
                <label className="block text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wide mb-1.5">Interview Type</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {INTERVIEW_TYPES.map(t => (
                    <button
                      key={t.value}
                      onClick={() => setInterviewType(t.value)}
                      title={t.desc}
                      className={`py-2 px-3 rounded-xl text-sm font-medium text-center transition-all ${
                        interviewType === t.value
                          ? 'bg-emerald-500/15 border border-emerald-500/35 text-emerald-400'
                          : 'bg-slate-100/80 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/40 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <SettingsRow />

              {error && <div className="bg-red-500/8 border border-red-500/20 rounded-xl px-3 py-2.5 text-red-400 text-sm">{error}</div>}

              <button
                onClick={handleStart}
                disabled={!canStart}
                className={`w-full font-bold py-3.5 rounded-xl transition-all duration-300 flex items-center justify-center gap-2 text-sm ${
                  canStart
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white shadow-md shadow-emerald-500/25'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-500 cursor-not-allowed border border-slate-200 dark:border-slate-700/40'
                }`}
              >
                {loading
                  ? <><Spinner />{cvText ? 'Building personalised interview…' : 'Preparing interview…'}</>
                  : <><IconMic className="w-4 h-4" />{cvText ? `Start ${difficulty} Interview — Personalised` : `Start ${difficulty} Interview`}</>
                }
              </button>
            </>
          )}

          {/* ── PRACTICE MODE TAB ── */}
          {tab === 'practice' && (
            <>
              <div>
                <label className="block text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wide mb-2">Topic</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {CATEGORIES.map(c => (
                    <button
                      key={c.value}
                      onClick={() => setSelectedCategory(selectedCategory === c.value ? null : c.value)}
                      className={`py-2 px-3 rounded-xl text-xs font-medium text-center transition-all ${
                        selectedCategory === c.value
                          ? 'bg-emerald-500/15 border border-emerald-500/35 text-emerald-400'
                          : 'bg-slate-100/80 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/40 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              <SettingsRow />

              {practiceError && <div className="bg-red-500/8 border border-red-500/20 rounded-xl px-3 py-2.5 text-red-400 text-sm">{practiceError}</div>}

              <button
                onClick={handlePracticeStart}
                disabled={!canPractice}
                className={`w-full font-bold py-3.5 rounded-xl transition-all duration-300 flex items-center justify-center gap-2 text-sm ${
                  canPractice
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white shadow-md shadow-emerald-500/25'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-500 cursor-not-allowed border border-slate-200 dark:border-slate-700/40'
                }`}
              >
                {practiceLoading
                  ? <><Spinner />Loading…</>
                  : <><IconMic className="w-4 h-4" />{selectedCategory ? `Practice ${selectedCategory}` : 'Select a topic first'}</>
                }
              </button>
            </>
          )}
        </div>

        <p className="text-center text-slate-500 dark:text-slate-500 text-xs mt-4">
          Uses your browser's microphone · Works best in Chrome
        </p>

        <ProgressChart />
        <PastSessions />
      </div>
    </div>
  )
}
