import { useState, useEffect, useRef, useCallback } from "react";
import { wpmColor, durationLabel } from "../utils/speechAnalytics";
import { saveSessionToDB, saveRetry } from "../utils/api";
import { getStoredToken } from "../context/AuthContext";
import RetryModal from "./RetryModal";
import { BACKEND_URL } from "../utils/config";
import { getInterviewer } from "../utils/interviewers";
import { to100 } from "../utils/scoring";
import { saveRecording } from "../utils/recordingStore";

function BgOrbs() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      <div className="animate-orb absolute -top-20 right-0 w-96 h-96 rounded-full bg-emerald-500/8 blur-3xl" />
      <div className="animate-orb-r absolute bottom-0 -left-20 w-80 h-80 rounded-full bg-cyan-500/6 blur-3xl" />
    </div>
  );
}

function ScoreBadge({ score }) {
  const rounded = Math.round(score);
  const shown = to100(score);
  const style =
    rounded >= 8
      ? {
          background: "linear-gradient(135deg,#10b981,#06b6d4)",
          color: "#fff",
          boxShadow: "0 0 16px rgba(16,185,129,0.5)",
        }
      : rounded >= 5
        ? {
            background: "linear-gradient(135deg,#f59e0b,#f97316)",
            color: "#fff",
            boxShadow: "0 0 16px rgba(245,158,11,0.4)",
          }
        : {
            background: "linear-gradient(135deg,#ef4444,#f43f5e)",
            color: "#fff",
            boxShadow: "0 0 16px rgba(239,68,68,0.4)",
          };
  return (
    <div
      className="w-10 h-10 rounded-full flex items-center justify-center font-black text-xs flex-shrink-0"
      style={style}
    >
      {shown}
    </div>
  );
}

function OverallScoreBadge({ score }) {
  const gradient =
    score >= 8
      ? "from-emerald-500 to-teal-400"
      : score >= 5
        ? "from-yellow-400 to-amber-400"
        : "from-red-500 to-rose-400";
  const glow =
    score >= 8
      ? "rgba(16,185,129,0.5)"
      : score >= 5
        ? "rgba(245,158,11,0.4)"
        : "rgba(239,68,68,0.4)";
  return (
    <div
      className={`w-36 h-36 rounded-full bg-gradient-to-br ${gradient} flex flex-col items-center justify-center animate-score-pop`}
      style={{
        boxShadow: `0 0 40px ${glow}, 0 0 80px ${glow.replace("0.5", "0.2")}`,
      }}
    >
      <span className="text-4xl font-black text-white">
        {to100(score)}
      </span>
      <span className="text-white/60 text-xs font-semibold tracking-wide">
        / 100
      </span>
    </div>
  );
}

