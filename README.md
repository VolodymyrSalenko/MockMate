# MockMate — AI Voice Interview Simulator

Practice job interviews with an AI voice interviewer. Paste a job description, answer 5 questions by voice, and receive a fully scored debrief.

## What It Does

1. User pastes a job description
2. Backend generates 5 tailored interview questions (2 behavioral, 2 technical, 1 motivation)
3. AI interviewer "Alex" speaks questions aloud using the browser's built-in SpeechSynthesis API
4. User answers by voice using push-to-talk (button or spacebar)
5. Speech-to-text via Web Speech API (browser built-in, free)
6. Claude Haiku responds as the interviewer with follow-up or the next question
7. Final debrief shows per-answer scores, feedback, tips, and an overall summary

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + Tailwind CSS (Vite) |
| Backend | FastAPI (Python) |
| LLM | Claude Haiku (`claude-haiku-4-5-20251001`) |
| STT | Web Speech API — browser built-in, **free** |
| TTS | SpeechSynthesis API — browser built-in, **free** |
| State | In-memory (no database) |
| Auth | None |

## Setup

### Backend

```bash
cd mockmate/backend
pip install -r requirements.txt
cp .env.example .env
# Edit .env and set your ANTHROPIC_API_KEY
```

### Frontend

```bash
cd mockmate/frontend
npm install
cp .env.example .env
# Edit .env — set VITE_BACKEND_URL=http://localhost:8000
```

## Run Locally

**Terminal 1 — Backend:**
```bash
cd mockmate/backend
uvicorn main:app --reload
```

**Terminal 2 — Frontend:**
```bash
cd mockmate/frontend
npm run dev
```

Open `http://localhost:5173` in Chrome.

## Environment Variables

Only one API key is needed:

| Variable | Where | Value |
|----------|-------|-------|
| `ANTHROPIC_API_KEY` | `backend/.env` | Your Anthropic API key |
| `VITE_BACKEND_URL` | `frontend/.env` | `http://localhost:8000` (or deployed URL) |

## Deploy

**Backend → Render (free tier)**
- Service type: Web Service
- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- Add env var: `ANTHROPIC_API_KEY`

**Frontend → Vercel (free tier)**
- Framework: Vite
- Root directory: `mockmate/frontend`
- Add env var: `VITE_BACKEND_URL=https://your-render-service.onrender.com`

## Cost

- **$0** — STT, TTS, and state management use free browser APIs
- **~$0.001–0.003 per interview** — Claude Haiku only, with history trimming to last 6 messages
