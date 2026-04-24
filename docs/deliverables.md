# MockMate — Solo Project Deliverables
### Design Sprint · Prototype & Validate Week · Due April 27, 2026

---

## 1. Problem Statement

> **Problem Title:** AI-Powered Interview Practice Coach

| Field | Detail |
|---|---|
| **Context / Background** | Job seekers preparing for interviews have two realistic options: pay a career coach ($100–300/hr), or ask a friend to run a mock session — which is awkward, inconsistent, and rarely available on demand. Online prep tools (LeetCode, Glassdoor Q&A, ChatGPT prompts) give static content but no real conversational practice. |
| **The Problem** | There is no low-cost, voice-driven tool that simulates a real interview conversation — questions tailored to a specific job description, spoken aloud by an AI, with the candidate answering by voice — and then delivers scored, actionable feedback. |
| **Evidence / Data** | ~75% of job seekers report that lack of realistic practice is their top reason for underperforming in interviews (LinkedIn Talent Trends, 2023). The global interview prep market is valued at $2.4B and growing 8% YoY, yet is dominated by expensive human coaches. |
| **Impact** | Primarily affects junior and mid-level candidates, career switchers, and international candidates who face language/culture gaps. Secondary impact: hiring managers receive less-prepared candidates, increasing time-to-hire and cost. |
| **Objectives / Goal** | A user can complete a realistic, voice-based mock interview tailored to any job description, and receive a fully scored debrief with per-answer feedback — all in under 15 minutes, at near-zero cost (~$0.001–0.003 per session). |

---

## 2. Lean Canvas

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                              MOCKMATE — LEAN CANVAS                              │
├─────────────────────┬───────────────────────┬────────────────────────────────────┤
│  PROBLEM            │  SOLUTION             │  UNIQUE VALUE PROPOSITION          │
│                     │                       │                                    │
│  1. No affordable   │  AI voice interviewer │  The only free, voice-first        │
│  voice mock         │  ("Alex") tailored    │  mock interview tool that          │
│  interview tool     │  to any JD + CV       │  adapts to YOUR job description    │
│                     │                       │  and scores your actual answers    │
│  2. Generic Q&A     │  5 custom questions   │                                    │
│  doesn't match      │  → voice STT answers  │                                    │
│  real interviews    │  → scored debrief     │                                    │
│                     │                       │                                    │
│  3. Human coaches   │  PDF export of        │                                    │
│  are too expensive  │  feedback report      │                                    │
├─────────────────────┼───────────────────────┼────────────────────────────────────┤
│  UNFAIR ADVANTAGE   │  KEY METRICS          │  CHANNELS                          │
│                     │                       │                                    │
│  Zero-cost STT/TTS  │  • Sessions/day       │  • GitHub (open source)            │
│  using browser APIs │  • Avg session score  │  • LinkedIn / Twitter share        │
│  (no Whisper, no    │  • Time-to-debrief    │  • Bootcamp / university           │
│  ElevenLabs cost)   │  • Return user rate   │    communities                     │
│                     │  • Cost per session   │  • Word of mouth                   │
├─────────────────────┴───────────────────────┼────────────────────────────────────┤
│  CUSTOMER SEGMENTS                          │  COST STRUCTURE                    │
│                                             │                                    │
│  Primary: Junior/mid devs applying for      │  • Claude Haiku API: ~$0.002/      │
│  first or next role                         │    session (only cost)             │
│                                             │  • Render (backend): Free tier     │
│  Secondary: Career switchers, bootcamp      │  • Vercel (frontend): Free tier    │
│  grads, international candidates            │  • STT + TTS: $0 (browser APIs)   │
│                                             │                                    │
│  REVENUE STREAMS                            │                                    │
│  MVP: Free. Future: freemium (unlimited     │                                    │
│  sessions, team plans, company branding)    │                                    │
└─────────────────────────────────────────────┴────────────────────────────────────┘
```

---

## 3. User Empathy Map

**User Persona: "Amir" — Mid-level developer, 3 YOE, applying for his first senior role**

```
┌──────────────────────────────────────────────────────────────┐
│                     USER EMPATHY MAP                         │
├──────────────────────────┬───────────────────────────────────┤
│  THINKS & FEELS          │  SAYS & DOES                      │
│                          │                                   │
│  "What if they ask       │  Reads job descriptions 3x.       │
│  something I don't       │  Googles 'top interview           │
│  know?"                  │  questions for [role]'.           │
│                          │  Asks ChatGPT to quiz him but     │
│  "I know the answers     │  types — doesn't speak.           │
│  but freeze up           │                                   │
│  out loud."              │  Books 1 session with a           │
│                          │  career coach then cancels        │
│  "Prep tools feel        │  because it's $200.               │
│  robotic and generic."   │                                   │
│                          │  Practices in the mirror but      │
│  Anxious about           │  has no one to give feedback.     │
│  sounding confident.     │                                   │
├──────────────────────────┼───────────────────────────────────┤
│  PAINS                   │  GAINS (what they want)           │
│                          │                                   │
│  • No realistic voice    │  • Hear real questions out loud   │
│    practice available    │  • Answer by speaking, not typing │
│                          │  • Know where they scored low     │
│  • Generic questions     │  • Actionable tips per answer     │
│    don't match the JD    │  • Confidence from repetition     │
│                          │  • PDF they can review next day   │
│  • Human feedback is     │                                   │
│    expensive and rare    │                                   │
│                          │                                   │
│  • Can't hear how        │                                   │
│    they sound            │                                   │
└──────────────────────────┴───────────────────────────────────┘
```

---

## 4. Manual Mockup / Sketch

> **Note:** A hand-drawn version of this exists on paper/whiteboard. Below is the wireframe description for reference.

**Screen 1 — Landing / Setup**
```
┌──────────────────────────────────────────┐
│  🎙 MockMate                             │
│  ─────────────────────────────────────── │
│  [ Paste Job Description here...       ] │
│  [ Upload CV (optional)        ] [📎]    │
│  Difficulty:  ○ Junior  ● Mid  ○ Senior  │
│  Type: [Full Interview ▼]                │
│  Company: [Optional...]                  │
│  ─────────────────────────────────────── │
│          [ Start Interview → ]           │
└──────────────────────────────────────────┘
```

**Screen 2 — Live Interview**
```
┌──────────────────────────────────────────┐
│  Question 2 of 5                         │
│  ─────────────────────────────────────── │
│  Alex 🎙 "Tell me about a time you       │
│  led a project under tight deadlines."   │
│  ─────────────────────────────────────── │
│  [ Hold SPACE or button to speak ]       │
│  ● Recording...  ████████░░░░            │
│  ─────────────────────────────────────── │
│  Your answer: "In my last role at..."    │
└──────────────────────────────────────────┘
```

**Screen 3 — Debrief**
```
┌──────────────────────────────────────────┐
│  Interview Complete — Overall: 7.4/10    │
│  ─────────────────────────────────────── │
│  Q1: "Tell me about yourself"            │
│  Score: 8/10  ████████░░                 │
│  Feedback: Clear and structured. Add     │
│  a stronger closing hook.                │
│  Tip: End with "and that's why I'm       │
│  excited about this role."               │
│  ─────────────────────────────────────── │
│  Q2 ... Q3 ... Q4 ... Q5 ...            │
│  ─────────────────────────────────────── │
│  Top Strength: Concrete examples         │
│  Top Improvement: Answer length          │
│  ─────────────────────────────────────── │
│  [ Download PDF Report ]                 │
└──────────────────────────────────────────┘
```

---

## 5. Technical Blueprint

```
INPUT
  │
  ├─ Job Description (text)
  ├─ CV / Resume (PDF, DOCX, TXT — optional)
  ├─ Difficulty (Junior / Mid / Senior)
  ├─ Interview Type (Full / Behavioral / Technical / Screening)
  └─ Company Name (optional)
  │
  ▼
