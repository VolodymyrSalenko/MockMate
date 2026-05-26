import os
import io
import json
import re
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional
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

load_dotenv()

app = FastAPI(title="MockMate API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "*"],
    allow_credentials=True,
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


# --- Helpers ---

def extract_json(text: str) -> dict:
    cleaned = re.sub(r"```(?:json)?", "", text).replace("```", "").strip()
    return json.loads(cleaned)


def trim_history(history: List[Message], max_messages: int = 6) -> List[Message]:
    return history[-max_messages:]


def trim_to_words(text: str, max_words: int) -> str:
    words = text.split()
    if len(words) <= max_words:
        return text
    return " ".join(words[:max_words]) + "..."


def chat(messages: list, max_tokens: int) -> str:
    response = client.chat.completions.create(
        model=MODEL,
        max_tokens=max_tokens,
        messages=messages,
    )
    return response.choices[0].message.content


def extract_text_from_pdf(file_bytes: bytes) -> str:
    import pdfplumber
    text_parts = []
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        for page in pdf.pages:
            t = page.extract_text()
            if t:
                text_parts.append(t)
    return "\n".join(text_parts)


def extract_text_from_docx(file_bytes: bytes) -> str:
    from docx import Document
    doc = Document(io.BytesIO(file_bytes))
    return "\n".join(p.text for p in doc.paragraphs if p.text.strip())


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
        raw = chat([{"role": "user", "content": prompt}], max_tokens=800)
        data = extract_json(raw)
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Failed to parse JD response as JSON")
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
        raw = chat([{"role": "user", "content": prompt}], max_tokens=800)
        data = extract_json(raw)
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Failed to parse question bank response as JSON")
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
            reply = chat(messages, max_tokens=80).strip()
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
        reply = chat(messages, max_tokens=300).strip()
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
        # Multilingual responses (DE/FR) are ~2x longer than EN — needs more headroom
        raw = chat(messages, max_tokens=3500)
        data = extract_json(raw)
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Failed to parse debrief response as JSON")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return data


@app.get("/health")
async def health():
    return {"status": "ok", "model": MODEL}
