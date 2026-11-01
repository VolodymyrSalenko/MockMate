import { useState, useEffect, useRef } from 'react'
import { fetchCVProfile, uploadCVProfile, fetchJobDescriptions, deleteJobDescription } from '../utils/api'
import { formatDate } from '../utils/scoring'
import { getStoredToken } from '../context/AuthContext'
import { IconMic } from '../utils/icons'
import { INTERVIEWERS, DEFAULT_INTERVIEWER, getInterviewer } from '../utils/interviewers'
import { openSignup, openUpgrade } from '../utils/plan'

// How many interviews are left, and what to do when there are none
function UsageNote({ usage }) {
  if (!usage) return null
  const { plan, remaining, limit, resets_at } = usage
  const renews = resets_at ? new Date(resets_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : null
  if (plan === 'unverified') return (
    <p className="text-center text-sm text-amber-600 dark:text-amber-400">Confirm your email address to start interviews: we sent you a link.</p>
  )
  if (remaining > 0) return (
    <p className="text-center text-xs text-slate-500">
      {plan === 'guest'
        ? 'Your free trial interview · English, with your browser\'s voice'
        : `${remaining} of ${limit} interviews left this month${renews ? ` · renews ${renews}` : ''}`}
      {plan !== 'pro' && (
        <> · <button onClick={plan === 'guest' ? openSignup : openUpgrade} className="font-semibold text-emerald-600 dark:text-emerald-400 hover:underline">
          {plan === 'guest' ? 'Create a free account for 3 a month' : 'Pro: 30 a month'}
        </button></>
      )}
    </p>
  )
  const next = plan === 'guest'
    ? { text: 'You have used your trial interview. Create a free account to get 3 interviews every month.', label: 'Create free account', onClick: openSignup }
    : plan === 'free'
      ? { text: `You have used your 3 free interviews this month${renews ? ` (they renew ${renews})` : ''}. Pro gives you 30 a month.`, label: 'See Pro', onClick: openUpgrade }
      : { text: `You have used your 30 interviews this month${renews ? `. They renew ${renews}` : ''}.`, label: null }
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-amber-700 dark:text-amber-300">{next.text}</p>
      {next.label && (
        <button onClick={next.onClick} className="text-xs font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-500 px-3 py-2 rounded-xl hover:scale-105 transition-all">
          {next.label}
        </button>
      )}
    </div>
  )
}

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
function IconLink({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
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

const INTERVIEW_TYPES = [
  { value: 'full',       label: 'Full Interview',    desc: 'Like a real interview: about you, STAR, technical, motivation' },
  { value: 'behavioral', label: 'Behavioral (STAR)', desc: '"Tell me about a time when…" questions' },
  { value: 'technical',  label: 'Technical',         desc: 'Skills from the job ad, progressively harder' },
]

const QUESTION_COUNTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
const MINUTES_PER_QUESTION = 2
const QUESTION_COUNT_KEY = 'mockmate_question_count'

const INTERVIEWER_KEY = 'mockmate_interviewer'

// Remember the last chosen number of questions so it survives navigation and re-login
function loadQuestionCount() {
  try {
    const saved = Number(localStorage.getItem(QUESTION_COUNT_KEY))
    return QUESTION_COUNTS.includes(saved) ? saved : 5
  } catch {
    return 5
  }
}

function loadInterviewer() {
  try {
    return getInterviewer(localStorage.getItem(INTERVIEWER_KEY)).id
  } catch {
    return DEFAULT_INTERVIEWER
  }
}

// Round portrait for the interviewer picker; falls back to the initial
function InterviewerFace({ interviewer }) {
  const [failed, setFailed] = useState(false)
  return (
    <span
      className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0 font-black text-white text-sm"
      style={{ background: interviewer.background }}
    >
      {failed ? interviewer.name[0] : (
        <img src={interviewer.photo} alt="" className="w-full h-full object-cover" onError={() => setFailed(true)} />
      )}
    </span>
  )
}

const DIFFICULTY_INFO = {
  Junior: 'Foundational · Learning potential',
  Mid: 'Examples · Technical depth',
  Senior: 'System design · Leadership · Impact',
}

const LANGUAGES = [
  { code: 'en-US', label: 'English',  short: 'EN' },
  { code: 'de-DE', label: 'Deutsch',  short: 'DE' },
  { code: 'fr-FR', label: 'Français', short: 'FR' },
]

// Shared pill button style
function pillCls(active) {
  return `flex-1 py-2 lg:py-2.5 rounded-xl text-xs lg:text-sm font-semibold transition-all ${
    active
      ? 'bg-emerald-500/15 border border-emerald-500/35 text-emerald-400'
      : 'bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/40 text-slate-700 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
  }`
}

export default function Landing({ onStart, user, onUpgrade, onLimit }) {
  const [jd,            setJd]            = useState('')
  const [jdInputMode,   setJdInputMode]   = useState(null)   // 'paste' | 'upload' | 'link' | null
  const [companyName,   setCompanyName]   = useState('')
  const [loading,       setLoading]       = useState(false)
  const [error,         setError]         = useState('')
  const [difficulty,    setDifficulty]    = useState('Junior')
  const [language,      setLanguage]      = useState('en-US')
  const [interviewType, setInterviewType] = useState('full')
  const [questionCount, setQuestionCount] = useState(loadQuestionCount)
  const [interviewer,   setInterviewer]   = useState(loadInterviewer)
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
  const [jdUrl,     setJdUrl]     = useState('')
  const [jdSource,  setJdSource]  = useState(null)   // website the JD was read from

  // Job ads used before, to practise the same one again
  const [recentJds,  setRecentJds]  = useState([])
  const [showRecent, setShowRecent] = useState(false)
  const [jdRecent,   setJdRecent]   = useState(null)   // the saved ad currently loaded
  useEffect(() => { fetchJobDescriptions().then(setRecentJds) }, [])

  const pickRecent = (item) => {
    setJd(item.jd_text); setJdFile(null); setJdSource(null); setJdError(''); setJdInputMode(null)
    if (item.company_name && !companyName.trim()) setCompanyName(item.company_name)
    setJdRecent(item); setShowRecent(false); setShowTemplates(false)
  }
  const removeRecent = async (item) => {
    if (await deleteJobDescription(item.id)) setRecentJds(list => list.filter(x => x.id !== item.id))
  }


  // Restore state from URL params on mount (shared links)
  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    const urlType = p.get('type')
    if (urlType && INTERVIEW_TYPES.find(t => t.value === urlType)) setInterviewType(urlType)
    const urlDiff = p.get('difficulty')
    if (['Junior', 'Mid', 'Senior'].includes(urlDiff)) setDifficulty(urlDiff)
    const urlCount = Number(p.get('questions'))
    if (QUESTION_COUNTS.includes(urlCount)) setQuestionCount(urlCount)
    const urlLang = p.get('lang')
    if (LANGUAGES.find(l => l.code === urlLang)) setLanguage(urlLang)
    const urlCompany = p.get('company')
    if (urlCompany) setCompanyName(decodeURIComponent(urlCompany))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync shareable state to URL
  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    p.set('page', 'landing')
    p.delete('mode'); p.delete('topic')   // left over from the removed practice mode
    p.set('type', interviewType)
    if (companyName.trim()) p.set('company', companyName.trim()); else p.delete('company')
    p.set('difficulty', difficulty)
    if (questionCount !== 5) p.set('questions', questionCount); else p.delete('questions')
    if (language !== 'en-US') p.set('lang', language); else p.delete('lang')
    window.history.replaceState({}, '', `?${p.toString()}`)
  }, [interviewType, difficulty, language, companyName, questionCount]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    try { localStorage.setItem(QUESTION_COUNT_KEY, String(questionCount)) } catch {}
  }, [questionCount])

  useEffect(() => {
    try { localStorage.setItem(INTERVIEWER_KEY, interviewer) } catch {}
  }, [interviewer])

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
    setJdFile(file); setJdSource(null); setJdError(''); setJdLoading(true)
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

  const handleJdUrl = async () => {
    if (!jdUrl.trim() || jdLoading) return
    setJdError(''); setJdLoading(true)
    try {
      const res = await fetch(`${BACKEND_URL}/extract-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getStoredToken()}` },
        body: JSON.stringify({ url: jdUrl.trim() }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        if (res.status === 429) throw new Error("You've tried a lot of links in a short time. Please wait a minute and try again.")
        throw new Error(typeof d.detail === 'string' ? d.detail : "Sorry, we couldn't read this link. No problem: just open the job ad in your browser, copy the text and paste it here.")
      }
      const data = await res.json()
      setJd(data.text || ''); setJdFile(null); setJdSource(data.source || null)
      setJdInputMode(null)
    } catch (err) {
      setJdError(err.message === 'Failed to fetch'
        ? "We can't reach MockMate right now. Please check your internet connection and try again."
        : err.message || "Sorry, we couldn't read this link.")
    } finally {
      setJdLoading(false)
    }
  }

  const clearJD = () => {
    setJd(''); setJdFile(null); setJdError(''); setJdInputMode(null); setJdUrl(''); setJdSource(null); setJdRecent(null)
    if (jdFileInputRef.current) jdFileInputRef.current.value = ''
  }

  const handleStart = async () => {
    if (!jd.trim()) return
    setLoading(true); setError('')
    try {
      const res = await fetch(`${BACKEND_URL}/parse-jd`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getStoredToken()}` },
        body: JSON.stringify({ jd_text: jd, cv_text: cvText || null, difficulty, company_name: companyName.trim() || null, interview_type: interviewType, language, question_count: questionCount, interviewer }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        // A plan limit comes with a code; refresh what is left so the page explains it
        if (d.detail?.code) { onLimit?.(); throw new Error(d.detail.message) }
        throw new Error(d.detail || 'Failed to parse JD')
      }
      onStart({ ...(await res.json()), difficulty, interview_type: interviewType, language, interviewer })
    } catch (err) {
      setError(err.message || 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  const languages   = user?.usage?.features?.languages || ['en-US']
  const outOfInterviews = user?.usage && user.usage.remaining <= 0
  const canStart    = jd.trim() && !loading && !cvLoading && !jdLoading && !outOfInterviews
  // JD is "committed" (show badge) when it has content and no input mode is open
  const jdCommitted = Boolean(jd.trim() && jdInputMode === null)

  const Spinner = () => (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
    </svg>
  )

  // Shared level + language + length settings used in both tabs
  const SettingsRow = () => (
    <div className="space-y-4">
    <div>
      <label className="block text-slate-600 dark:text-slate-400 text-xs lg:text-[13px] font-semibold uppercase tracking-wide mb-1.5">Interviewer</label>
      <div className="flex gap-2">
        {INTERVIEWERS.map(iv => (
          <button
            key={iv.id}
            onClick={() => setInterviewer(iv.id)}
            className={`flex items-center gap-2.5 pl-1.5 pr-4 py-1.5 rounded-full border text-sm font-semibold transition-all ${
              interviewer === iv.id
                ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
                : 'border-slate-200 dark:border-slate-700/50 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
            }`}
          >
            <InterviewerFace interviewer={iv} />
            {iv.name}
          </button>
        ))}
      </div>
    </div>
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="block text-slate-600 dark:text-slate-400 text-xs lg:text-[13px] font-semibold uppercase tracking-wide mb-1.5">Level</label>
        <div className="flex gap-1">
          {['Junior', 'Mid', 'Senior'].map(d => (
            <button key={d} onClick={() => setDifficulty(d)} className={pillCls(difficulty === d)}>{d}</button>
          ))}
        </div>
        <p className="text-slate-600 dark:text-slate-500 text-xs mt-1">{DIFFICULTY_INFO[difficulty]}</p>
      </div>
      <div>
        <label className="block text-slate-600 dark:text-slate-400 text-xs lg:text-[13px] font-semibold uppercase tracking-wide mb-1.5">Language</label>
        <div className="flex gap-1">
          {LANGUAGES.map(lang => {
            const locked = !languages.includes(lang.code)
            return (
              <button
                key={lang.code}
                onClick={() => locked ? openUpgrade() : setLanguage(lang.code)}
                title={locked ? `${lang.label} — Pro only` : lang.label}
                className={`${pillCls(language === lang.code && !locked)} relative`}
              >
                {lang.short}
                {locked && (
                  <span className="absolute -top-1.5 -right-1.5 text-[9px] font-black bg-amber-500 text-white rounded-full px-1 leading-tight">PRO</span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <label className="block text-slate-600 dark:text-slate-400 text-xs lg:text-[13px] font-semibold uppercase tracking-wide">Questions</label>
        <span className="text-slate-600 dark:text-slate-500 text-xs">
          {questionCount} {questionCount === 1 ? 'question' : 'questions'} · about {questionCount * MINUTES_PER_QUESTION} min
        </span>
      </div>
      <div className="flex gap-1">
        {QUESTION_COUNTS.map(n => (
          <button key={n} onClick={() => setQuestionCount(n)} className={pillCls(questionCount === n)}>{n}</button>
        ))}
      </div>
    </div>
    </div>
  )

  return (
    <div className="relative min-h-screen dark:bg-slate-950 flex flex-col items-center justify-center px-3 sm:px-4 py-10 overflow-hidden">
      <BgOrbs />

      <div className="relative z-10 w-full max-w-5xl 2xl:max-w-6xl sm:px-8">

        {/* Heading */}
        <div className="mb-6 animate-fade-up">
          <h1 className="text-2xl lg:text-3xl font-black text-slate-900 dark:text-white">Practice Interview</h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm lg:text-base mt-1">Configure your session and start when ready.</p>
        </div>

        {/* Main card */}
        <div
          className="animate-fade-up glass border border-slate-200 dark:border-slate-700/40 rounded-2xl p-5 sm:p-6 lg:p-8 space-y-4 lg:space-y-5 shadow-xl"
          style={{ animationDelay: '0.08s' }}
        >

            <>
              {/* Company */}
              <div>
                <label className="block text-slate-600 dark:text-slate-400 text-xs lg:text-[13px] font-semibold uppercase tracking-wide mb-1.5">
                  Company <span className="font-normal normal-case text-slate-500 dark:text-slate-500">— optional</span>
                </label>
                <input
                  type="text"
                  className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/50 rounded-xl px-3 py-2.5 text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/30 text-sm transition-all"
                  placeholder="e.g. Google, Stripe, Amazon…"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                />
              </div>

              {/* Job Description */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-slate-600 dark:text-slate-400 text-xs lg:text-[13px] font-semibold uppercase tracking-wide">
                    Job Description <span className="text-emerald-500">*</span>
                  </label>
                  {!jdCommitted && (
                    <div className="flex items-center gap-3">
                      {recentJds.length > 0 && (
                        <button
                          onClick={() => { setShowRecent(o => !o); setShowTemplates(false) }}
                          className={`flex items-center gap-1 text-xs font-semibold transition-colors ${showRecent ? 'text-emerald-500' : 'text-emerald-600 dark:text-emerald-400 hover:text-emerald-500'}`}
                        >
                          Recent ({recentJds.length}) <IconChevron className="w-3 h-3" open={showRecent} />
                        </button>
                      )}
                      <button
                        onClick={() => { setShowTemplates(o => !o); setShowRecent(false) }}
                        className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-500 hover:text-emerald-400 transition-colors"
                      >
                        Use template <IconChevron className="w-3 h-3" open={showTemplates} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Recent job ads: pick one to practise it again */}
                {showRecent && !jdCommitted && (
                  <div className="mb-2 max-h-64 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-900/80 divide-y divide-slate-100 dark:divide-slate-800">
                    {recentJds.map(item => (
                      <div key={item.id} className="group flex items-center gap-2 px-3 py-2.5 hover:bg-emerald-500/5 transition-colors">
                        <button onClick={() => pickRecent(item)} className="flex-1 min-w-0 text-left">
                          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">{item.role || 'Job description'}</p>
                          <p className="text-xs text-slate-500 truncate">
                            {[item.company_name, formatDate(item.last_used_at), `${item.jd_text.trim().split(/\s+/).length} words`].filter(Boolean).join(' · ')}
                          </p>
                        </button>
                        <button
                          onClick={() => removeRecent(item)}
                          title="Remove from the list"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-500/10 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 transition-all"
                        >
                          <IconX />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

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
                      {jdRecent && jdRecent.jd_text === jd ? [jdRecent.role || 'Saved job description', jdRecent.company_name].filter(Boolean).join(' · ')
                        : jdFile ? jdFile.name
                        : jdSource ? `${jd.trim().split(/\s+/).length} words from ${jdSource}`
                        : `${jd.trim().split(/\s+/).length} words pasted`}
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
                            : 'bg-slate-100 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/50 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
                        }`}
                      >
                        <IconPaste /> Paste text
                      </button>
                      <button
                        onClick={() => setJdInputMode(m => m === 'upload' ? null : 'upload')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                          jdInputMode === 'upload'
                            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                            : 'bg-slate-100 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/50 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
                        }`}
                      >
                        <IconUpload /> Upload file
                      </button>
                      <button
                        onClick={() => { setJdInputMode(m => m === 'link' ? null : 'link'); setJdError('') }}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                          jdInputMode === 'link'
                            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                            : 'bg-slate-100 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/50 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
                        }`}
                      >
                        <IconLink /> From link
                      </button>
                    </div>

                    {/* Link input */}
                    {jdInputMode === 'link' && (
                      <div className="mt-2">
                        <form
                          onSubmit={(e) => { e.preventDefault(); handleJdUrl() }}
                          className="flex gap-2"
                        >
                          <input
                            id="jd-url"
                            type="url"
                            inputMode="url"
                            className="flex-1 min-w-0 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/50 rounded-xl px-3 py-2.5 text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/30 text-sm transition-all"
                            placeholder="https://www.jobs.ch/en/vacancies/…"
                            value={jdUrl}
                            onChange={(e) => setJdUrl(e.target.value)}
                            disabled={jdLoading}
                            autoFocus
                          />
                          <button
                            type="submit"
                            disabled={!jdUrl.trim() || jdLoading}
                            className="flex items-center gap-2 px-4 rounded-xl text-sm font-semibold bg-gradient-to-r from-emerald-500 to-teal-500 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                          >
                            {jdLoading ? <><Spinner />Reading…</> : 'Load'}
                          </button>
                        </form>
                        {jdError
                          ? <div className="mt-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5">
                              <p className="text-amber-200 text-xs leading-relaxed">{jdError}</p>
                              <button
                                type="button"
                                onClick={() => { setJdError(''); setJdInputMode('paste') }}
                                className="mt-2 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
                              >
                                Paste the text instead →
                              </button>
                            </div>
                          : <p className="mt-1.5 text-slate-500 text-xs leading-relaxed">Paste the link of the job ad itself, not the search results page. If a site doesn't allow reading, just copy the text and paste it.</p>}
                      </div>
                    )}

                    {/* Paste textarea */}
                    {jdInputMode === 'paste' && (
                      <textarea
                        className="mt-2 w-full h-36 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/50 rounded-xl p-3 text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/30 resize-none text-sm leading-relaxed transition-all"
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
                          <div className="flex items-center gap-3 px-3 py-3 border border-slate-200 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-800/30 rounded-xl">
                            <Spinner />
                            <span className="text-sm text-slate-500 truncate flex-1">{jdFile?.name}</span>
                            <span className="text-xs text-slate-400">Extracting…</span>
                          </div>
                        ) : (
                          <div
                            onClick={() => jdFileInputRef.current?.click()}
                            className="border-2 border-dashed rounded-xl p-5 flex flex-col items-center gap-2 cursor-pointer transition-all border-slate-200 dark:border-slate-700/50 hover:border-emerald-500/30 hover:bg-slate-50 dark:hover:bg-slate-800/30"
                          >
                            <IconUpload className="w-5 h-5 text-slate-400" />
                            <p className="text-sm text-slate-500 dark:text-slate-400">Click to upload</p>
                            <p className="text-xs text-slate-500 dark:text-slate-500">PDF · DOCX · TXT</p>
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
                <label className="block text-slate-600 dark:text-slate-400 text-xs lg:text-[13px] font-semibold uppercase tracking-wide mb-1.5">
                  CV / Resume <span className="font-normal normal-case text-slate-500 dark:text-slate-500">— optional, personalises questions</span>
                </label>
                {!cvFile ? (
                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl px-4 py-3 flex items-center gap-3 cursor-pointer transition-all ${
                      isDragging ? 'border-emerald-400 bg-emerald-500/8' : 'border-slate-200 dark:border-slate-700/50 hover:border-emerald-500/25 hover:bg-slate-50 dark:hover:bg-slate-800/30'
                    }`}
                  >
                    <IconUpload className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <span className="text-sm text-slate-500 dark:text-slate-400 flex-1">Upload CV</span>
                    <span className="text-xs text-slate-500 dark:text-slate-500">PDF · DOCX · TXT</span>
                    <input ref={fileInputRef} type="file" accept=".pdf,.docx,.txt" className="hidden" onChange={(e) => handleFileSelect(e.target.files[0])} />
                  </div>
                ) : (
                  <div className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all ${
                    cvLoading ? 'border-slate-200 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-800/30' :
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
                <label className="block text-slate-600 dark:text-slate-400 text-xs lg:text-[13px] font-semibold uppercase tracking-wide mb-1.5">Interview Type</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                  {INTERVIEW_TYPES.map(t => {
                    return (
                      <button
                        key={t.value}
                        onClick={() => setInterviewType(t.value)}
                        title={t.desc}
                        className={`relative py-2 px-3 rounded-xl text-sm font-medium text-center transition-all ${
                          interviewType === t.value
                            ? 'bg-emerald-500/15 border border-emerald-500/35 text-emerald-400'
                            : 'bg-slate-100/80 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/40 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
                        }`}
                      >
                        <span className="block font-semibold">{t.label}</span>
                        <span className="block text-[11px] font-normal opacity-75 mt-0.5 leading-snug">{t.desc}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <SettingsRow />

              {error && !outOfInterviews && <div className="bg-red-500/8 border border-red-500/20 rounded-xl px-3 py-2.5 text-red-400 text-sm">{error}</div>}

              <UsageNote usage={user?.usage} />

              <button
                onClick={handleStart}
                disabled={!canStart}
                className={`w-full font-bold py-3.5 lg:py-4 rounded-xl transition-all duration-300 flex items-center justify-center gap-2 text-sm lg:text-base ${
                  canStart
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white shadow-md shadow-emerald-500/25'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-500 cursor-not-allowed border border-slate-200 dark:border-slate-700/40'
                }`}
              >
                {loading
                  ? <><Spinner />{cvText ? 'Building personalised interview…' : 'Preparing interview…'}</>
                  : <><IconMic className="w-4 h-4" />{cvText ? `Start ${difficulty} Interview — Personalised` : `Start ${difficulty} Interview`} · {questionCount} {questionCount === 1 ? 'question' : 'questions'}</>
                }
              </button>
            </>
        </div>

        <p className="text-center text-slate-600 dark:text-slate-500 text-xs mt-4">
          Uses your browser's microphone · Works best in Chrome
        </p>
      </div>
    </div>
  )
}
