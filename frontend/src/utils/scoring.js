// src/utils/scoring.js

// Helper: STAR keyword groups per language
const STAR_GROUPS = {
  en: {
    situation: ["situation", "context"],
    task: ["task", "responsibility"],
    action: ["action", "i decided", "i did"],
    result: ["result", "outcome", "impact"],
  },
  de: {
    // German STAR:
    // "situation","aufgabe","maßnahme"/"ich habe","ergebnis"/"resultat"
    situation: ["situation"],
    task: ["aufgabe"],
    action: ["maßnahme", "ich habe"],
    result: ["ergebnis", "resultat"],
  },
  fr: {
    // French STAR:
    // "situation","tâche"/"responsabilité","action"/"j'ai décidé","résultat"/"impact"
    situation: ["situation"],
    task: ["tâche", "responsabilité"],
    action: ["action", "j'ai décidé"],
    result: ["résultat", "impact"],
  },
};

// Helper: ownership keywords per language
const OWNERSHIP_KEYWORDS = {
  en: ["led", "owned", "initiated"],
  // German ownership: "ich habe geleitet","ich war verantwortlich","ich habe initiiert"
  de: ["ich habe geleitet", "ich war verantwortlich", "ich habe initiiert"],
  // French ownership: "j'ai dirigé","j'ai initié","j'étais responsable"
  fr: ["j'ai dirigé", "j'ai initié", "j'étais responsable"],
};

// Multilingual feedback text
const FEEDBACK_TEXT = {
  en: {
    starPartial:
      "Try to cover all parts of STAR: Situation, Task, Action, and Result.",
    starMissing:
      "Your answer would be stronger if you clearly followed the STAR structure.",
    impact:
      "Mention concrete impact or metrics (e.g., percentages, time saved, revenue, users).",
    tooShort:
      "Your answer is quite short. Add more detail about what you did and how you did it.",
    tooLong:
      "Your answer is quite long. Try to be more concise and focus on the most important points.",
    ownership:
      "Highlight your personal ownership: what *you* did, not just what the team did.",
    noAnswer1:
      "You did not really provide an answer. In interviews, try to say something, even if it feels imperfect.",
    noAnswer2:
      "Use the STAR structure (Situation, Task, Action, Result) to organize your thoughts.",
  },
  de: {
    starPartial:
      "Versuchen Sie, alle Teile von STAR abzudecken: Situation, Aufgabe, Aktion und Resultat.",
    starMissing:
      "Ihre Antwort wäre stärker, wenn Sie klar der STAR-Struktur folgen würden.",
    impact:
      "Nennen Sie konkrete Auswirkungen oder Kennzahlen (z. B. Prozentsätze, eingesparte Zeit, Umsatz, Nutzer).",
    tooShort:
      "Ihre Antwort ist recht kurz. Fügen Sie mehr Details hinzu, was Sie getan haben und wie Sie es getan haben.",
    tooLong:
      "Ihre Antwort ist recht lang. Versuchen Sie, prägnanter zu sein und sich auf die wichtigsten Punkte zu konzentrieren.",
    ownership:
      "Betonen Sie Ihre persönliche Verantwortung: was *Sie* getan haben, nicht nur das Team.",
    noAnswer1:
      "Sie haben im Grunde keine Antwort gegeben. Versuchen Sie im Interview, trotzdem etwas zu sagen, auch wenn es nicht perfekt ist.",
    noAnswer2:
      "Nutzen Sie die STAR-Struktur (Situation, Aufgabe, Aktion, Resultat), um Ihre Gedanken zu ordnen.",
  },
  fr: {
    starPartial:
      "Essayez de couvrir toutes les parties de STAR : Situation, Tâche, Action et Résultat.",
    starMissing:
      "Votre réponse serait plus forte si vous suiviez clairement la structure STAR.",
    impact:
      "Mentionnez un impact concret ou des métriques (par exemple, pourcentages, temps gagné, revenus, utilisateurs).",
    tooShort:
      "Votre réponse est assez courte. Ajoutez plus de détails sur ce que vous avez fait et comment vous l’avez fait.",
    tooLong:
      "Votre réponse est assez longue. Essayez d’être plus concis et de vous concentrer sur les points les plus importants.",
    ownership:
      "Mettez en avant votre responsabilité personnelle : ce que *vous* avez fait, pas seulement l’équipe.",
    noAnswer1:
      "Vous n’avez pas vraiment fourni de réponse. En entretien, essayez de dire quelque chose, même si ce n’est pas parfait.",
    noAnswer2:
      "Utilisez la structure STAR (Situation, Tâche, Action, Résultat) pour organiser vos idées.",
  },
};