REACT FRONTEND (Vite)
  │
  │  POST /extract-cv  ──────────────────────────────────┐
  │  POST /parse-jd                                      │
  ▼                                                      ▼
FASTAPI BACKEND (Python)                         pdfplumber / python-docx
  │                                              extracts CV text → trimmed
  │  Builds prompt from JD + CV + difficulty             │
  │  + interview type + company context                  │
  ▼                                                      │
OPENROUTER API  ──────────────────────────────────────────┘
  │  Model: claude-haiku-4-5
  │  Returns: { role, questions[5], candidate_name }
  ▼
FASTAPI → REACT
  │
  ▼
BROWSER — SpeechSynthesis API (TTS)
  │  "Alex" speaks Question 1 aloud
  ▼
USER SPEAKS ANSWER
  │
  ▼
BROWSER — Web Speech API (STT)
  │  Transcribes voice → text (free, Chrome built-in)
  │
  ├─ Answer < 20 words?
  │    └─ POST /respond → Claude generates follow-up prompt
  │
  └─ Answer OK?
       └─ POST /respond → Claude acknowledges + speaks next question
            │
            └─ Repeat for Q2 → Q3 → Q4 → Q5
                    │
                    ▼
              POST /debrief
                    │
              Claude evaluates all 5 Q&A pairs
                    │
              Returns JSON: { answers[5], overall_score, summary,
                              top_strength, top_improvement }
                    │
                    ▼
              REACT renders Debrief UI
                    │
                    └─ jsPDF → export as PDF report

OUTPUT
  └─ Scored debrief: per-answer score (1-10), feedback, tip,
     ideal answer, overall score, summary — downloadable as PDF
