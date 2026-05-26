import { useState, useRef } from 'react'
import { loadHistory, clearHistory, getProgressData } from '../utils/history'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

// ── Icons ──────────────────────────────────────────────────────────────────
function UploadIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
    </svg>
  )
}
const CheckIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
)
const XIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
)

// ── Background orbs ─────────────────────────────────────────────────────────
function BgOrbs() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      <div className="animate-orb absolute -top-32 -left-32 w-96 h-96 rounded-full bg-emerald-500/10 blur-3xl" />
      <div className="animate-orb-r absolute top-1/3 -right-24 w-80 h-80 rounded-full bg-cyan-500/8 blur-3xl" />
      <div className="animate-orb-slow absolute bottom-0 left-1/4 w-72 h-72 rounded-full bg-teal-500/8 blur-3xl" />
      {[...Array(12)].map((_, i) => (
        <div key={i} className="absolute rounded-full bg-emerald-400/20"
          style={{
            width: `${4 + (i % 4) * 3}px`, height: `${4 + (i % 4) * 3}px`,
            left: `${8 + i * 7.5}%`, top: `${10 + (i % 5) * 18}%`,
            animation: `float ${3.5 + i * 0.4}s ease-in-out ${i * 0.3}s infinite`,
          }} />
      ))}
    </div>
  )
}

// ── Job templates ───────────────────────────────────────────────────────────
const JOB_TEMPLATES = [
  { label: '💻 Software Engineer', jd: `We are hiring a Software Engineer to design and build scalable backend systems. You will work with distributed systems, RESTful APIs, and microservices. Required: 3+ years with Python or Go, experience with cloud platforms (AWS/GCP), SQL and NoSQL databases, CI/CD pipelines, and strong problem-solving skills. Nice to have: Kubernetes, gRPC, event-driven architectures.` },
  { label: '⚛️ Frontend Developer', jd: `We are looking for a Frontend Developer to build beautiful and performant user interfaces. You will work closely with designers and product managers. Required: 2+ years with React, TypeScript, CSS-in-JS, responsive design, and state management (Redux/Zustand). Nice to have: Next.js, accessibility (WCAG), performance optimization, and testing with Jest/Cypress.` },
  { label: '🔧 Full Stack Developer', jd: `Join our team as a Full Stack Developer building end-to-end features across our web application. Required: Proficiency in React and Node.js, experience with REST APIs, PostgreSQL, authentication patterns, and deployment. Nice to have: TypeScript, Docker, GraphQL, and experience with agile development teams.` },
  { label: '📊 Data Scientist', jd: `We are seeking a Data Scientist to build predictive models and derive insights from large datasets. Required: Strong Python skills, experience with pandas, scikit-learn, and SQL. Ability to communicate insights to non-technical stakeholders. Nice to have: Deep learning (PyTorch/TensorFlow), A/B testing, MLOps, and experience with cloud data platforms.` },
  { label: '📦 Product Manager', jd: `We are hiring a Product Manager to drive the vision and roadmap for our core product. You will work cross-functionally with engineering, design, and sales. Required: 3+ years in product management, strong analytical skills, experience with user research, data-driven decision making, and roadmap prioritization. Nice to have: Technical background, SQL, experience at a SaaS company.` },
  { label: '☁️ DevOps / SRE', jd: `Join us as a DevOps / Site Reliability Engineer to build and maintain our cloud infrastructure. Required: Experience with AWS or GCP, Kubernetes, Terraform, CI/CD (GitHub Actions / Jenkins), monitoring (Prometheus/Grafana), and incident response. Nice to have: FinOps, security automation, and on-call experience at scale.` },
  { label: '🤖 ML Engineer', jd: `We are looking for a Machine Learning Engineer to take models from research to production. Required: Python, PyTorch or TensorFlow, MLOps tools (MLflow, Kubeflow), REST API development, and experience deploying models at scale. Nice to have: ONNX, model quantization, LLM fine-tuning, and real-time inference systems.` },
  { label: '🎨 UX Designer', jd: `We are hiring a UX Designer to craft intuitive experiences for our product. Required: Portfolio demonstrating end-to-end design process, proficiency in Figma, experience with user research, usability testing, and interaction design. Nice to have: Design systems, motion design, accessibility expertise, and experience working with engineering teams.` },
]