function SpeechAnalyticsPanel({ analytics }) {
  if (!analytics) return null;
  const topFillers = Object.entries(analytics.fillerCounts || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);
  return (
    <div className="glass border border-slate-200 dark:border-slate-700/40 rounded-2xl p-4 space-y-3">
      <p className="text-xs text-slate-600 dark:text-slate-400 font-bold uppercase tracking-widest">
        Speech Analytics
      </p>
      <div className="flex flex-wrap gap-2.5">
        {analytics.durationSeconds > 0 && (
          <div className="flex flex-col items-center bg-slate-100 dark:bg-slate-900/70 rounded-xl px-3 py-2 min-w-[64px] animate-stat-in">
            <span className="text-slate-700 dark:text-slate-200 font-bold text-sm">
              {durationLabel(analytics.durationSeconds)}
            </span>
            <span className="text-slate-600 dark:text-slate-400 text-xs mt-0.5">Duration</span>
          </div>
        )}
        {analytics.wpm > 0 && (
          <div
            className="flex flex-col items-center bg-slate-100 dark:bg-slate-900/70 rounded-xl px-3 py-2 min-w-[64px] animate-stat-in"
            style={{ animationDelay: "0.05s" }}
          >
            <span className={`font-bold text-sm ${wpmColor(analytics.wpm)}`}>
              {analytics.wpm}
            </span>
            <span className="text-slate-600 dark:text-slate-400 text-xs mt-0.5">wpm</span>
          </div>
        )}
        <div
          className="flex flex-col items-center bg-slate-100 dark:bg-slate-900/70 rounded-xl px-3 py-2 min-w-[64px] animate-stat-in"
          style={{ animationDelay: "0.1s" }}
        >
          <span
            className={`font-bold text-sm ${analytics.totalFillers === 0 ? "text-emerald-400" : analytics.totalFillers <= 3 ? "text-yellow-400" : "text-red-400"}`}
          >
            {analytics.totalFillers}
          </span>
          <span className="text-slate-600 dark:text-slate-400 text-xs mt-0.5">Fillers</span>
        </div>
        {analytics.wordCount > 0 && (
          <div
            className="flex flex-col items-center bg-slate-100 dark:bg-slate-900/70 rounded-xl px-3 py-2 min-w-[64px] animate-stat-in"
            style={{ animationDelay: "0.15s" }}
          >
            <span className="text-slate-700 dark:text-slate-200 font-bold text-sm">
              {analytics.wordCount}
            </span>
            <span className="text-slate-600 dark:text-slate-400 text-xs mt-0.5">Words</span>
          </div>
        )}
      </div>
      {topFillers.length > 0 && (
        <div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mb-1.5">Top filler words:</p>
          <div className="flex flex-wrap gap-2">
            {topFillers.map(([word, count]) => (
              <span
                key={word}
                className="bg-orange-500/10 border border-orange-500/25 text-orange-300 text-xs px-2.5 py-1 rounded-full"
              >
                "{word}" ×{count}
              </span>
            ))}
          </div>
        </div>
      )}
      {analytics.wpm > 0 && (
        <p className="text-xs text-slate-600 dark:text-slate-400">
          {analytics.wpm < 100
            ? "A bit slow — aim for 120–160 wpm."
            : analytics.wpm > 180
              ? "A bit fast — slow down for clarity."
              : "Good pace ✓"}
        </p>
      )}
    </div>
  );
}

const SCORE_PARTS = [
  { key: "relevance", label: "Relevance" },
  { key: "examples", label: "Examples" },
  { key: "clarity", label: "Clarity" },
];

