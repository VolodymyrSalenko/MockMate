import { useState, useEffect, useRef } from 'react'
import { fetchCVProfile, uploadCVProfile } from '../utils/api'

function BgOrbs() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      <div className="animate-orb absolute -top-20 right-0 w-96 h-96 rounded-full bg-emerald-500/8 blur-3xl" />
      <div className="animate-orb-r absolute bottom-0 -left-20 w-80 h-80 rounded-full bg-cyan-500/6 blur-3xl" />
    </div>
  )
}

const SKILL_COLORS = [
  'bg-emerald-500/15 text-emerald-300 border-emerald-500/25',
  'bg-cyan-500/15 text-cyan-300 border-cyan-500/25',
  'bg-violet-500/15 text-violet-300 border-violet-500/25',
  'bg-blue-500/15 text-blue-300 border-blue-500/25',
  'bg-amber-500/15 text-amber-300 border-amber-500/25',
  'bg-pink-500/15 text-pink-300 border-pink-500/25',
  'bg-teal-500/15 text-teal-300 border-teal-500/25',
  'bg-indigo-500/15 text-indigo-300 border-indigo-500/25',
]

function SkillTag({ name, idx }) {
  const color = SKILL_COLORS[idx % SKILL_COLORS.length]
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${color}`}>
      {name}
    </span>
  )
}

function SectionCard({ title, icon, delay = 0, children }) {
  return (
    <div
      className="glass border border-slate-700/40 rounded-3xl p-6 animate-fade-up"
      style={{ animationDelay: `${delay}s` }}
    >
      <p className="text-white font-bold text-base mb-4">{icon} {title}</p>
      {children}
    </div>
  )
}

function ContactPill({ icon, text }) {
  if (!text) return null
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-400 bg-slate-800/60 border border-slate-700/40 px-3 py-1.5 rounded-full">
      <span>{icon}</span>
      <span className="truncate max-w-[160px]">{text}</span>
    </span>
  )
}

function ExperienceCard({ exp, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border border-slate-700/30 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-start gap-3 p-4 text-left hover:bg-slate-800/30 transition-colors"
      >
        <div className="mt-1.5 w-2.5 h-2.5 rounded-full bg-emerald-500 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-slate-200 font-semibold text-sm">{exp.title}</p>
          <p className="text-emerald-400/80 text-xs font-medium mt-0.5">{exp.company}</p>
          {exp.duration && <p className="text-slate-600 text-xs mt-0.5">{exp.duration}</p>}
        </div>
        <span className="text-slate-600 text-xs flex-shrink-0 mt-1">{open ? '▲' : '▼'}</span>
      </button>
      {open && exp.bullets?.length > 0 && (
        <div className="px-4 pb-4 space-y-2 border-t border-slate-800/60 pt-3">
          {exp.bullets.map((b, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-emerald-500 text-xs flex-shrink-0 mt-0.5">•</span>
              <p className="text-slate-400 text-xs leading-relaxed">{b}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function UploadZone({ onFile, uploading, error }) {
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)

  const handleFiles = (files) => {
    const f = files[0]
    if (f) onFile(f)
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <BgOrbs />
      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8 animate-fade-up">
          <p className="text-emerald-400 text-sm font-bold uppercase tracking-widest mb-2">CV Profile</p>
          <h1 className="text-3xl font-black text-white">Upload your CV</h1>
          <p className="text-slate-500 text-sm mt-2">
            We'll parse it into sections and save it for your interviews
          </p>
        </div>

        <div
          className={`animate-fade-up glass border-2 border-dashed rounded-3xl p-12 flex flex-col items-center gap-4 cursor-pointer transition-all duration-200
            ${dragging ? 'border-emerald-500/60 bg-emerald-500/5' : 'border-slate-700/50 hover:border-slate-600/70'}`}
          style={{ animationDelay: '0.1s' }}
          onClick={() => !uploading && inputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files) }}
        >
          {uploading ? (
            <>
              <div className="w-12 h-12 rounded-full border-4 border-slate-800 border-t-emerald-500 animate-spin" />
              <p className="text-slate-400 text-sm">Parsing your CV with AI...</p>
              <p className="text-slate-600 text-xs">This takes about 10 seconds</p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-3xl">
                📄
              </div>
              <div className="text-center">
                <p className="text-white font-semibold">Drop your CV here</p>
                <p className="text-slate-500 text-sm mt-1">or click to browse</p>
              </div>
              <p className="text-slate-600 text-xs">PDF · DOCX · TXT</p>
            </>
          )}
        </div>

        {error && (
          <div className="mt-4 bg-red-500/10 border border-red-500/20 rounded-2xl p-3 animate-fade-up">
            <p className="text-red-400 text-sm text-center">{error}</p>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,.txt"
          className="hidden"
          onChange={e => handleFiles(e.target.files)}
        />
      </div>
    </div>
  )
}

export default function CVProfile() {
  const [profile,    setProfile]    = useState(null)   // parsed CV object
  const [loading,    setLoading]    = useState(true)   // initial fetch
  const [uploading,  setUploading]  = useState(false)  // file upload in progress
  const [error,      setError]      = useState(null)
  const [updatedAt,  setUpdatedAt]  = useState(null)
  const updateInputRef = useRef(null)

  useEffect(() => {
    fetchCVProfile().then(data => {
      if (data) {
        setProfile(data.parsed)
        setUpdatedAt(data.updated_at)
      }
      setLoading(false)
    })
  }, [])

  const handleFile = async (file) => {
    setUploading(true)
    setError(null)
    try {
      const data = await uploadCVProfile(file)
      setProfile(data.parsed)
      setUpdatedAt(new Date().toISOString())
    } catch (e) {
      setError(e.message || 'Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-slate-800 border-t-emerald-500 animate-spin" />
      </div>
    )
  }

  if (!profile) {
    return <UploadZone onFile={handleFile} uploading={uploading} error={error} />
  }

  const p = profile

  return (
    <div className="min-h-screen bg-slate-950 py-6 sm:py-10 px-3 sm:px-4 relative overflow-hidden">
      <BgOrbs />

      <div className="relative z-10 max-w-3xl mx-auto space-y-5">

        {/* ── Header card ── */}
        <div className="glass border border-slate-700/40 rounded-3xl p-6 animate-fade-up">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              {/* Avatar initial */}
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-2xl font-black text-white flex-shrink-0">
                {p.name?.[0]?.toUpperCase() || '?'}
              </div>
              <div className="min-w-0">
                <h1 className="text-xl font-black text-white leading-tight truncate">
                  {p.name || 'Your Name'}
                </h1>
                {p.title && (
                  <p className="text-emerald-400 text-sm font-medium mt-0.5">{p.title}</p>
                )}
                {/* Contact pills */}
                <div className="flex flex-wrap gap-2 mt-2">
                  <ContactPill icon="📧" text={p.contact?.email} />
                  <ContactPill icon="📱" text={p.contact?.phone} />
                  <ContactPill icon="📍" text={p.contact?.location} />
                  <ContactPill icon="🔗" text={p.contact?.linkedin} />
                </div>
              </div>
            </div>

            {/* Update CV button */}
            <div className="flex flex-col items-end gap-2 flex-shrink-0">
              <button
                onClick={() => updateInputRef.current?.click()}
                disabled={uploading}
                className="text-xs font-semibold text-slate-400 hover:text-white border border-slate-700/50 hover:border-slate-600 rounded-xl px-3 py-2 transition-all disabled:opacity-40"
              >
                {uploading ? 'Updating…' : 'Update CV'}
              </button>
              {updatedAt && (
                <p className="text-slate-600 text-xs">
                  Updated {new Date(updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              )}
            </div>
          </div>

          {/* Upload error inline */}
          {error && (
            <div className="mt-3 bg-red-500/10 border border-red-500/20 rounded-xl p-2.5">
              <p className="text-red-400 text-xs">{error}</p>
            </div>
          )}
        </div>

        {/* Hidden re-upload input */}
        <input
          ref={updateInputRef}
          type="file"
          accept=".pdf,.docx,.txt"
          className="hidden"
          onChange={e => { if (e.target.files[0]) handleFile(e.target.files[0]) }}
        />

        {/* ── Profile Summary ── */}
        {p.profile && (
          <SectionCard title="Profile" icon="👤" delay={0.05}>
            <p className="text-slate-400 text-sm leading-relaxed">{p.profile}</p>
          </SectionCard>
        )}

        {/* ── Skills ── */}
        {p.skills?.length > 0 && (
          <SectionCard title="Skills" icon="⚡" delay={0.1}>
            <div className="flex flex-wrap gap-2">
              {p.skills.map((s, i) => <SkillTag key={i} name={s} idx={i} />)}
            </div>
          </SectionCard>
        )}

        {/* ── Experience ── */}
        {p.experience?.length > 0 && (
          <SectionCard title="Experience" icon="💼" delay={0.15}>
            <div className="space-y-2">
              {p.experience.map((exp, i) => (
                <ExperienceCard key={i} exp={exp} defaultOpen={i === 0} />
              ))}
            </div>
          </SectionCard>
        )}

        {/* ── Education ── */}
        {p.education?.length > 0 && (
          <SectionCard title="Education" icon="🎓" delay={0.2}>
            <div className="space-y-4">
              {p.education.map((edu, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="mt-1.5 w-2.5 h-2.5 rounded-full bg-cyan-500 flex-shrink-0" />
                  <div>
                    <p className="text-slate-200 font-semibold text-sm">{edu.degree}</p>
                    <p className="text-cyan-400/80 text-xs font-medium mt-0.5">{edu.institution}</p>
                    <div className="flex gap-3 mt-0.5">
                      {edu.year  && <p className="text-slate-600 text-xs">{edu.year}</p>}
                      {edu.grade && <p className="text-slate-500 text-xs">{edu.grade}</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {/* ── Languages + Certifications side by side ── */}
        {(p.languages?.length > 0 || p.certifications?.length > 0) && (
          <div className={`grid gap-4 ${p.languages?.length > 0 && p.certifications?.length > 0 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
            {p.languages?.length > 0 && (
              <SectionCard title="Languages" icon="🌍" delay={0.25}>
                <div className="space-y-2">
                  {p.languages.map((l, i) => (
                    <p key={i} className="text-slate-400 text-sm">{l}</p>
                  ))}
                </div>
              </SectionCard>
            )}
            {p.certifications?.length > 0 && (
              <SectionCard title="Certifications" icon="🏆" delay={0.3}>
                <div className="space-y-2">
                  {p.certifications.map((c, i) => (
                    <p key={i} className="text-slate-400 text-xs leading-relaxed">{c}</p>
                  ))}
                </div>
              </SectionCard>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
