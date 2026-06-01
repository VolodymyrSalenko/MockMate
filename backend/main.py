import os
import httpx
from fastapi import FastAPI, HTTPException, UploadFile, File, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional, Any
from openai import OpenAI
from dotenv import load_dotenv
from prompts import (
    INTERVIEWER_SYSTEM_PROMPT,
    DEBRIEF_SYSTEM_PROMPT,
    PARSE_JD_PROMPT,
    DEBRIEF_PROMPT,
    INTERVIEW_TYPE_PROMPTS,
    QUESTION_BANK_PROMPT,
    language_instruction,
)
from helpers import (
    extract_json,
    trim_history,
    trim_to_words,
    chat,
    extract_text_from_pdf,
    extract_text_from_docx,
)
from database import init_db, upsert_user, save_session, get_sessions, get_session_detail
from auth import router as auth_router


load_dotenv()

app = FastAPI(title="MockMate API")


@app.on_event("startup")
def startup():
    try:
        init_db()
    except Exception as e:
        print(f"⚠️  Database init failed (dashboard disabled): {e}")

app.include_router(auth_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=os.getenv("OPENROUTER_API_KEY"),
)
MODEL = "anthropic/claude-haiku-4-5"
MAX_CV_WORDS = 800

DIFFICULTY_INTERVIEW_CONTEXT = {
    "Junior": "This is a junior-level interview. Use accessible, foundational questions. Focus on learning potential, attitude, and clarity of thinking over depth of experience.",
    "Mid":    "This is a mid-level interview. Expect concrete examples from past experience and reasonable technical depth.",
    "Senior": "This is a senior-level interview. Probe deeply — ask for system design thinking, leadership decisions, measurable impact, and strategic choices.",
}

DIFFICULTY_QUESTION_CONTEXT = {
    "Junior": "Keep questions accessible — focus on fundamentals, learning willingness, and simple real-world examples. Avoid jargon-heavy or highly senior topics.",
    "Mid":    "Questions should require concrete examples from past experience and moderate technical knowledge.",
    "Senior": "Questions should probe for senior-level depth: system design, leadership, measurable outcomes, trade-off reasoning, and strategic decisions.",
}


# --- Request models ---

class ParseJDRequest(BaseModel):
    jd_text: str
    cv_text: Optional[str] = None
    difficulty: Optional[str] = "Mid"
    company_name: Optional[str] = None
    interview_type: Optional[str] = "full"
    language: Optional[str] = "en-US"


class QuestionBankRequest(BaseModel):
    category: str
    difficulty: Optional[str] = "Mid"
    language: Optional[str] = "en-US"


class Message(BaseModel):
    role: str
    content: str


class RespondRequest(BaseModel):
    history: List[Message]
    user_answer: str
    current_question_index: int
    questions: List[str]
    role: Optional[str] = "the position"
    cv_summary: Optional[str] = None
    difficulty: Optional[str] = "Mid"
    allow_followup: Optional[bool] = True
    language: Optional[str] = "en-US"


class QAPair(BaseModel):
    question: str
    answer: str


class DebriefRequest(BaseModel):
    qa_pairs: List[QAPair]
    role: Optional[str] = "the position"
    language: Optional[str] = "en-US"


# --- Endpoints ---

@app.post("/extract-cv")
async def extract_cv(file: UploadFile = File(...)):
    filename = file.filename.lower()
    file_bytes = await file.read()

    try:
        if filename.endswith(".pdf"):
            raw_text = extract_text_from_pdf(file_bytes)
        elif filename.endswith(".docx"):
            raw_text = extract_text_from_docx(file_bytes)
        elif filename.endswith(".txt"):
            raw_text = file_bytes.decode("utf-8", errors="ignore")
        else:
            raise HTTPException(status_code=400, detail="Unsupported file type. Use PDF, DOCX, or TXT.")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read file: {str(e)}")

    if not raw_text.strip():
        raise HTTPException(status_code=400, detail="Could not extract text from the file. Try a different format.")

    trimmed = trim_to_words(raw_text, MAX_CV_WORDS)
    return {"cv_text": trimmed, "word_count": len(trimmed.split())}


