// Shared scoring helpers used across Dashboard, Sessions, and Debrief.

export const SCORE_HIGH = 8
export const SCORE_MID  = 5
export const AI_HIGH    = 75
export const AI_MID     = 50

export function scoreBg(s) {
  return s >= SCORE_HIGH
    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
    : s >= SCORE_MID
    ? 'bg-yellow-400/20 text-yellow-300 border-yellow-400/30'
    : 'bg-red-500/20 text-red-400 border-red-500/30'
}

export function scoreColor(s) {
  return s >= SCORE_HIGH ? 'text-emerald-400' : s >= SCORE_MID ? 'text-yellow-400' : 'text-red-400'
}

export function scoreHex(s) {
  return s >= SCORE_HIGH ? '#10b981' : s >= SCORE_MID ? '#f59e0b' : '#ef4444'
}

export function aiColor(s) {
  return s >= AI_HIGH ? 'text-emerald-400' : s >= AI_MID ? 'text-yellow-400' : 'text-red-400'
}

export function aiBg(s) {
  return s >= AI_HIGH
    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
    : s >= AI_MID
    ? 'bg-yellow-400/20 text-yellow-300 border-yellow-400/30'
    : 'bg-red-500/20 text-red-400 border-red-500/30'
}

export function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatShort(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function difficultyBadge(d) {
  const map = {
    Junior: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
    Mid:    'text-violet-400 bg-violet-500/10 border-violet-500/20',
    Senior: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  }
  return map[d] || 'text-slate-400 bg-slate-500/10 border-slate-500/20'
}

export function typeBadge(t) {
  const map = {
    full:       '🎯 Full',
    behavioral: '🌟 Behavioral',
    technical:  '⚡ Technical',
    screening:  '📞 Screening',
    practice:   '🎓 Practice',
  }
  return map[t] || t || '—'
}

export function langInfo(code) {
  return (
    { 'en-US': { flag: '🇬🇧', label: 'English' },
      'de-DE': { flag: '🇩🇪', label: 'Deutsch' },
      'fr-FR': { flag: '🇫🇷', label: 'Français' } }[code]
    || { flag: '🌐', label: code }
  )
}

export function avgArr(arr) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null
}

// ── Multilingual scoring data ──────────────────────────────────────────────────

const STAR_GROUPS = {
  en: {
    situation: ['situation', 'context'],
    task:      ['task', 'responsibility'],
    action:    ['action', 'i decided', 'i did'],
    result:    ['result', 'outcome', 'impact'],
  },
  de: {
    situation: ['situation'],
    task:      ['aufgabe'],
    action:    ['maßnahme', 'ich habe'],
    result:    ['ergebnis', 'resultat'],
  },
  fr: {
    situation: ['situation'],
    task:      ['tâche', 'responsabilité'],
    action:    ['action', "j'ai décidé"],
    result:    ['résultat', 'impact'],
  },
}

const OWNERSHIP_KEYWORDS = {
  en: ['led', 'owned', 'initiated'],
  de: ['ich habe geleitet', 'ich war verantwortlich', 'ich habe initiiert'],
  fr: ["j'ai dirigé", "j'ai initié", "j'étais responsable"],
}

const FEEDBACK_TEXT = {
  en: {
    starPartial: 'Try to cover all parts of STAR: Situation, Task, Action, and Result.',
    starMissing: 'Your answer would be stronger if you clearly followed the STAR structure.',
    impact:      'Mention concrete impact or metrics (e.g., percentages, time saved, revenue, users).',
    tooShort:    'Your answer is quite short. Add more detail about what you did and how you did it.',
    tooLong:     'Your answer is quite long. Try to be more concise and focus on the most important points.',
    ownership:   'Highlight your personal ownership: what *you* did, not just what the team did.',
    noAnswer1:   'You did not really provide an answer. In interviews, try to say something, even if it feels imperfect.',
    noAnswer2:   'Use the STAR structure (Situation, Task, Action, Result) to organize your thoughts.',
  },
  de: {
    starPartial: 'Versuchen Sie, alle Teile von STAR abzudecken: Situation, Aufgabe, Aktion und Resultat.',
    starMissing: 'Ihre Antwort wäre stärker, wenn Sie klar der STAR-Struktur folgen würden.',
    impact:      'Nennen Sie konkrete Auswirkungen oder Kennzahlen (z. B. Prozentsätze, eingesparte Zeit, Umsatz, Nutzer).',
    tooShort:    'Ihre Antwort ist recht kurz. Fügen Sie mehr Details hinzu, was Sie getan haben und wie Sie es getan haben.',
    tooLong:     'Ihre Antwort ist recht lang. Versuchen Sie, prägnanter zu sein und sich auf die wichtigsten Punkte zu konzentrieren.',
    ownership:   'Betonen Sie Ihre persönliche Verantwortung: was *Sie* getan haben, nicht nur das Team.',
    noAnswer1:   'Sie haben im Grunde keine Antwort gegeben. Versuchen Sie im Interview, trotzdem etwas zu sagen, auch wenn es nicht perfekt ist.',
    noAnswer2:   'Nutzen Sie die STAR-Struktur (Situation, Aufgabe, Aktion, Resultat), um Ihre Gedanken zu ordnen.',
  },
  fr: {
    starPartial: 'Essayez de couvrir toutes les parties de STAR : Situation, Tâche, Action et Résultat.',
    starMissing: 'Votre réponse serait plus forte si vous suiviez clairement la structure STAR.',
    impact:      'Mentionnez un impact concret ou des métriques (par exemple, pourcentages, temps gagné, revenus, utilisateurs).',
    tooShort:    'Votre réponse est assez courte. Ajoutez plus de détails sur ce que vous avez fait et comment vous l\'avez fait.',
    tooLong:     'Votre réponse est assez longue. Essayez d\'être plus concis et de vous concentrer sur les points les plus importants.',
    ownership:   'Mettez en avant votre responsabilité personnelle : ce que *vous* avez fait, pas seulement l\'équipe.',
    noAnswer1:   'Vous n\'avez pas vraiment fourni de réponse. En entretien, essayez de dire quelque chose, même si ce n\'est pas parfait.',
    noAnswer2:   'Utilisez la structure STAR (Situation, Tâche, Action, Résultat) pour organiser vos idées.',
  },
}