// ── Question bank categories ────────────────────────────────────────────────
const CATEGORIES = [
  { emoji: '🌟', label: 'Behavioral / STAR',      value: 'Behavioral/STAR' },
  { emoji: '🏗️', label: 'System Design',           value: 'System Design' },
  { emoji: '⚛️', label: 'React / Frontend',         value: 'React/Frontend' },
  { emoji: '🔧', label: 'Node.js / Backend',        value: 'Node.js/Backend' },
  { emoji: '🐍', label: 'Python',                   value: 'Python' },
  { emoji: '🗄️', label: 'SQL / Databases',          value: 'SQL/Databases' },
  { emoji: '👥', label: 'Leadership',               value: 'Leadership' },
  { emoji: '📦', label: 'Product Thinking',         value: 'Product Thinking' },
  { emoji: '☁️', label: 'DevOps / Cloud',           value: 'DevOps/Cloud' },
  { emoji: '🤖', label: 'Machine Learning',         value: 'Machine Learning' },
  { emoji: '⚡', label: 'Data Structures & Algo',   value: 'Data Structures & Algorithms' },
  { emoji: '🗣️', label: 'Communication',             value: 'Communication' },
]

// ── Interview type options ───────────────────────────────────────────────────
const INTERVIEW_TYPES = [
  { value: 'full',       label: '🎯 Full Interview',      desc: '2 behavioral, 2 technical, 1 motivation' },
  { value: 'behavioral', label: '🌟 Behavioral Only',     desc: '5 STAR situational questions' },
  { value: 'technical',  label: '⚡ Technical Deep Dive', desc: '5 technical questions, progressively harder' },
  { value: 'screening',  label: '📞 Screening Call',      desc: '5 easy introductory questions' },
]

const DIFFICULTY_INFO  = { Junior: 'Foundational · Learning potential', Mid: 'Examples · Technical depth', Senior: 'System design · Leadership · Impact' }
const DIFFICULTY_EMOJI = { Junior: '🌱', Mid: '🚀', Senior: '🏆' }
const LANGUAGES = [
  { code: 'en-US', label: 'English',  flag: '🇬🇧' },
  { code: 'de-DE', label: 'Deutsch',  flag: '🇩🇪' },
  { code: 'fr-FR', label: 'Français', flag: '🇫🇷' },
]

// ── Score colour helper ─────────────────────────────────────────────────────
function scoreColor(s) {
  return s >= 8 ? '#10b981' : s >= 5 ? '#f59e0b' : '#ef4444'
}