@app.post("/extract-text")
async def extract_text(file: UploadFile = File(...)):
    filename = file.filename.lower()
    file_bytes = await file.read()
    try:
        if filename.endswith(".pdf"):
            raw_text = extract_text_from_pdf(file_bytes)
        elif filename.endswith(".docx"):
            raw_text = extract_text_from_docx(file_bytes)
        elif filename.endswith(".txt"):
            raw_text = file_bytes.decode("utf-8", errors="ignore")
        else:
            raise HTTPException(status_code=400, detail="Unsupported file type. Use PDF, DOCX, or TXT.")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read file: {str(e)}")

    if not raw_text.strip():
        raise HTTPException(status_code=400, detail="Could not extract text from the file. Try a different format.")

    trimmed = trim_to_words(raw_text, MAX_CV_WORDS)
    return {"text": trimmed, "word_count": len(trimmed.split())}


@app.post("/parse-jd")
async def parse_jd(req: ParseJDRequest):
    if not req.jd_text.strip():
        raise HTTPException(status_code=400, detail="jd_text is required")

    if req.cv_text and req.cv_text.strip():
        cv_section = f"Candidate CV / Resume:\n{req.cv_text.strip()}\n\nUse the candidate's actual experience to personalise the 5 interview questions."
    else:
        cv_section = "No CV provided. Generate generic questions based on the job description only."

    difficulty = req.difficulty or "Mid"
    difficulty_context = DIFFICULTY_QUESTION_CONTEXT.get(difficulty, DIFFICULTY_QUESTION_CONTEXT["Mid"])

    interview_type = req.interview_type or "full"
    interview_type_context = INTERVIEW_TYPE_PROMPTS.get(interview_type, INTERVIEW_TYPE_PROMPTS["full"])

    if req.company_name and req.company_name.strip():
        company_context = (
            f"The company is: {req.company_name.strip()}. "
            "Naturally reference the company name in at least one question. "
            "If you know this company's culture, tech stack, or values, tailor questions accordingly "
            "(e.g. Amazon → Leadership Principles, Google → scalability, startups → wearing many hats)."
        )
    else:
        company_context = ""

    prompt = PARSE_JD_PROMPT.format(
        jd_text=req.jd_text.strip(),
        cv_section=cv_section,
        company_context=company_context,
        difficulty_context=difficulty_context,
        interview_type_context=interview_type_context,
        language_instruction=language_instruction(req.language or "en-US"),
    )

    try:
        raw = chat(client, MODEL, [{"role": "user", "content": prompt}], max_tokens=800)
        data = extract_json(raw)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    role = data.get("role", "the position")
    candidate_name = data.get("candidate_name", "Candidate")
    questions = data.get("questions", [])

    if len(questions) < 5:
        raise HTTPException(status_code=500, detail="Could not generate 5 questions from JD")

    intro_message = data.get("intro_message") or (
        f"Hi{', ' + candidate_name if candidate_name and candidate_name != 'Candidate' else ''}, "
        f"I am Alex, your interviewer today. We are looking for a {role}. "
        f"I will ask you 5 questions. Take your time and speak clearly. "
        f"Here is your first question. {questions[0]}"
    )

    cv_summary = None
    if req.cv_text and req.cv_text.strip():
        cv_summary = trim_to_words(req.cv_text, 200)

    return {
        "role": role,
        "candidate_name": candidate_name,
        "questions": questions[:5],
        "intro_message": intro_message,
        "cv_summary": cv_summary,
    }