```

**Cost per session:** ~$0.001–0.003 (Claude Haiku tokens only). STT + TTS = $0 (browser-native).

---

## 6. Solo Definition of Done (DoD)

### Baseline Requirements (from brief)
- [x] Uses an LLM / AI (Claude Haiku via OpenRouter)
- [x] Solves a real-world problem with a clear user need
- [x] Has a working frontend + backend
- [x] Deployed or runnable locally with clear setup instructions

### MockMate-Specific DoD
- [x] User can paste any job description and generate 5 tailored interview questions
- [x] Questions adapt to difficulty level (Junior / Mid / Senior)
- [x] Questions adapt to interview type (Full / Behavioral / Technical / Screening)
- [x] AI interviewer "Alex" speaks every question aloud (TTS)
- [x] User can answer by voice using push-to-talk (STT — spacebar or button)
- [x] Short answers (<20 words) trigger a follow-up prompt before moving on
- [x] Optional CV upload (PDF, DOCX, TXT) personalises questions to the candidate
- [x] Optional company name tailors questions to company culture / values
- [x] Final debrief scores each answer across 3 dimensions (1–10)
- [x] Debrief includes: per-answer feedback, tip, ideal answer, overall score, summary
- [x] PDF export of the full debrief report
- [x] Entire session costs less than $0.01 in API fees
- [x] Works in Chrome without installation (browser APIs used)
- [x] Question Bank mode for category practice (Behavioral, System Design, SQL, etc.)

### Not in Scope (v1)
- [ ] User accounts / persistent history
- [ ] Safari / Firefox support (Web Speech API is Chrome-only)
- [ ] Real-time audio waveform visualisation
- [ ] Multi-language support

---

## 7. Pitch Deck (Architecture Defense)

---

### Slide 1 — The Problem

**"Practicing interviews out loud is hard and expensive."**

- 75% of candidates say lack of realistic practice is their #1 reason for underperforming
- Career coaches cost $100–300/session — out of reach for most junior candidates
- Existing tools (ChatGPT, Glassdoor) are text-based and generic — not voice, not tailored
- **The gap:** no tool gives you a real conversational, voice-first interview experience for your specific job

---

### Slide 2 — The Solution

**MockMate: Your AI voice interviewer, available 24/7, for ~$0.002.**

1. Paste any job description → get 5 tailored questions in seconds
2. AI interviewer "Alex" speaks to you — you answer by voice
3. Receive a fully scored debrief with per-answer feedback + tips + ideal answers
4. Download a PDF report to review before the real thing

> Demo: [http://localhost:5173](http://localhost:5173)

---

### Slide 3 — Tech Stack & Why

| Layer | Choice | Why |
|---|---|---|
| **LLM** | Claude Haiku (claude-haiku-4-5) | Fastest + cheapest Anthropic model. ~$0.002/session. Real-time response speed matches interview pacing. |
| **STT** | Web Speech API (browser built-in) | **Zero cost.** No Whisper API, no Deepgram. Works natively in Chrome. Trade-off: Chrome-only. |
| **TTS** | SpeechSynthesis API (browser built-in) | **Zero cost.** No ElevenLabs. Natural enough for practice. Trade-off: less expressive than paid TTS. |
| **Backend** | FastAPI (Python) | Async, fast to prototype, clean OpenAI-compatible client for OpenRouter. |
| **Frontend** | React + Vite + Tailwind | Standard, fast dev cycle, easy to iterate on UI. |
| **Hosting** | Render (backend) + Vercel (frontend) | Both free tier. Zero infra cost at MVP scale. |
| **Database** | None (in-memory) | Single-session tool — no persistence needed. Keeps infra at zero. |

---

### Slide 4 — Architecture

```
JD + CV + Settings
      │
   FastAPI  ──►  Claude Haiku  ──►  5 Questions
      │                                  │
      │                          Browser TTS speaks Q
      │                                  │
      │                          User speaks answer
      │                                  │
      │                          Browser STT transcribes
      │                                  │
   FastAPI  ──►  Claude Haiku  ──►  Acknowledgement + Next Q
      │                             (or follow-up if <20 words)
      │
   FastAPI  ──►  Claude Haiku  ──►  Debrief JSON
                                         │
                                   React UI + PDF export
```

**Cost:** STT = $0 · TTS = $0 · Claude Haiku ≈ $0.002/session

---

### Slide 5 — Definition of Done & What's Next

**Shipped (v1):**
- Voice interview tailored to any JD + CV + company
- Difficulty levels (Junior / Mid / Senior)
- Interview types (Full / Behavioral / Technical / Screening)
- Scored debrief + PDF export
- Question Bank mode for category practice

**Next (v2):**
- User accounts + session history
- Deeper CV analysis (personalised scoring feedback)
- Filler word detection ("um", "uh") from transcript
- Mobile support / PWA

---

*Prepared by: Omair Temurian · April 2026*