// ── Progress Chart ──────────────────────────────────────────────────────────
function ProgressChart() {
  const data = getProgressData()
  if (data.length < 2) return null

  const avg = (data.reduce((s, d) => s + d.score, 0) / data.length).toFixed(1)

  return (
    <div className="mt-6 glass border border-slate-700/40 rounded-3xl p-6 animate-fade-up">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-white font-bold">📈 Your Progress</p>
          <p className="text-slate-500 text-xs">{data.length} sessions · avg {avg}/10</p>
        </div>
        <span className={`text-lg font-black px-3 py-1 rounded-full ${
          parseFloat(avg) >= 8 ? 'bg-emerald-500/20 text-emerald-400' :
          parseFloat(avg) >= 5 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'
        }`}>{avg}</span>
      </div>
      <ResponsiveContainer width="100%" height={120}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <XAxis dataKey="date" tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis domain={[0, 10]} tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} ticks={[0,5,10]} />
          <ReferenceLine y={7} stroke="rgba(16,185,129,0.2)" strokeDasharray="4 4" />
          <Tooltip
            contentStyle={{ backgroundColor: 'rgba(15,23,42,0.95)', border: '1px solid rgba(51,65,85,0.6)', borderRadius: 12 }}
            labelStyle={{ color: '#e2e8f0', fontWeight: 700, fontSize: 11 }}
            itemStyle={{ color: '#94a3b8', fontSize: 11 }}
            formatter={(v, _, props) => [
              `${v}/10 — ${props.payload?.role || ''}`,
              'Score',
            ]}
          />
          <Line
            type="monotone"
            dataKey="score"
            stroke="#10b981"
            strokeWidth={2.5}
            dot={(props) => {
              const { cx, cy, payload } = props
              return <circle key={props.key} cx={cx} cy={cy} r={4} fill={scoreColor(payload.score)} stroke="#020617" strokeWidth={2} />
            }}
            activeDot={{ r: 6, fill: '#10b981' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Past sessions ───────────────────────────────────────────────────────────
function ScoreBar({ score }) {
  const pct   = Math.round((score / 10) * 100)
  const color = score >= 8 ? 'bg-emerald-400' : score >= 5 ? 'bg-yellow-400' : 'bg-red-400'
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 bg-slate-700/60 rounded-full h-1.5">
        <div className={`${color} h-1.5 rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-bold text-slate-300 w-6 text-right">{score}</span>
    </div>
  )
}

function PastSessions() {
  const [open,     setOpen]     = useState(false)
  const [sessions, setSessions] = useState(() => loadHistory())
  if (!sessions.length) return null

  return (
    <div className="mt-4 animate-fade-up" style={{ animationDelay: '0.3s' }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between glass border border-slate-700/50 rounded-2xl px-4 py-3 text-sm text-slate-300 hover:border-emerald-500/30 transition-all"
      >
        <span className="flex items-center gap-2"><span className="text-emerald-400">🕐</span> Past Sessions ({sessions.length})</span>
        <span className="text-slate-500 text-xs">{open ? '▲ hide' : '▼ show'}</span>
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          {sessions.map(s => (
            <div key={s.id} className="glass border border-slate-700/40 rounded-2xl px-4 py-3">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <p className="text-slate-200 text-sm font-medium truncate">{s.role}</p>
                  <p className="text-slate-500 text-xs">{s.difficulty || 'Mid'} · {new Date(s.date || s.id).toLocaleDateString()}</p>
                </div>
                <span className={`text-xs font-bold px-2 py-1 rounded-full flex-shrink-0 ${
                  s.overall_score >= 8 ? 'bg-emerald-500/20 text-emerald-400' :
                  s.overall_score >= 5 ? 'bg-yellow-400/20 text-yellow-300' : 'bg-red-500/20 text-red-400'
                }`}>{parseFloat(s.overall_score).toFixed(1)}/10</span>
              </div>
              <ScoreBar score={s.overall_score} />
            </div>
          ))}
          <button onClick={() => { clearHistory(); setSessions([]) }}
            className="w-full text-slate-600 hover:text-red-400 text-xs py-2 transition">
            Clear history
          </button>
        </div>
      )}
    </div>
  )
}

// ── Main component ──────────────────────────────────────────────────────────
export default function Landing({ onStart }) {
  const [tab,          setTab]          = useState('job')      // 'job' | 'practice'
  const [jd,           setJd]           = useState('')
  const [companyName,  setCompanyName]  = useState('')
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState('')
  const [difficulty,   setDifficulty]   = useState('Mid')
  const [language,     setLanguage]     = useState('en-US')
  const [interviewType, setInterviewType] = useState('full')
  const [showTemplates, setShowTemplates] = useState(false)

  // CV state
  const [cvFile,     setCvFile]     = useState(null)
  const [cvText,     setCvText]     = useState(null)
  const [cvLoading,  setCvLoading]  = useState(false)
  const [cvError,    setCvError]    = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef(null)

  // Practice mode state
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [practiceLoading,  setPracticeLoading]  = useState(false)
  const [practiceError,    setPracticeError]    = useState('')

  const handleFileSelect = async (file) => {
    if (!file) return
    const ext = file.name.toLowerCase()
    if (!ext.endsWith('.pdf') && !ext.endsWith('.docx') && !ext.endsWith('.txt')) {
      setCvError('Please upload a PDF, DOCX, or TXT file.'); return
    }
    setCvFile(file); setCvText(null); setCvError(''); setCvLoading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`${BACKEND_URL}/extract-cv`, { method: 'POST', body: formData })
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.detail || 'Failed to read CV') }
      setCvText((await res.json()).cv_text)
    } catch (err) {
      setCvError(err.message || 'Failed to read CV.'); setCvFile(null)
    } finally {
      setCvLoading(false)
    }
  }

  const handleDrop = (e) => { e.preventDefault(); setIsDragging(false); handleFileSelect(e.dataTransfer.files[0]) }
  const clearCV = () => { setCvFile(null); setCvText(null); setCvError(''); if (fileInputRef.current) fileInputRef.current.value = '' }

  const handleStart = async () => {
    if (!jd.trim()) return
    setLoading(true); setError('')
    try {
      const res = await fetch(`${BACKEND_URL}/parse-jd`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jd_text: jd,
          cv_text: cvText || null,
          difficulty,
          company_name: companyName.trim() || null,
          interview_type: interviewType,
          language,
        }),
      })
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.detail || 'Failed to parse JD') }
      onStart({ ...(await res.json()), difficulty, language })
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
      onStart({ ...(await res.json()), difficulty, language })
    } catch (err) {
      setPracticeError(err.message || 'Something went wrong.')
    } finally {
      setPracticeLoading(false)
    }
  }

  const canStart    = jd.trim() && !loading && !cvLoading
  const canPractice = selectedCategory && !practiceLoading

  return (
    <div className="relative min-h-screen bg-slate-950 flex flex-col items-center justify-center px-3 sm:px-4 py-8 sm:py-12 overflow-hidden">
      <BgOrbs />

      <div className="relative z-10 w-full max-w-2xl">

        {/* ── Hero ── */}
        <div className="text-center mb-8 animate-fade-up">
          <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/25 rounded-full px-4 py-1.5 mb-5 backdrop-blur-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-emerald-400 text-sm font-medium tracking-wide">AI-Powered Voice Interview</span>
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black mb-3 tracking-tight leading-none">
            <span className="text-white">Mock</span><span className="gradient-text">Mate</span>
          </h1>
          <p className="text-slate-400 text-lg max-w-md mx-auto leading-relaxed">
            Practice interviews with a real-time AI voice coach.
          </p>
        </div>

{/* ── Language Selector ── */}
        <div className="mb-5 animate-fade-up" style={{ animationDelay: '0.03s' }}>
          <label className="block text-slate-300 text-sm font-semibold mb-2">Interview Language</label>
          <div className="grid grid-cols-3 gap-2">
            {LANGUAGES.map(lang => (
              <button
                key={lang.code}
                onClick={() => setLanguage(lang.code)}
                className={`py-3 rounded-2xl text-sm font-semibold transition-all duration-300 flex items-center justify-center gap-2 ${
                  language === lang.code
                    ? 'bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/30 scale-[1.03]'
                    : 'glass-light border border-slate-700/40 text-slate-400 hover:border-slate-600'
                }`}
              >
                <span className="text-lg">{lang.flag}</span>
                <span>{lang.label}</span>
              </button>
            ))}
          </div>
        </div>
        
        {/* ── Mode Tabs ── */}
        <div className="flex gap-2 mb-5 animate-fade-up" style={{ animationDelay: '0.05s' }}>
          {[
            { key: 'job',      label: '📋 Job Interview',  desc: 'From a job description' },
            { key: 'practice', label: '🎯 Practice Mode',  desc: 'By topic/skill' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 py-3 px-4 rounded-2xl text-sm font-semibold transition-all duration-300 ${
                tab === t.key
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25'
                  : 'glass border border-slate-700/50 text-slate-400 hover:border-slate-600'
              }`}
            >
              <div>{t.label}</div>
              <div className={`text-xs mt-0.5 font-normal ${tab === t.key ? 'text-emerald-100/70' : 'text-slate-600'}`}>{t.desc}</div>
            </button>
          ))}
        </div>

        {/* ── Main Card ── */}
        <div
          className="animate-fade-up glass border border-slate-700/40 rounded-3xl p-4 sm:p-7 shadow-2xl space-y-5"
          style={{ animationDelay: '0.1s', boxShadow: '0 0 60px rgba(16,185,129,0.06), 0 25px 50px rgba(0,0,0,0.5)' }}
        >

          {/* ── JOB INTERVIEW TAB ── */}
          {tab === 'job' && (
            <>
              {/* Templates */}
              <div>
                <button
                  onClick={() => setShowTemplates(o => !o)}
                  className="w-full flex items-center justify-between text-sm text-slate-400 hover:text-slate-300 transition py-1"
                >
                  <span className="flex items-center gap-2 font-medium"><span>📋</span> Use a job template</span>
                  <span className="text-xs text-slate-600">{showTemplates ? '▲ hide' : '▼ show'}</span>
                </button>
                {showTemplates && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {JOB_TEMPLATES.map(t => (
                      <button
                        key={t.label}
                        onClick={() => { setJd(t.jd); setShowTemplates(false) }}
                        className="text-left text-xs px-3 py-2.5 glass-light border border-slate-700/40 rounded-xl text-slate-400 hover:border-emerald-500/30 hover:text-slate-300 transition-all"
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* JD textarea */}
              <div>
                <label className="block text-slate-300 text-sm font-semibold mb-2">
                  Job Description <span className="text-emerald-400">*</span>
                </label>
                <textarea
                  className="w-full h-40 bg-slate-900/70 border border-slate-700/60 rounded-2xl p-4 text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/40 resize-none text-sm leading-relaxed transition-all"
                  placeholder="Paste the full job description here..."
                  value={jd}
                  onChange={(e) => setJd(e.target.value)}
                />
              </div>

              {/* Company name */}
              <div>
                <label className="block text-slate-300 text-sm font-semibold mb-2">
                  Company Name
                  <span className="ml-2 text-slate-500 font-normal text-xs">(optional — tailors questions to company culture)</span>
                </label>
                <input
                  type="text"
                  className="w-full bg-slate-900/70 border border-slate-700/60 rounded-2xl px-4 py-3 text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/40 text-sm transition-all"
                  placeholder="e.g. Google, Amazon, Stripe..."
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                />
              </div>

              {/* CV Upload */}
              <div>
                <label className="block text-slate-300 text-sm font-semibold mb-2">
                  Your CV / Resume
                  <span className="ml-2 text-slate-500 font-normal text-xs">(optional — personalises questions)</span>
                </label>
                {!cvFile ? (
                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center gap-2 cursor-pointer transition-all ${
                      isDragging ? 'border-emerald-400 bg-emerald-500/10 scale-[1.01]' : 'border-slate-700/60 hover:border-emerald-500/40 hover:bg-slate-800/40'
                    }`}
                  >
                    <div className={`transition-all ${isDragging ? 'text-emerald-400 scale-110' : 'text-slate-500'}`}><UploadIcon /></div>
                    <p className="text-slate-400 text-sm"><span className="text-emerald-400 font-semibold">Click to upload</span> or drag &amp; drop</p>
                    <p className="text-slate-600 text-xs">PDF · DOCX · TXT</p>
                    <input ref={fileInputRef} type="file" accept=".pdf,.docx,.txt" className="hidden" onChange={(e) => handleFileSelect(e.target.files[0])} />
                  </div>
                ) : (
                  <div className={`border rounded-2xl px-4 py-3 flex items-center gap-3 transition-all ${
                    cvLoading ? 'border-slate-600/50 bg-slate-800/30' : cvText ? 'border-emerald-500/30 bg-emerald-500/8' : 'border-red-500/30 bg-red-500/8'
                  }`}>
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                      cvLoading ? 'bg-slate-700' : cvText ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                    }`}>
                      {cvLoading
                        ? <svg className="animate-spin w-4 h-4 text-slate-300" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>
                        : cvText ? <CheckIcon /> : <XIcon />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-200 text-sm font-medium truncate">{cvFile.name}</p>
                      <p className={`text-xs mt-0.5 ${cvLoading ? 'text-slate-400' : cvText ? 'text-emerald-400' : 'text-red-400'}`}>
                        {cvLoading ? 'Extracting...' : cvText ? '✓ CV parsed — questions personalised' : 'Failed to read'}
                      </p>
                    </div>
                    <button onClick={clearCV} className="text-slate-600 hover:text-slate-300 transition"><XIcon /></button>
                  </div>
                )}
                {cvError && <p className="mt-2 text-red-400 text-xs">{cvError}</p>}
              </div>

              {/* Interview type */}
              <div>
                <label className="block text-slate-300 text-sm font-semibold mb-2">Interview Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {INTERVIEW_TYPES.map(t => (
                    <button
                      key={t.value}
                      onClick={() => setInterviewType(t.value)}
                      className={`py-3 px-3 rounded-2xl text-xs font-semibold text-left transition-all ${
                        interviewType === t.value
                          ? 'bg-gradient-to-br from-emerald-500/30 to-teal-500/20 border border-emerald-500/40 text-emerald-300'
                          : 'glass-light border border-slate-700/40 text-slate-400 hover:border-slate-600'
                      }`}
                    >
                      <div className="font-bold mb-0.5">{t.label}</div>
                      <div className={`text-xs font-normal ${interviewType === t.value ? 'text-emerald-400/70' : 'text-slate-600'}`}>{t.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Difficulty */}
              <div>
                <label className="block text-slate-300 text-sm font-semibold mb-2">Interview Level</label>
                <div className="grid grid-cols-3 gap-2">
                  {['Junior', 'Mid', 'Senior'].map(d => (
                    <button key={d} onClick={() => setDifficulty(d)}
                      className={`py-3 rounded-2xl text-sm font-semibold transition-all duration-300 flex flex-col items-center gap-1 ${
                        difficulty === d
                          ? 'bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/30 scale-[1.03]'
                          : 'glass-light border border-slate-700/40 text-slate-400 hover:border-slate-600'
                      }`}
                    >
                      <span className="text-lg">{DIFFICULTY_EMOJI[d]}</span>
                      <span>{d}</span>
                    </button>
                  ))}
                </div>
                <p className="text-slate-500 text-xs mt-1.5">{DIFFICULTY_INFO[difficulty]}</p>
              </div>

              {error && <div className="bg-red-500/10 border border-red-500/25 rounded-2xl px-4 py-3 text-red-400 text-sm">{error}</div>}

              <button
                onClick={handleStart}
                disabled={!canStart}
                className={`w-full font-bold py-4 rounded-2xl transition-all duration-300 flex items-center justify-center gap-2 text-base ${
                  canStart
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white shadow-lg shadow-emerald-500/30 hover:scale-[1.02] animate-glow-em'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                }`}
              >
                {loading ? (
                  <><svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>
                  {cvText ? 'Building personalised interview...' : 'Preparing interview...'}</>
                ) : (
                  <><span className="text-xl">🎙</span>
                  {cvText ? `Start Personalised ${difficulty} Interview` : `Start ${difficulty} Interview`}</>
                )}
              </button>
            </>
          )}

          {/* ── PRACTICE MODE TAB ── */}
          {tab === 'practice' && (
            <>
              <div>
                <p className="text-slate-300 text-sm font-semibold mb-3">Choose a Topic</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {CATEGORIES.map(c => (
                    <button
                      key={c.value}
                      onClick={() => setSelectedCategory(selectedCategory === c.value ? null : c.value)}
                      className={`py-3 px-3 rounded-2xl text-xs font-semibold text-left transition-all duration-200 ${
                        selectedCategory === c.value
                          ? 'bg-gradient-to-br from-emerald-500/30 to-teal-500/20 border border-emerald-500/40 text-emerald-300 scale-[1.03]'
                          : 'glass-light border border-slate-700/40 text-slate-400 hover:border-slate-600 hover:text-slate-300'
                      }`}
                    >
                      <span className="text-lg mr-1">{c.emoji}</span>
                      <span>{c.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Difficulty */}
              <div>
                <label className="block text-slate-300 text-sm font-semibold mb-2">Difficulty Level</label>
                <div className="grid grid-cols-3 gap-2">
                  {['Junior', 'Mid', 'Senior'].map(d => (
                    <button key={d} onClick={() => setDifficulty(d)}
                      className={`py-3 rounded-2xl text-sm font-semibold transition-all duration-300 flex flex-col items-center gap-1 ${
                        difficulty === d
                          ? 'bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/30 scale-[1.03]'
                          : 'glass-light border border-slate-700/40 text-slate-400 hover:border-slate-600'
                      }`}
                    >
                      <span className="text-lg">{DIFFICULTY_EMOJI[d]}</span>
                      <span>{d}</span>
                    </button>
                  ))}
                </div>
              </div>

              {practiceError && <div className="bg-red-500/10 border border-red-500/25 rounded-2xl px-4 py-3 text-red-400 text-sm">{practiceError}</div>}

              <button
                onClick={handlePracticeStart}
                disabled={!canPractice}
                className={`w-full font-bold py-4 rounded-2xl transition-all duration-300 flex items-center justify-center gap-2 text-base ${
                  canPractice
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white shadow-lg shadow-emerald-500/30 hover:scale-[1.02] animate-glow-em'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                }`}
              >
                {practiceLoading ? (
                  <><svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>Loading questions...</>
                ) : (
                  <><span className="text-xl">🎯</span>
                  {selectedCategory ? `Practice ${selectedCategory}` : 'Select a Topic First'}</>
                )}
              </button>
            </>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-slate-600 text-xs mt-5">
          Uses your browser's microphone &amp; built-in speech synthesis · Works best in Chrome
        </p>

        {/* Progress chart */}
        <ProgressChart />

        {/* Past sessions */}
        <PastSessions />
      </div>
    </div>
  )
}