// How the answer score was built: the average of three criteria
function ScoreBreakdown({ scores }) {
  if (!scores) return null;
  return (
    <div className="grid grid-cols-3 gap-2">
      {SCORE_PARTS.map(({ key, label }) => {
        const s = scores[key];
        if (s == null) return null;
        const bar = s >= 8 ? "bg-emerald-500" : s >= 5 ? "bg-amber-400" : "bg-red-500";
        return (
          <div key={key}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-600 dark:text-slate-400 font-semibold">{label}</span>
              <span className="text-slate-700 dark:text-slate-300 font-bold">{to100(s)}</span>
            </div>
            <div className="h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${bar}`} style={{ width: `${s * 10}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

const STAR_PARTS = [
  { key: "situation", label: "Situation" },
  { key: "task", label: "Task" },
  { key: "action", label: "Action" },
  { key: "result", label: "Result" },
];

// Which STAR parts the answer contained (only for experience questions)
function StarChecklist({ star }) {
  if (!star) return null;
  return (
    <div>
      <p className="text-xs text-slate-600 dark:text-slate-400 font-semibold mb-1.5">STAR structure</p>
      <div className="flex flex-wrap gap-1.5">
        {STAR_PARTS.map(({ key, label }) => (
          <span
            key={key}
            className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
              star[key]
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500 dark:text-emerald-400"
                : "bg-red-500/10 border-red-500/30 text-red-500 dark:text-red-400"
            }`}
          >
            {star[key] ? "✓" : "✗"} {label}
          </span>
        ))}
      </div>
    </div>
  );
}

const DECISIONS = {
  yes:   { label: "Yes — next round", icon: "✅", cls: "border-emerald-500/30 text-emerald-500 dark:text-emerald-400" },
  maybe: { label: "Maybe",            icon: "🤔", cls: "border-amber-500/30 text-amber-500 dark:text-amber-400" },
  no:    { label: "Not yet",          icon: "✋", cls: "border-red-500/30 text-red-500 dark:text-red-400" },
};

// "Would a recruiter invite you to the next round?"
function HiringDecision({ decision }) {
  const d = decision && DECISIONS[decision.decision];
  if (!d) return null;
  return (
    <div className={`rounded-2xl border p-4 ${d.cls.split(" ")[0]}`}>
      <p className="text-slate-600 dark:text-slate-400 text-xs font-bold uppercase tracking-widest mb-1.5">
        Would a recruiter invite you to the next round?
      </p>
      <p className={`text-lg font-black mb-1 ${d.cls.split(" ").slice(1).join(" ")}`}>
        {d.icon} {d.label}
      </p>
      <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">{decision.reason}</p>
    </div>
  );
}

// Block 1: the one score, the recruiter's decision and the main takeaways
function SummaryCard({ debrief }) {
  return (
    <div
      className="glass border border-slate-200 dark:border-slate-700/40 rounded-3xl p-5 sm:p-8 space-y-6 animate-fade-up"
      style={{ animationDelay: "0.05s", boxShadow: "0 0 60px rgba(16,185,129,0.08)" }}
    >
      <div className="flex flex-col sm:flex-row items-center gap-6">
        <OverallScoreBadge score={debrief.overall_score} />
        <div className="flex-1 w-full space-y-4">
          <HiringDecision decision={debrief.hiring_decision} />
          <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">{debrief.summary}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <p className="text-emerald-500 dark:text-emerald-400 text-xs font-bold uppercase tracking-widest mb-2">
            🏆 Top Strength
          </p>
          <p className="text-slate-700 dark:text-slate-200 text-sm leading-relaxed">{debrief.top_strength}</p>
        </div>
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
          <p className="text-amber-500 dark:text-amber-400 text-xs font-bold uppercase tracking-widest mb-2">
            🎯 Top Improvement
          </p>
          <p className="text-slate-700 dark:text-slate-200 text-sm leading-relaxed">{debrief.top_improvement}</p>
        </div>
      </div>
    </div>
  );
}

function scoreTone(score) {
  return score >= 8
    ? { border: "border-emerald-500/40 hover:border-emerald-500/70", text: "text-emerald-500 dark:text-emerald-400" }
    : score >= 5
      ? { border: "border-amber-500/40 hover:border-amber-500/70", text: "text-amber-500 dark:text-amber-400" }
      : { border: "border-red-500/40 hover:border-red-500/70", text: "text-red-500 dark:text-red-400" };
}

// Block 2: one tile per question; clicking opens the full breakdown
function AnswerTile({ item, index, onOpen }) {
  const tone = scoreTone(item.score);
  return (
    <button
      onClick={onOpen}
      className={`glass border ${tone.border} rounded-2xl p-4 text-left flex flex-col gap-2 transition-all hover:-translate-y-0.5 hover:shadow-lg animate-fade-up`}
      style={{ animationDelay: `${0.1 + index * 0.05}s` }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold uppercase tracking-widest text-slate-500">
          Q{index + 1}
          {item.followup_question && (
            <span className="ml-2 normal-case tracking-normal font-semibold text-slate-400">· follow-up</span>
          )}
        </span>
        <span className={`text-xl font-black ${tone.text}`}>{to100(item.score)}</span>
      </div>
      <p className="text-slate-700 dark:text-slate-200 text-sm font-semibold leading-snug line-clamp-3">
        {item.question}
      </p>
      {item.competency && (
        <p className="text-xs text-slate-500 line-clamp-1">Tests: {item.competency}</p>
      )}
      <div className="mt-auto pt-1 flex items-center justify-between gap-2">
        {item.star ? (
          <span className="flex gap-1" title="STAR structure">
            {STAR_PARTS.map(({ key, label }) => (
              <span
                key={key}
                className={`w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center ${
                  item.star[key]
                    ? "bg-emerald-500 text-white"
                    : "bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600"
                }`}
              >
                {label[0]}
              </span>
            ))}
          </span>
        ) : (
          <span />
        )}
        {item.retries?.length > 0 ? (
          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            🔄 best {to100(Math.max(...item.retries.map((r) => r.score ?? 0)))}
          </span>
        ) : (
          <span className="text-xs font-semibold text-slate-500">Open →</span>
        )}
      </div>
    </button>
  );
}

// Your later attempts at this question, newest first, compared with the interview answer
function RetryAttempts({ retries, originalScore }) {
  if (!retries?.length) return null;
  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-600 dark:text-slate-400 font-semibold">
        Your retries ({retries.length})
      </p>
      {retries
        .map((r, i) => ({ ...r, number: i + 1 }))
        .reverse()
        .map((r) => {
          const diff = r.score != null && originalScore != null ? r.score - originalScore : null;
          return (
            <details
              key={r.number}
              className="group bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800/60"
            >
              <summary className="flex items-center gap-3 p-3 cursor-pointer list-none">
                {r.score != null && <ScoreBadge score={r.score} />}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    Attempt {r.number}
                    {diff != null && diff !== 0 && (
                      <span className={`ml-2 ${diff > 0 ? "text-emerald-500" : "text-red-500"}`}>
                        {diff > 0 ? "+" : ""}
                        {to100(diff)} vs interview
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-slate-500 truncate">{r.answer}</p>
                </div>
                <span className="text-xs text-slate-400 group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <div className="px-3 pb-3 space-y-2 text-sm leading-relaxed">
                <p className="text-slate-600 dark:text-slate-300">
                  <span className="font-semibold">What you said: </span>
                  {r.answer}
                </p>
                {r.feedback && <p className="text-slate-600 dark:text-slate-300">{r.feedback}</p>}
                {r.tip && <p className="text-emerald-600 dark:text-emerald-300/90">💡 {r.tip}</p>}
              </div>
            </details>
          );
        })}
    </div>
  );
}

// Everything about one answer, shown in the modal
function AnswerDetail({ item, index, interviewerName, onRetry }) {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="text-xs text-emerald-500 dark:text-emerald-400/80 font-bold uppercase tracking-widest mb-1.5">
            Question {index + 1}
          </p>
          <p className="text-slate-800 dark:text-slate-100 font-semibold leading-relaxed">{item.question}</p>
          {item.competency && <p className="text-xs text-slate-500 mt-1">Tests: {item.competency}</p>}
        </div>
        <ScoreBadge score={item.score} />
      </div>

      <ScoreBreakdown scores={item.scores} />
      <StarChecklist star={item.star} />

      {item.followup_question && (
        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
          <span className="font-semibold">↪ {interviewerName} asked a follow-up:</span> “{item.followup_question}”
        </p>
      )}

      <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-4 border border-slate-200 dark:border-slate-800/60">
        <p className="text-xs text-slate-600 dark:text-slate-400 font-semibold mb-1.5">What you said</p>
        <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">{item.answer_summary}</p>
      </div>

      <div>
        <p className="text-xs text-slate-600 dark:text-slate-400 font-semibold mb-1.5">Feedback</p>
        <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">{item.feedback}</p>
      </div>

      <div className="bg-emerald-500/8 border border-emerald-500/20 rounded-2xl p-4">
        <p className="text-xs text-emerald-500 dark:text-emerald-400 font-bold mb-1.5">💡 Tip</p>
        <p className="text-slate-700 dark:text-emerald-200/90 text-sm leading-relaxed">{item.tip}</p>
      </div>

      {item.ideal_answer && (
        <div className="bg-amber-500/8 border border-amber-500/20 rounded-2xl p-4">
          <p className="text-xs text-amber-500 dark:text-amber-400 font-bold mb-1.5">⭐ Your answer, improved (90/100)</p>
          <p className="text-slate-700 dark:text-amber-200/90 text-sm leading-relaxed">{item.ideal_answer}</p>
          {item.ideal_answer.includes("[") && (
            <p className="text-xs text-amber-600 dark:text-amber-400/70 mt-2">
              Replace the [brackets] with your own real details.
            </p>
          )}
        </div>
      )}

      {item.analytics && <SpeechAnalyticsPanel analytics={item.analytics} />}

      <RetryAttempts retries={item.retries} originalScore={item.score} />

      {onRetry && (
        <button
          onClick={onRetry}
          className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white rounded-2xl text-sm font-bold transition-all shadow-md shadow-emerald-500/25"
        >
          🔄 Try this question again
        </button>
      )}
    </div>
  );
}

function AnswerModal({ answers, index, interviewerName, onClose, onNavigate, onRetry }) {
  const item = answers[index];
  const hasPrev = index > 0;
  const hasNext = index < answers.length - 1;

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft" && hasPrev) onNavigate(index - 1);
      else if (e.key === "ArrowRight" && hasNext) onNavigate(index + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, hasPrev, hasNext, onClose, onNavigate]);

  const navCls =
    "px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700/50 text-slate-600 dark:text-slate-300 hover:border-emerald-500/40 disabled:opacity-30 disabled:cursor-not-allowed transition-all";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4"
      style={{ background: "rgba(2,6,23,0.8)", backdropFilter: "blur(10px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] flex flex-col glass bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700/50 rounded-3xl shadow-2xl animate-fade-up"
        style={{ animationDuration: "0.2s" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 px-4 sm:px-6 py-3 border-b border-slate-200 dark:border-slate-700/40">
          <div className="flex items-center gap-2">
            <button className={navCls} disabled={!hasPrev} onClick={() => onNavigate(index - 1)}>← Prev</button>
            <span className="text-xs text-slate-500 font-semibold">
              {index + 1} / {answers.length}
            </span>
            <button className={navCls} disabled={!hasNext} onClick={() => onNavigate(index + 1)}>Next →</button>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 text-lg"
          >
            ×
          </button>
        </div>
        <div className="overflow-y-auto px-4 sm:px-6 py-5">
          <AnswerDetail item={item} index={index} interviewerName={interviewerName} onRetry={() => onRetry(index)} />
        </div>
      </div>
    </div>
  );
}

// Right column: how you spoke and came across — always visible next to the answers
function DeliveryPanel({ children }) {
  return (
    <aside className="space-y-4 lg:sticky lg:top-6 animate-fade-up" style={{ animationDelay: "0.15s" }}>
      <div>
        <h2 className="text-slate-900 dark:text-white font-black text-xl">How you spoke</h2>
        <p className="text-slate-500 text-xs mt-0.5">Pace, filler words, body language and your recording</p>
      </div>
      {children}
    </aside>
  );
}

function OverallSpeechSummary({ qaPairs, sessionDuration }) {
  const withAnalytics = qaPairs.filter((p) => p.analytics);
  if (!withAnalytics.length) return null;

  const avgWpm = Math.round(
    withAnalytics
      .filter((p) => p.analytics.wpm > 0)
      .reduce((s, p) => s + p.analytics.wpm, 0) /
      (withAnalytics.filter((p) => p.analytics.wpm > 0).length || 1),
  );
  const totalFillers = withAnalytics.reduce(
    (s, p) => s + (p.analytics.totalFillers || 0),
    0,
  );
  const totalDuration = withAnalytics.reduce(
    (s, p) => s + (p.analytics.durationSeconds || 0),
    0,
  );
  const allFillerCounts = {};
  withAnalytics.forEach((p) =>
    Object.entries(p.analytics.fillerCounts || {}).forEach(([w, c]) => {
      allFillerCounts[w] = (allFillerCounts[w] || 0) + c;
    }),
  );
  const topFiller = Object.entries(allFillerCounts).sort(
    (a, b) => b[1] - a[1],
  )[0];

  const stats = [
    { value: avgWpm || "—", label: "Avg. wpm", color: wpmColor(avgWpm) },
    {
      value: totalFillers,
      label: "Total fillers",
      color:
        totalFillers === 0
          ? "text-emerald-400"
          : totalFillers <= 5
            ? "text-yellow-400"
            : "text-red-400",
    },
    {
      value: durationLabel(totalDuration),
      label: "Talk time",
      color: "text-slate-200",
    },
    {
      value: topFiller ? `"${topFiller[0]}"` : "—",
      label: "Top filler",
      color: "text-orange-400",
    },
    ...(sessionDuration > 0
      ? [
          {
            value: durationLabel(sessionDuration),
            label: "Session time",
            color: "text-slate-200",
          },
        ]
      : []),
  ];

  return (
    <div
      className="glass border border-slate-200 dark:border-slate-700/40 rounded-3xl p-5 space-y-4"
    >
      <p className="text-slate-900 dark:text-white font-bold text-lg">🗣 Speech Performance</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-3 gap-3 lg:gap-2">
        {stats.map((s, i) => (
          <div
            key={i}
            className="bg-slate-100 dark:bg-slate-900/60 rounded-2xl p-4 lg:px-2 lg:py-3 text-center animate-stat-in"
            style={{ animationDelay: `${i * 0.07}s` }}
          >
            <p className={`text-2xl lg:text-lg font-black ${s.color}`}>{s.value}</p>
            <p className="text-slate-600 dark:text-slate-400 text-xs mt-1">{s.label}</p>
          </div>
        ))}
      </div>
      {totalFillers === 0 && (
        <p className="text-emerald-400 text-sm font-medium">
          ✨ Zero filler words — excellent verbal discipline!
        </p>
      )}
    </div>
  );
}

function BodyLanguageCard({ metrics }) {
  if (!metrics || metrics.samplesCount < 30) return null;

  const eyePct = metrics.eyeContactPct;
  const headPct = metrics.headStabilityPct;

  const eyeColor =
    eyePct >= 70
      ? "bg-emerald-500"
      : eyePct >= 40
        ? "bg-amber-400"
        : "bg-red-500";
  const headColor =
    headPct >= 70
      ? "bg-emerald-500"
      : headPct >= 40
        ? "bg-amber-400"
        : "bg-red-500";
  const tip =
    eyePct < 50
      ? `Try to keep your eyes on the camera — you maintained eye contact only ${eyePct}% of the time.`
      : headPct < 50
        ? `Work on keeping your head still and upright — steady posture reads as more confident.`
        : `Strong body language overall — consistent eye contact and stable posture.`;

  return (
    <div className="glass border border-slate-200 dark:border-slate-700/40 rounded-3xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-slate-900 dark:text-white font-bold text-lg">👁 Body Language</p>
        <span className="text-xs text-slate-500">whole interview</span>
      </div>
      <div className="space-y-3">
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-600 dark:text-slate-400 font-semibold">Eye Contact</span>
            <span className={eyePct >= 70 ? "text-emerald-400" : eyePct >= 40 ? "text-amber-400" : "text-red-400"}>{eyePct}%</span>
          </div>
          <div className="h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-700 ${eyeColor}`} style={{ width: `${eyePct}%` }} />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-600 dark:text-slate-400 font-semibold">Head Stability</span>
            <span className={headPct >= 70 ? "text-emerald-400" : headPct >= 40 ? "text-amber-400" : "text-red-400"}>{headPct}%</span>
          </div>
          <div className="h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-700 ${headColor}`} style={{ width: `${headPct}%` }} />
          </div>
        </div>
      </div>
      <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed border-t border-slate-200 dark:border-slate-700/40 pt-3">{tip}</p>
    </div>
  );
}

export default function Debrief({
  qaPairs,
  role,
  difficulty,
  interviewType,
  language = "en-US",
  questionPlan = [],
  requirements = [],
  cvSummary = null,
  interviewer,
  duration,
  faceMetrics,
  recording,
  onRetry,
  // A session reopened from Sessions: { id, createdAt, debrief }. Nothing is regenerated.
  saved = null,
  onBack,
}) {
  const [debrief, setDebrief] = useState(saved?.debrief || null);
  const [loading, setLoading] = useState(!saved);
  const [error, setError] = useState("");
  const [retryQ, setRetryQ] = useState(null);
  const [openIndex, setOpenIndex] = useState(null);
  const interviewerName = getInterviewer(interviewer).name;
  const savedToDB = useRef(Boolean(saved));
  // Resolves to the saved session's id (or null), so retries can be stored with it
  const sessionIdRef = useRef(Promise.resolve(saved?.id ?? null));
  const sessionDate = new Date(saved?.createdAt || Date.now()).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  // React runs effects twice in development; one debrief request is enough (and a
  // second, failing one could replace a good result with an error screen)
  const requestedRef = useRef(Boolean(saved));

  useEffect(() => {
    if (requestedRef.current) return;
    requestedRef.current = true;
    const fetchDebrief = async () => {
      try {
        // :one: Clean Q/A pairs and prevent empty payload
        // Each pair carries the follow-up exchange (if any) and the question's hidden rubric
        const cleanPairs = qaPairs
          .map(({ question, answer, first_answer, followup_question }, i) => ({
            question: question || "",
            answer: answer || "",
            first_answer: first_answer || null,
            followup_question: followup_question || null,
            competency: questionPlan[i]?.competency || null,
            strong_answer: questionPlan[i]?.strong_answer || null,
          }))
          .filter((p) => p.question && p.answer);

        if (cleanPairs.length === 0) {
          setError("No valid answers found.");
          setLoading(false);
          return;
        } // :two: Normalize language (backend expects en-US, de-DE, fr-FR)

        const normalizedLang = language.includes("-")
          ? language
          : `${language}-US`; // :three: Ensure role is always a string (backend requires it)

        const safeRole = role || "General";

        const res = await fetch(`${BACKEND_URL}/debrief`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${getStoredToken()}` },
          body: JSON.stringify({
            qa_pairs: cleanPairs,
            role: safeRole,
            language: normalizedLang,
            difficulty,
            interview_type: interviewType,
            requirements,
            cv_summary: cvSummary,
          }),
        });

        if (!res.ok) throw new Error("Failed to get debrief");

        const data = await res.json();

        if (data.answers) {
          data.answers = data.answers.map((a, i) => ({
            ...a,
            analytics: qaPairs[i]?.analytics || null,
            followup_question: qaPairs[i]?.followup_question || null,
            competency: questionPlan[i]?.competency || null,
          }));
        }

        setDebrief(data);

        if (!savedToDB.current) {
          savedToDB.current = true;
          sessionIdRef.current = saveSessionToDB(
            data,
            qaPairs,
            safeRole,
            difficulty,
            interviewType,
            duration,
            {
              faceMetrics: faceMetrics,
              language: normalizedLang,
              // Everything this screen needs to be shown again from Sessions
              report: {
                debrief: data,
                qa_pairs: qaPairs,
                question_plan: questionPlan,
                interviewer,
                face_metrics: faceMetrics,
                interview_type: interviewType,
                language: normalizedLang,
                duration,
              },
            },
          );
          // The video stays in this browser, stored under the new session's id
          if (recording) {
            sessionIdRef.current.then(async (id) => {
              if (id) saveRecording(id, await (await fetch(recording)).blob());
            });
          }
        }
      } catch {
        setError(
          "Something went wrong generating your feedback. Please try again.",
        );
      } finally {
        setLoading(false);
      }
    };

    fetchDebrief();
  }, [qaPairs, role, difficulty, duration]);

  // A retry from the answer modal: show it under that answer and keep it with the session
  const handleRetryResult = useCallback((index, retry) => {
    const attempt = { ...retry, created_at: new Date().toISOString() };
    setDebrief((d) => ({
      ...d,
      answers: d.answers.map((a, i) =>
        i === index ? { ...a, retries: [...(a.retries || []), attempt] } : a,
      ),
    }));
    sessionIdRef.current.then((id) => id && saveRetry(id, index, retry));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen dark:bg-slate-950 flex flex-col items-center justify-center gap-6 relative overflow-hidden">
        <BgOrbs />
        <div className="relative z-10 flex flex-col items-center gap-4">
          <div className="relative w-20 h-20">
            <div className="absolute inset-0 rounded-full border-4 border-emerald-500/20 animate-ping" />
            <div className="w-20 h-20 rounded-full border-4 border-slate-800 border-t-emerald-500 animate-spin" />
          </div>
          <p className="text-slate-600 dark:text-slate-300 text-xl font-bold">
            Preparing your feedback...
          </p>
          <p className="text-slate-600 dark:text-slate-400 text-sm">
            Analysing content &amp; speech patterns
          </p>
        </div>
      </div>
    );
  }

  const hasDelivery =
    qaPairs.some((p) => p.analytics) ||
    (faceMetrics && faceMetrics.samplesCount >= 30) ||
    Boolean(recording);

  if (error) {
    return (
      <div className="min-h-screen dark:bg-slate-950 flex flex-col items-center justify-center gap-4 px-4 relative overflow-hidden">
        <BgOrbs />
        <div className="relative z-10 glass border border-red-500/25 rounded-3xl p-8 text-center max-w-md">
          <p className="text-4xl mb-4">😕</p>
          <p className="text-red-400 mb-5">{error}</p>
          <button
            onClick={onBack || onRetry}
            className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold px-8 py-3 rounded-2xl transition-all hover:scale-105 shadow-lg shadow-emerald-500/30"
          >
            {onBack ? "← Back to sessions" : "← Back to dashboard"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen dark:bg-slate-950 py-6 sm:py-10 px-3 sm:px-4 relative overflow-clip">
      <BgOrbs />

      <div
        className={`relative z-10 mx-auto space-y-6 ${hasDelivery ? "max-w-6xl" : "max-w-3xl"}`}
      >
        {/* Hero */}
        {onBack && (
          <button
            onClick={onBack}
            className="text-sm font-semibold text-slate-500 hover:text-emerald-500 transition-colors"
          >
            ← Back to sessions
          </button>
        )}
        <div className="text-center animate-fade-up">
          <p className="text-emerald-400 text-sm font-bold uppercase tracking-widest mb-2">
            {saved ? `Session · ${sessionDate}` : "✅ Interview Complete"}
          </p>
          <h1 className="text-4xl font-black text-slate-900 dark:text-white mb-2">
            Your Interview Feedback
          </h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm">
            {role} ·{" "}
            <span className="text-slate-600 dark:text-slate-400">{difficulty || "Mid"} level</span>
          </p>
        </div>

        <div className={hasDelivery ? "grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_400px] gap-6 items-start" : ""}>
        <div className="space-y-6 min-w-0">
        {/* Block 1: one score, recruiter decision, main takeaways */}
        <SummaryCard debrief={debrief} />

        {/* Block 2: one tile per question */}
        <div>
          <div className="flex items-end justify-between gap-3 mb-3 animate-fade-up" style={{ animationDelay: "0.1s" }}>
            <h2 className="text-slate-900 dark:text-white font-black text-xl">Your answers</h2>
            <p className="text-slate-500 text-xs">Click a question to see the full feedback</p>
          </div>
          <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3 ${hasDelivery ? "2xl:grid-cols-3" : "lg:grid-cols-3"}`}>
            {debrief.answers.map((item, i) => (
              <AnswerTile key={i} item={item} index={i} onOpen={() => setOpenIndex(i)} />
            ))}
          </div>
        </div>

        </div>

        {/* Right column: delivery — speech, body language, recording */}
        {hasDelivery && (
          <DeliveryPanel>
            <OverallSpeechSummary qaPairs={qaPairs} sessionDuration={duration} />
            <BodyLanguageCard metrics={faceMetrics} />
            {saved && !recording && (
              <p className="text-xs text-slate-500 leading-relaxed px-1">
                🎥 No recording in this browser: videos are kept only on the device where you did the interview.
              </p>
            )}
            {recording && (
              <div className="glass border border-slate-200 dark:border-slate-700/40 rounded-3xl p-5 space-y-4">
                <div>
                  <p className="text-slate-900 dark:text-white font-bold text-lg">
                    🎥 Interview Recording
                  </p>
                  <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">
                    Review your webcam recording from this interview session.
                  </p>
                </div>

                <video
                  src={recording}
                  controls
                  className="w-full rounded-2xl border border-slate-700/50 bg-black"
                />

                <a
                  href={recording}
                  download={`MockMate-recording-${new Date(saved?.createdAt || Date.now()).toISOString().slice(0, 10)}.webm`}
                  className="inline-flex items-center justify-center gap-2 glass-light border border-slate-200 dark:border-slate-700/50 hover:border-emerald-500/40 text-slate-600 dark:text-slate-300 hover:text-emerald-400 font-semibold px-5 py-3 rounded-2xl transition-all"
                >
                  ⬇️ Download Recording
                </a>
              </div>
            )}
          </DeliveryPanel>
        )}
        </div>
      </div>

      {/* Leave the debrief: to the dashboard, or back to the list for a saved session */}
      <div className={`relative z-10 mx-auto mt-10 flex flex-col sm:flex-row ${hasDelivery ? "max-w-6xl" : "max-w-3xl"} flex-wrap items-stretch sm:items-center justify-center gap-3 pb-10 px-4 sm:px-0`}>
        <button
          onClick={onBack || onRetry}
          className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold px-10 py-3.5 rounded-2xl transition-all hover:scale-105 shadow-xl shadow-emerald-500/30 hover:shadow-emerald-500/50"
        >
          {onBack ? "← Back to sessions" : "← Back to dashboard"}
        </button>
      </div>

      {/* Answer breakdown modal */}
      {openIndex != null && debrief.answers[openIndex] && (
        <AnswerModal
          interviewerName={interviewerName}
          answers={debrief.answers}
          index={openIndex}
          onClose={() => setOpenIndex(null)}
          onNavigate={setOpenIndex}
          onRetry={(i) => {
            const item = debrief.answers[i];
            setOpenIndex(null);
            setRetryQ({
              index: i,
              question: item.question,
              originalScore: item.score,
              competency: item.competency,
              strongAnswer: questionPlan[i]?.strong_answer,
            });
          }}
        />
      )}

      {/* Retry modal */}
      {retryQ && (
        <RetryModal
          interviewer={interviewer}
          question={retryQ.question}
          originalScore={retryQ.originalScore}
          role={role}
          difficulty={difficulty}
          language={language}
          competency={retryQ.competency}
          strongAnswer={retryQ.strongAnswer}
          onResult={(retry) => handleRetryResult(retryQ.index, retry)}
          onClose={() => {
            // Back to the answer, where the new attempt now shows up
            setOpenIndex(retryQ.index);
            setRetryQ(null);
          }}
        />
      )}
    </div>
  );
}