@app.post("/question-bank")
async def question_bank(req: QuestionBankRequest):
    if not req.category.strip():
        raise HTTPException(status_code=400, detail="category is required")

    difficulty = req.difficulty or "Mid"
    difficulty_context = DIFFICULTY_QUESTION_CONTEXT.get(difficulty, DIFFICULTY_QUESTION_CONTEXT["Mid"])

    prompt = QUESTION_BANK_PROMPT.format(
        category=req.category.strip(),
        difficulty=difficulty,
        difficulty_context=difficulty_context,
        language_instruction=language_instruction(req.language or "en-US"),
    )

    try:
        raw = chat(client, MODEL, [{"role": "user", "content": prompt}], max_tokens=800)
        data = extract_json(raw)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    questions = data.get("questions", [])
    if len(questions) < 5:
        raise HTTPException(status_code=500, detail="Could not generate 5 questions for this category")

    role = data.get("role", f"{req.category} Practice")
    intro_message = data.get("intro_message") or (
        f"Hi, I am Alex. Today we are practising {req.category} questions at {difficulty} level. "
        f"I will ask you 5 questions. Take your time and speak clearly. "
        f"Here is your first question. {questions[0]}"
    )

    return {
        "role": role,
        "candidate_name": "Candidate",
        "questions": questions[:5],
        "intro_message": intro_message,
        "cv_summary": None,
        "difficulty": difficulty,
    }


@app.post("/respond")
async def respond(req: RespondRequest):
    role = req.role or "the position"
    idx  = req.current_question_index
    difficulty = req.difficulty or "Mid"

    if req.cv_summary:
        cv_context = f"Candidate background (use naturally in conversation):\n{req.cv_summary}"
    else:
        cv_context = "No CV provided for this candidate."

    difficulty_context = DIFFICULTY_INTERVIEW_CONTEXT.get(difficulty, DIFFICULTY_INTERVIEW_CONTEXT["Mid"])

    trimmed = trim_history(req.history, 6)
    messages = [
        {"role": "system", "content": INTERVIEWER_SYSTEM_PROMPT.format(
            role=role,
            cv_context=cv_context,
            difficulty_context=difficulty_context,
            language_instruction=language_instruction(req.language or "en-US"),
        )}
    ]
    messages += [{"role": m.role, "content": m.content} for m in trimmed]

    word_count = len(req.user_answer.strip().split())
    needs_followup = req.allow_followup and word_count < 20 and idx < len(req.questions) - 1

    if needs_followup:
        instruction = (
            "The candidate gave a very brief answer (under 20 words). "
            "Gently ask them to elaborate in one short sentence — e.g. 'Could you give me a specific example of that?' "
            "Do NOT move to the next question yet. Keep it to one sentence."
        )
        messages.append({"role": "user", "content": f"[Candidate answer]: {req.user_answer}\n\n[Instruction]: {instruction}"})
        try:
            reply = chat(client, MODEL, messages, max_tokens=80).strip()
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
        return {"reply": reply, "done": False, "followup": True}

    if idx < len(req.questions) - 1:
        next_q = req.questions[idx + 1]
        instruction = (
            f"The candidate just answered question {idx + 1} of {len(req.questions)}. "
            f"Give a very brief acknowledgement (5 words max), then ask this next question exactly as written: {next_q}"
        )
    else:
        instruction = (
            f"The candidate just answered the final ({len(req.questions)}th) question. "
            "Thank them warmly in 1-2 sentences and tell them you will prepare their feedback now."
        )

    messages.append({"role": "user", "content": f"[Candidate answer]: {req.user_answer}\n\n[Instruction]: {instruction}"})

    try:
        reply = chat(client, MODEL, messages, max_tokens=300).strip()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    done = idx >= len(req.questions) - 1
    return {"reply": reply, "done": done, "followup": False}


@app.post("/upload-recording")
async def upload_recording(file: UploadFile = File(...)):
    recordings_dir = "recordings"
    os.makedirs(recordings_dir, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    filename = f"mockmate-recording-{timestamp}.webm"
    file_path = os.path.join(recordings_dir, filename)
    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)
    return {"message": "Recording saved successfully", "filename": filename, "path": file_path}


@app.post("/debrief")
async def debrief(req: DebriefRequest):
    if len(req.qa_pairs) == 0:
        raise HTTPException(status_code=400, detail="qa_pairs is required")

    qa_text = "\n\n".join(
        [f"Q{i+1}: {pair.question}\nA{i+1}: {pair.answer}" for i, pair in enumerate(req.qa_pairs)]
    )

    prompt = DEBRIEF_PROMPT.format(
        qa_pairs=qa_text,
        language_instruction=language_instruction(req.language or "en-US"),
    )
    messages = [
        {"role": "system", "content": DEBRIEF_SYSTEM_PROMPT},
        {"role": "user", "content": prompt},
    ]

    try:
        raw = chat(client, MODEL, messages, max_tokens=4000)
        data = extract_json(raw)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return data


