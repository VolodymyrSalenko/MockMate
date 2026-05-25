// src/utils/scoring.js

export function scoreAllAnswers(answers) {
  // Ensure we always have an array
  const safeAnswers = Array.isArray(answers) ? answers : [];

  const detailed = safeAnswers.map((answer) => {
    const text = (answer || "").trim();

    // If no answer was given
    if (!text) {
      return {
        score: 0,
        tips: [
          "You did not really provide an answer. In interviews, try to say something, even if it feels imperfect.",
          "Use the STAR structure (Situation, Task, Action, Result) to organize your thoughts.",
        ],
      };
    }

    let score = 10; // start from a neutral baseline
    const tips = [];
    const lower = text.toLowerCase();

    // STAR structure
    const hasSituation =
      lower.includes("situation") || lower.includes("context");
    const hasTask = lower.includes("task") || lower.includes("responsibility");
    const hasAction =
      lower.includes("action") ||
      lower.includes("i decided") ||
      lower.includes("i did");
    const hasResult =
      lower.includes("result") ||
      lower.includes("outcome") ||
      lower.includes("impact");

    let starCount = 0;
    if (hasSituation) starCount++;
    if (hasTask) starCount++;
    if (hasAction) starCount++;
    if (hasResult) starCount++;

    if (starCount >= 3) {
      score += 4;
    } else if (starCount === 2) {
      score += 2;
      tips.push(
        "Try to cover all parts of STAR: Situation, Task, Action, and Result.",
      );
    } else {
      tips.push(
        "Your answer would be stronger if you clearly followed the STAR structure.",
      );
    }

    // Impact / metrics
    const hasNumbers = /\d/.test(text);
    if (
      hasNumbers ||
      lower.includes("%") ||
      lower.includes("increase") ||
      lower.includes("decrease")
    ) {
      score += 3;
    } else {
      tips.push(
        "Mention concrete impact or metrics (e.g., percentages, time saved, revenue, users).",
      );
    }

    // Clarity / length
    const length = text.split(/\s+/).length;
    if (length < 60) {
      tips.push(
        "Your answer is quite short. Add more detail about what you did and how you did it.",
      );
      score -= 1;
    } else if (length > 220) {
      tips.push(
        "Your answer is quite long. Try to be more concise and focus on the most important points.",
      );
      score -= 1;
    }

    // Soft skills / ownership
    if (
      lower.includes("i") &&
      (lower.includes("led") ||
        lower.includes("owned") ||
        lower.includes("initiated"))
    ) {
      score += 2;
    } else {
      tips.push(
        "Highlight your personal ownership: what *you* did, not just what the team did.",
      );
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

  // Verdict
  let verdict;
  if (finalScore >= 80) {
    verdict = "Strong candidate – likely hire.";
  } else if (finalScore >= 60) {
    verdict = "Promising – could hire with some improvements.";
  } else if (finalScore >= 40) {
    verdict = "Mixed – needs significant improvement.";
  } else {
    verdict = "Not ready yet – keep practicing and refining your stories.";
  }

  return {
    finalScore,
    verdict,
    detailed,
  };
}