function detectLanguage(lower) {
  const scores = { en: 0, de: 0, fr: 0 }
  for (const [lang, groups] of Object.entries(STAR_GROUPS)) {
    for (const list of Object.values(groups)) {
      list.forEach(kw => { if (lower.includes(kw)) scores[lang]++ })
    }
  }
  for (const [lang, list] of Object.entries(OWNERSHIP_KEYWORDS)) {
    list.forEach(kw => { if (lower.includes(kw)) scores[lang]++ })
  }
  return scores.de > scores.en && scores.de >= scores.fr ? 'de'
       : scores.fr > scores.en                           ? 'fr'
       : 'en'
}

function hasAny(lower, list) {
  return list.some(kw => lower.includes(kw))
}

// ── Client-side AI answer scoring ─────────────────────────────────────────────
// Returns { finalScore (0-100), verdict, detailed: [{score (0-20), tips}] }
export function scoreAllAnswers(answers, selectedLanguage = null) {
  if (!answers || answers.length === 0) {
    return { finalScore: 0, verdict: 'No answers to score', detailed: [] }
  }

  const detailed = answers.map(answer => {
    const text = (answer || '').trim()

    if (!text) {
      const lang = selectedLanguage && FEEDBACK_TEXT[selectedLanguage] ? selectedLanguage : 'en'
      const t = FEEDBACK_TEXT[lang]
      return { score: 0, tips: [t.noAnswer1, t.noAnswer2] }
    }

    let score = 10
    const tips  = []
    const lower = text.toLowerCase()

    const detected   = detectLanguage(lower)
    const lang       = selectedLanguage && FEEDBACK_TEXT[selectedLanguage] ? selectedLanguage : detected
    const starGroups = STAR_GROUPS[lang]     || STAR_GROUPS.en
    const t          = FEEDBACK_TEXT[lang]   || FEEDBACK_TEXT.en

    // STAR structure
    const starCount = ['situation', 'task', 'action', 'result'].filter(
      k => hasAny(lower, starGroups[k])
    ).length
    if      (starCount >= 3) score += 4
    else if (starCount === 2) { score += 2; tips.push(t.starPartial) }
    else                       tips.push(t.starMissing)

    // Impact / metrics
    if (/\d/.test(text) || lower.includes('%') || lower.includes('increase') || lower.includes('decrease')) {
      score += 3
    } else {
      tips.push(t.impact)
    }

    // Length
    const wc = text.split(/\s+/).length
    if      (wc < 60)  { tips.push(t.tooShort); score-- }
    else if (wc > 220) { tips.push(t.tooLong);  score-- }

    // Ownership
    if (hasAny(lower, OWNERSHIP_KEYWORDS[lang] || OWNERSHIP_KEYWORDS.en)) {
      score += 2
    } else {
      tips.push(t.ownership)
    }

    return { score: Math.max(0, Math.min(20, score)), tips }
  })

  const avgScore   = detailed.reduce((sum, d) => sum + d.score, 0) / detailed.length
  const finalScore = Math.round((avgScore / 20) * 100)

  const verdict = finalScore >= 55 ? 'Accepted — you got the job!' : 'Rejected — keep practicing'

  return { finalScore, verdict, detailed }
}