@app.post("/tts")
async def text_to_speech(request: Request):
    body = await request.json()
    text = (body.get("text") or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="text is required")

    api_key = os.getenv("ELEVENLABS_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="ELEVENLABS_API_KEY not configured")

    voice_id = "onwK4e9ZLuTAKqWW03F9"  # Daniel — professional male
    async with httpx.AsyncClient(timeout=30) as http:
        resp = await http.post(
            f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}",
            headers={"xi-api-key": api_key, "Content-Type": "application/json"},
            json={
                "text": text,
                "model_id": "eleven_multilingual_v2",
                "voice_settings": {"stability": 0.5, "similarity_boost": 0.75},
            },
        )

    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail=f"ElevenLabs error {resp.status_code}: {resp.text}")

    return Response(content=resp.content, media_type="audio/mpeg")


# ── Session / Dashboard endpoints ─────────────────────────────────────────────

class AnswerIn(BaseModel):
    question_index: int
    question:       str
    answer:         str
    score:          Optional[float] = None
    feedback:       Optional[str]   = None
    tip:            Optional[str]   = None
    ideal_answer:   Optional[str]   = None
    analytics:      Optional[Any]   = None


class FaceMetricsIn(BaseModel):
    eye_contact_pct:       Optional[int]   = None
    head_stability_pct:    Optional[int]   = None
    face_confidence_score: Optional[float] = None
    face_samples_count:    Optional[int]   = None


class SaveSessionRequest(BaseModel):
    user_id:          str
    role:             Optional[str]        = "the position"
    difficulty:       Optional[str]        = "Mid"
    interview_type:   Optional[str]        = "full"
    overall_score:    Optional[float]      = None
    duration_seconds: Optional[int]        = 0
    summary:          Optional[str]        = None
    top_strength:     Optional[str]        = None
    top_improvement:  Optional[str]        = None
    answers:          List[AnswerIn]       = []
    language:         Optional[str]        = "en-US"
    company_name:     Optional[str]        = None
    candidate_name:   Optional[str]        = None
    ai_score:         Optional[float]      = None
    ai_verdict:       Optional[str]        = None
    face_metrics:     Optional[FaceMetricsIn] = None


@app.post("/sessions", status_code=201)
def create_session(req: SaveSessionRequest):
    try:
        upsert_user(req.user_id)
        fm = req.face_metrics or FaceMetricsIn()
        session_id = save_session(
            user_id               = req.user_id,
            role                  = req.role,
            difficulty            = req.difficulty,
            interview_type        = req.interview_type,
            overall_score         = req.overall_score,
            duration_seconds      = req.duration_seconds,
            summary               = req.summary,
            top_strength          = req.top_strength,
            top_improvement       = req.top_improvement,
            answers               = [a.model_dump() for a in req.answers],
            language              = req.language,
            company_name          = req.company_name,
            candidate_name        = req.candidate_name,
            ai_score              = req.ai_score,
            ai_verdict            = req.ai_verdict,
            eye_contact_pct       = fm.eye_contact_pct,
            head_stability_pct    = fm.head_stability_pct,
            face_confidence_score = fm.face_confidence_score,
            face_samples_count    = fm.face_samples_count,
        )
        return {"session_id": session_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/sessions")
def list_sessions(user_id: str):
    try:
        sessions = get_sessions(user_id)
        for s in sessions:
            if s.get("created_at"):
                s["created_at"] = s["created_at"].isoformat()
        return {"sessions": sessions}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/sessions/{session_id}")
def session_detail(session_id: int, user_id: str):
    try:
        data = get_session_detail(session_id, user_id)
        if not data:
            raise HTTPException(status_code=404, detail="Session not found")
        if data.get("created_at"):
            data["created_at"] = data["created_at"].isoformat()
        return data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
async def health():
    return {"status": "ok", "model": MODEL}