// Helper: language detection based on presence of DE/FR keywords
function detectLanguage(lower) {
  let scores = { en: 0, de: 0, fr: 0 };

  // Count matches for each language's STAR + ownership keywords
  for (const [lang, groups] of Object.entries(STAR_GROUPS)) {
    for (const list of Object.values(groups)) {
      list.forEach((kw) => {
        if (lower.includes(kw)) scores[lang] += 1;
      });
    }
  }

  for (const [lang, list] of Object.entries(OWNERSHIP_KEYWORDS)) {
    list.forEach((kw) => {
      if (lower.includes(kw)) scores[lang] += 1;
    });
  }

  // Pick the language with the highest score; default to English
  let bestLang = "en";
  let bestScore = scores.en;

  if (scores.de > bestScore) {
    bestLang = "de";
    bestScore = scores.de;
  }
  if (scores.fr > bestScore) {
    bestLang = "fr";
    bestScore = scores.fr;
  }

  return bestLang;
}

// Helper: check if any keyword from list is present
function hasAny(lower, list) {
  return list.some((kw) => lower.includes(kw));
}

// selectedLanguage should be "en" | "de" | "fr" from the UI
export function scoreAllAnswers(answers, selectedLanguage = null) {
  // Ensure we always have an array
  const safeAnswers = Array.isArray(answers) ? answers : [];

  const detailed = safeAnswers.map((answer) => {
    const text = (answer || "").trim();

    // If no answer was given → use selectedLanguage if valid, else English
    if (!text) {
      const langForEmpty =
        selectedLanguage && FEEDBACK_TEXT[selectedLanguage]
          ? selectedLanguage
          : "en";
      const t = FEEDBACK_TEXT[langForEmpty];
      return {
        score: 0,
        tips: [t.noAnswer1, t.noAnswer2],
      };
    }

    let score = 10; // start from a neutral baseline
    const tips = [];
    const lower = text.toLowerCase();

    // Use selected language if provided, otherwise fall back to detection
    const detected = detectLanguage(lower);
    const lang =
      selectedLanguage && FEEDBACK_TEXT[selectedLanguage]
        ? selectedLanguage
        : detected;

    const starGroups = STAR_GROUPS[lang] || STAR_GROUPS.en;
    const t = FEEDBACK_TEXT[lang] || FEEDBACK_TEXT.en;

    // STAR structure (language-aware)
    const hasSituation = hasAny(lower, starGroups.situation);
    const hasTask = hasAny(lower, starGroups.task);
    const hasAction = hasAny(lower, starGroups.action);
    const hasResult = hasAny(lower, starGroups.result);

    let starCount = 0;
    if (hasSituation) starCount++;
    if (hasTask) starCount++;
    if (hasAction) starCount++;
    if (hasResult) starCount++;

    if (starCount >= 3) {
      score += 4;
    } else if (starCount === 2) {
      score += 2;
      tips.push(t.starPartial);
    } else {
      tips.push(t.starMissing);
    }

    // Impact / metrics (language-agnostic for now)
    const hasNumbers = /\d/.test(text);
    if (
      hasNumbers ||
      lower.includes("%") ||
      lower.includes("increase") ||
      lower.includes("decrease")
    ) {
      score += 3;
    } else {
      tips.push(t.impact);
    }

    // Clarity / length
    const length = text.split(/\s+/).length;
    if (length < 60) {
      tips.push(t.tooShort);
      score -= 1;
    } else if (length > 220) {
      tips.push(t.tooLong);
      score -= 1;
    }

    // Soft skills / ownership (language-aware)
    const ownershipList = OWNERSHIP_KEYWORDS[lang] || OWNERSHIP_KEYWORDS.en;
    const hasOwnership = hasAny(lower, ownershipList);

    if (hasOwnership) {
      score += 2;
    } else {
      tips.push(t.ownership);
    }

    // Bound score between 0 and 20
    score = Math.max(0, Math.min(20, score));

    return {
      score,
      tips,
    };
  });

  // Compute final score (0–100)
  const totalScore = detailed.reduce((sum, item) => sum + item.score, 0);
  const count = detailed.length || 1;
  const avgScore = totalScore / count; // 0–20
  const finalScore = Math.round((avgScore / 20) * 100); // 0–100

  // Verdict (updated per team lead request)
  let verdict;
  if (finalScore >= 55) {
    verdict = "Accepted — you got the job!";
  } else {
    verdict = "Rejected — keep practicing";
  }

  return {
    finalScore,
    verdict,
    detailed,
  };
}
