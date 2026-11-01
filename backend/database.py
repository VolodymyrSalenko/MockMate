
import hashlib
import json
import os
import psycopg
from contextlib import contextmanager
from datetime import datetime, timezone
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/mockmate")


# ── Helpers ────────────────────────────────────────────────────────────────────

def _parse_url(url: str) -> dict:
    url = url.replace("postgresql://", "").replace("postgres://", "")
    user_pass, rest = url.split("@", 1)
    user, password = (user_pass.split(":", 1) if ":" in user_pass else (user_pass, ""))
    host_port, dbname = rest.split("/", 1)
    dbname = dbname.split("?")[0]  # strip query params like ?sslmode=require
    host, port = (host_port.split(":") if ":" in host_port else (host_port, "5432"))
    return dict(user=user, password=password, host=host, port=int(port), dbname=dbname)


def get_connection():
    if "sslmode=" in DATABASE_URL:
        return psycopg.connect(DATABASE_URL)
    needs_ssl = "render.com" in DATABASE_URL or "neon.tech" in DATABASE_URL
    return psycopg.connect(DATABASE_URL, sslmode="require" if needs_ssl else "prefer")

@contextmanager
def db():
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


# ── Step 1: create the database ────────────────────────────────────────────────

def create_database_if_not_exists():
    parts  = _parse_url(DATABASE_URL)
    dbname = parts.pop("dbname")
    conn   = psycopg.connect(**parts, dbname="postgres", autocommit=True)
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", (dbname,))
            if cur.fetchone():
                print(f"  database '{dbname}' already exists — skipping create")
            else:
                cur.execute(f'CREATE DATABASE "{dbname}"')
                print(f"  ✅ database '{dbname}' created")
    finally:
        conn.close()


# ── Step 2: create tables (full schema for fresh installs) ─────────────────────

def create_tables():
    conn = get_connection()
    try:
        with conn.cursor() as cur:

            # -- users ----------------------------------------------------------
            cur.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id            UUID PRIMARY KEY,
                    created_at    TIMESTAMP DEFAULT NOW(),
                    last_seen     TIMESTAMP DEFAULT NOW(),
                    email         TEXT UNIQUE,
                    password_hash TEXT,
                    name          TEXT,
                    plan          TEXT DEFAULT 'free'
                )
            """)

            # -- sessions -------------------------------------------------------
            cur.execute("""
                CREATE TABLE IF NOT EXISTS sessions (
                    id                    SERIAL PRIMARY KEY,
                    user_id               UUID REFERENCES users(id),
                    created_at            TIMESTAMP DEFAULT NOW(),
                    role                  TEXT,
                    difficulty            TEXT,
                    interview_type        TEXT,
                    overall_score         REAL,
                    duration_seconds      INTEGER,
                    summary               TEXT,
                    top_strength          TEXT,
                    top_improvement       TEXT,
                    language              TEXT DEFAULT 'en-US',
                    company_name          TEXT,
                    candidate_name        TEXT,
                    ai_score              REAL,
                    ai_verdict            TEXT,
                    eye_contact_pct       INTEGER,
                    head_stability_pct    INTEGER,
                    face_confidence_score REAL,
                    face_samples_count    INTEGER
                )
            """)

            # -- answers (5 per session) ----------------------------------------
            cur.execute("""
                CREATE TABLE IF NOT EXISTS answers (
                    id               SERIAL PRIMARY KEY,
                    session_id       INTEGER REFERENCES sessions(id) ON DELETE CASCADE,
                    question_index   INTEGER,
                    question         TEXT,
                    answer           TEXT,
                    score            REAL,
                    feedback         TEXT,
                    tip              TEXT,
                    ideal_answer     TEXT,
                    wpm              INTEGER,
                    word_count       INTEGER,
                    total_fillers    INTEGER,
                    duration_seconds INTEGER,
                    star_s           BOOLEAN,
                    star_t           BOOLEAN,
                    star_a           BOOLEAN,
                    star_r           BOOLEAN,
                    filler_counts    JSONB,
                    star_score       INTEGER,
                    ai_answer_score  REAL
                )
            """)

            # -- cv_profiles (one CV per user) --------------------------------
            cur.execute("""
                CREATE TABLE IF NOT EXISTS cv_profiles (
                    user_id    UUID PRIMARY KEY REFERENCES users(id),
                    filename   TEXT,
                    raw_text   TEXT,
                    parsed     TEXT,
                    updated_at TIMESTAMP DEFAULT NOW()
                )
            """)

            # -- job_descriptions (recent job ads, to practise the same one again) --
            cur.execute("""
                CREATE TABLE IF NOT EXISTS job_descriptions (
                    id            SERIAL PRIMARY KEY,
                    user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
                    jd_hash       TEXT NOT NULL,
                    role          TEXT,
                    company_name  TEXT,
                    jd_text       TEXT NOT NULL,
                    created_at    TIMESTAMP DEFAULT NOW(),
                    last_used_at  TIMESTAMP DEFAULT NOW(),
                    UNIQUE (user_id, jd_hash)
                )
            """)

            # -- interview_usage (one row per interview started, for plan limits) --
            cur.execute("""
                CREATE TABLE IF NOT EXISTS interview_usage (
                    id          SERIAL PRIMARY KEY,
                    user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
                    created_at  TIMESTAMP DEFAULT NOW()
                )
            """)
            cur.execute("CREATE INDEX IF NOT EXISTS interview_usage_user ON interview_usage (user_id, created_at)")

        conn.commit()
        print("  ✅ tables ready (users, sessions, answers, cv_profiles, job_descriptions, interview_usage)")
    finally:
        conn.close()


# ── Step 3: migrations (add new columns to existing tables) ────────────────────

def migrate_tables():
    """
    Idempotent ALTER TABLE statements — safe to run on every startup.
    Only adds columns that don't exist yet; never drops or modifies existing ones.
    """
    migrations = [
        # users — auth + plan
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS email         TEXT UNIQUE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS name          TEXT",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS plan          TEXT DEFAULT 'free'",

        # sessions — language, company, candidate, AI score, face metrics
        "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS language              TEXT DEFAULT 'en-US'",
        "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS company_name          TEXT",
        "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS candidate_name        TEXT",
        "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS ai_score              REAL",
        "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS ai_verdict            TEXT",
        "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS eye_contact_pct       INTEGER",
        "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS head_stability_pct    INTEGER",
        "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS face_confidence_score REAL",
        "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS face_samples_count    INTEGER",
        "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS report                JSONB",

        # answers — filler detail, STAR count, per-answer AI score
        "ALTER TABLE answers ADD COLUMN IF NOT EXISTS filler_counts   JSONB",
        "ALTER TABLE answers ADD COLUMN IF NOT EXISTS star_score      INTEGER",
        "ALTER TABLE answers ADD COLUMN IF NOT EXISTS ai_answer_score REAL",

        # answers — later attempts at the same question from the debrief
        "ALTER TABLE answers ADD COLUMN IF NOT EXISTS retries JSONB",

        # users — email verification
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified     BOOLEAN DEFAULT FALSE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token TEXT",

        # users — email change flow
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS pending_email      TEXT",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS email_change_token TEXT",

        # users — password reset flow
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token TEXT",

        # users — AI data processing consent (Swiss DSG / GDPR)
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_consent    BOOLEAN DEFAULT NULL",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_consent_at TIMESTAMP",

        # users — admin flag (only settable via direct DB; never via API)
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE",

        # users — token version for server-side session invalidation (password change)
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INT DEFAULT 0",

        # users — trying MockMate without an account (one interview, then sign up)
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_guest BOOLEAN DEFAULT FALSE",
    ]
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            for sql in migrations:
                cur.execute(sql)
        conn.commit()
        print("  ✅ migrations applied")
    finally:
        conn.close()


# ── Public entry-point ─────────────────────────────────────────────────────────

def init_db():
    print("🔧 Initialising MockMate database...")
    if DATABASE_URL == "postgresql://postgres:postgres@localhost:5432/mockmate":
        create_database_if_not_exists()
    create_tables()
    migrate_tables()
    print("🎉 Database ready.")


# ── Query helpers ──────────────────────────────────────────────────────────────

def upsert_user(user_id: str):
    with db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO users (id)
                VALUES (%s)
                ON CONFLICT (id) DO UPDATE SET last_seen = NOW()
            """, (user_id,))


def save_session(
    user_id: str, role: str, difficulty: str, interview_type: str,
    overall_score: float, duration_seconds: int,
    summary: str, top_strength: str, top_improvement: str,
    answers: list, language: str = "en-US",
    company_name: str = None, candidate_name: str = None,
    ai_score: float = None, ai_verdict: str = None,
    eye_contact_pct: int = None, head_stability_pct: int = None,
    face_confidence_score: float = None, face_samples_count: int = None,
    report: dict = None,
) -> int:
    with db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO sessions (
                    user_id, role, difficulty, interview_type,
                    overall_score, duration_seconds,
                    summary, top_strength, top_improvement,
                    language, company_name, candidate_name,
                    ai_score, ai_verdict,
                    eye_contact_pct, head_stability_pct,
                    face_confidence_score, face_samples_count, report
                )
                VALUES (%s,%s,%s,%s, %s,%s, %s,%s,%s, %s,%s,%s, %s,%s, %s,%s, %s,%s, %s)
                RETURNING id
            """, (
                user_id, role, difficulty, interview_type,
                overall_score, duration_seconds,
                summary, top_strength, top_improvement,
                language, company_name, candidate_name,
                ai_score, ai_verdict,
                eye_contact_pct, head_stability_pct,
                face_confidence_score, face_samples_count,
                json.dumps(report) if report is not None else None,
            ))
            session_id = cur.fetchone()[0]

            for a in answers:
                analytics = a.get("analytics") or {}
                star      = a.get("star") or {}  # judged by the AI
                cur.execute("""
                    INSERT INTO answers (
                        session_id, question_index, question, answer,
                        score, feedback, tip, ideal_answer,
                        wpm, word_count, total_fillers, duration_seconds,
                        star_s, star_t, star_a, star_r,
                        filler_counts, star_score, ai_answer_score
                    )
                    VALUES (%s,%s,%s,%s, %s,%s,%s,%s, %s,%s,%s,%s, %s,%s,%s,%s, %s,%s,%s)
                """, (
                    session_id,
                    a.get("question_index", 0), a.get("question", ""), a.get("answer", ""),
                    a.get("score"), a.get("feedback", ""), a.get("tip", ""), a.get("ideal_answer", ""),
                    analytics.get("wpm"), analytics.get("wordCount"),
                    analytics.get("totalFillers"), analytics.get("durationSeconds"),
                    star.get("situation"), star.get("task"), star.get("action"), star.get("result"),
                    json.dumps(analytics.get("fillerCounts")) if analytics.get("fillerCounts") else None,
                    sum(1 for v in star.values() if v) if star else None, a.get("ai_answer_score"),
                ))
        return session_id


def _with_utc(row: dict) -> dict:
    """Timestamps are stored in UTC without a zone; mark them as UTC so the browser
    shows them in the user's own time instead of treating them as local."""
    for key, value in row.items():
        if isinstance(value, datetime) and value.tzinfo is None:
            row[key] = value.replace(tzinfo=timezone.utc)
    return row


def _avg(values):
    values = [v for v in values if isinstance(v, (int, float))]
    return round(sum(values) / len(values), 1) if values else None


def report_skills(report) -> dict | None:
    """Per-session answer skills from the saved debrief: the three criteria (1-10)
    and how much of S-T-A-R the answers covered (0-100)."""
    answers = ((report or {}).get("debrief") or {}).get("answers") or []
    if not answers:
        return None
    scores = [a.get("scores") or {} for a in answers]
    stars  = [a["star"] for a in answers if isinstance(a.get("star"), dict)]
    return {
        "relevance": _avg([s.get("relevance") for s in scores]),
        "examples":  _avg([s.get("examples") for s in scores]),
        "clarity":   _avg([s.get("clarity") for s in scores]),
        "structure": round(100 * sum(sum(1 for v in s.values() if v) for s in stars) / (4 * len(stars))) if stars else None,
    }


# Body-language timeline codes (frontend/src/utils/bodyLanguage.js): bit 0 eye contact,
# bit 1 facing the camera, bits 2-4 expression (0 neutral, 1 smiling), bit 7 answering, bit 8 restless
_EYE, _STEADY, _ANSWERING, _RESTLESS = 1, 2, 128, 256
_NEUTRAL, _SMILING = 0, 1
_STEP_SECONDS = 0.2


def _red_moments(samples: list) -> set:
    """Indexes of the moments in the red zone, with the rules of the feedback screen
    (bodyLanguage.js ISSUES): looking away 3 s+ or turning away 2 s+ while answering,
    restless movement 1.5 s+. Short gaps do not end a moment."""
    rules = [
        (lambda c: c & _ANSWERING and not c & _EYE,    3.0, 0.6),
        (lambda c: c & _ANSWERING and not c & _STEADY, 2.0, 0.6),
        (lambda c: c & _RESTLESS,                      1.5, 1.0),
    ]
    red = set()
    for test, min_sec, gap_sec in rules:
        runs, run = [], None
        for i, c in enumerate(samples):
            if not isinstance(c, int) or not test(c):
                continue
            if run and (i - run[-1]) * _STEP_SECONDS <= gap_sec + _STEP_SECONDS:
                run.append(i)
            else:
                run = [i]
                runs.append(run)
        for r in runs:
            if (r[-1] - r[0] + 1) * _STEP_SECONDS >= min_sec:
                red.update(range(r[0], r[-1] + 1))
    return red


def report_video(report) -> dict | None:
    """Per-session body language from the saved timeline, each 0-100: eye contact while
    answering (focus), time without restless movement (calm), time smiling (smile), and
    presence: the overall impression, from a friendly or neutral face (a little extra for
    smiling) minus the moments in the red zone."""
    timeline = (((report or {}).get("face_metrics") or {}).get("timeline") or {})
    samples = timeline.get("samples") or []
    moments = [c for c in samples if isinstance(c, int)]
    if len(moments) < 30:
        return None
    answering = [c for c in moments if c & _ANSWERING]
    pct = lambda part, whole: round(100 * part / len(whole)) if whole else None
    friendly = 100 * sum(1 for c in moments if (c >> 2) & 7 in (_NEUTRAL, _SMILING)) / len(moments)
    smile = 100 * sum(1 for c in moments if (c >> 2) & 7 == _SMILING) / len(moments)
    red = 100 * len(_red_moments(samples)) / len(moments)
    return {
        "focus":    pct(sum(1 for c in answering if c & _EYE), answering),
        "calm":     pct(sum(1 for c in moments if not c & _RESTLESS), moments),
        "smile":    round(smile),
        "presence": max(0, min(100, round(friendly + min(5, smile / 2) - 2 * red))),
    }


def _session_delivery(cur, session_ids: list) -> dict:
    """Speaking pace, filler words per minute and filler counts per session, from its answers."""
    if not session_ids:
        return {}
    cur.execute("""
        SELECT session_id, wpm, total_fillers, duration_seconds, filler_counts
        FROM   answers
        WHERE  session_id = ANY(%s)
    """, (session_ids,))
    acc = {}
    for sid, wpm, fillers, seconds, counts in cur.fetchall():
        a = acc.setdefault(sid, {"wpm": [], "fillers": 0, "seconds": 0, "counts": {}})
        if wpm:
            a["wpm"].append(wpm)
        a["fillers"] += fillers or 0
        a["seconds"] += seconds or 0
        for word, n in (counts if isinstance(counts, dict) else {}).items():
            a["counts"][word] = a["counts"].get(word, 0) + int(n)
    return {
        sid: {
            "wpm": round(sum(a["wpm"]) / len(a["wpm"])) if a["wpm"] else None,
            "fillers_per_min": round(a["fillers"] / (a["seconds"] / 60), 1) if a["seconds"] >= 10 else None,
            "filler_counts": a["counts"],
        }
        for sid, a in acc.items()
    }


def get_sessions(user_id: str) -> list:
    with db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id, created_at, role, difficulty, interview_type,
                       overall_score, duration_seconds,
                       language, company_name, candidate_name,
                       ai_score, ai_verdict,
                       eye_contact_pct, head_stability_pct,
                       report
                FROM   sessions
                WHERE  user_id = %s
                ORDER  BY created_at DESC
            """, (user_id,))
            cols = [d[0] for d in cur.description]
            sessions = [_with_utc(dict(zip(cols, row))) for row in cur.fetchall()]
            delivery = _session_delivery(cur, [s["id"] for s in sessions])
    for s in sessions:
        report = s.pop("report")
        s["skills"] = report_skills(report)
        s["video"] = report_video(report)
        s["delivery"] = delivery.get(s["id"])
    return sessions


def get_sessions_for_insights(user_id: str, session_ids: list) -> list:
    """The user's chosen interviews with everything the progress review needs, oldest first."""
    with db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id, created_at, role, difficulty, interview_type, language,
                       overall_score, eye_contact_pct, head_stability_pct, duration_seconds, report
                FROM   sessions
                WHERE  user_id = %s AND id = ANY(%s)
                ORDER  BY created_at
            """, (user_id, session_ids))
            cols = [d[0] for d in cur.description]
            sessions = [dict(zip(cols, row)) for row in cur.fetchall()]
            delivery = _session_delivery(cur, [s["id"] for s in sessions])
    out = []
    for s in sessions:
        report = s.pop("report") or {}
        debrief = report.get("debrief") or {}
        out.append({
            **s,
            "skills": report_skills(report),
            "video": report_video(report),
            "delivery": {k: v for k, v in (delivery.get(s["id"]) or {}).items() if k != "filler_counts"},
            "fillers": (delivery.get(s["id"]) or {}).get("filler_counts") or {},
            "top_strength": debrief.get("top_strength"),
            "top_improvement": debrief.get("top_improvement"),
            "hiring_decision": (debrief.get("hiring_decision") or {}).get("decision"),
            "questions": len(debrief.get("answers") or []),
        })
    return out


MAX_JOB_DESCRIPTIONS = 20  # per user; the least recently used ones are dropped


def save_job_description(user_id: str, jd_text: str, role: str | None, company_name: str | None):
    """Remember a job ad the user practised with. The same text again only moves it to the top."""
    text = jd_text.strip()
    jd_hash = hashlib.sha256(" ".join(text.split()).lower().encode()).hexdigest()
    with db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO job_descriptions (user_id, jd_hash, role, company_name, jd_text)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (user_id, jd_hash) DO UPDATE
                SET last_used_at = NOW(),
                    role         = COALESCE(EXCLUDED.role, job_descriptions.role),
                    company_name = COALESCE(EXCLUDED.company_name, job_descriptions.company_name)
            """, (user_id, jd_hash, role, company_name, text))
            cur.execute("""
                DELETE FROM job_descriptions
                WHERE user_id = %s AND id NOT IN (
                    SELECT id FROM job_descriptions WHERE user_id = %s
                    ORDER BY last_used_at DESC LIMIT %s)
            """, (user_id, user_id, MAX_JOB_DESCRIPTIONS))


def get_job_descriptions(user_id: str) -> list:
    with db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id, role, company_name, jd_text, last_used_at
                FROM   job_descriptions
                WHERE  user_id = %s
                ORDER  BY last_used_at DESC
            """, (user_id,))
            cols = [d[0] for d in cur.description]
            return [_with_utc(dict(zip(cols, row))) for row in cur.fetchall()]


def delete_job_description(jd_id: int, user_id: str) -> bool:
    with db() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM job_descriptions WHERE id = %s AND user_id = %s", (jd_id, user_id))
            return cur.rowcount > 0


def delete_session(session_id: int, user_id: str) -> bool:
    with db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM sessions WHERE id = %s AND user_id = %s",
                (session_id, user_id),
            )
            return cur.rowcount > 0


def get_session_detail(session_id: int, user_id: str) -> dict | None:
    with db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id, created_at, role, difficulty, interview_type,
                       overall_score, duration_seconds,
                       summary, top_strength, top_improvement,
                       language, company_name, candidate_name,
                       ai_score, ai_verdict,
                       eye_contact_pct, head_stability_pct,
                       face_confidence_score, face_samples_count, report
                FROM   sessions
                WHERE  id = %s AND user_id = %s
            """, (session_id, user_id))
            row = cur.fetchone()
            if not row:
                return None
            session = _with_utc(dict(zip([d[0] for d in cur.description], row)))

            cur.execute("""
                SELECT question_index, question, answer, score, feedback,
                       tip, ideal_answer,
                       wpm, word_count, total_fillers, duration_seconds,
                       star_s, star_t, star_a, star_r,
                       filler_counts, star_score, ai_answer_score, retries
                FROM   answers
                WHERE  session_id = %s
                ORDER  BY question_index
            """, (session_id,))
            a_cols             = [d[0] for d in cur.description]
            session["answers"] = [dict(zip(a_cols, r)) for r in cur.fetchall()]
        return session


MAX_RETRIES_PER_ANSWER = 20


def add_answer_retry(session_id: int, user_id: str, question_index: int, retry: dict,
                     max_retries: int = MAX_RETRIES_PER_ANSWER) -> bool:
    """Append one retry attempt to an answer of the user's own session, up to the plan's limit."""
    with db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE answers a
                SET    retries = COALESCE(a.retries, '[]'::jsonb) || %s::jsonb
                FROM   sessions s
                WHERE  a.session_id = s.id
                  AND  s.id = %s AND s.user_id = %s AND a.question_index = %s
                  AND  jsonb_array_length(COALESCE(a.retries, '[]'::jsonb)) < %s
            """, (json.dumps([retry]), session_id, user_id, question_index, min(max_retries, MAX_RETRIES_PER_ANSWER)))
            return cur.rowcount > 0


def create_guest_user(user_id: str):
    with db() as conn:
        with conn.cursor() as cur:
            cur.execute("INSERT INTO users (id, name, plan, is_guest, email_verified) VALUES (%s, 'Guest', 'free', TRUE, FALSE)",
                        (user_id,))


def convert_guest_user(user_id: str, email: str, password_hash: str, name: str,
                       email_verified: bool, verification_token: str | None) -> dict:
    """A guest signs up: the same row becomes their account, so the trial interview stays theirs.
    The trial does not count toward the free plan's interviews."""
    with db() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM interview_usage WHERE user_id = %s AND EXISTS (SELECT 1 FROM users WHERE id = %s AND is_guest)",
                        (user_id, user_id))
            cur.execute("""
                UPDATE users SET email = %s, password_hash = %s, name = %s, is_guest = FALSE,
                                 email_verified = %s, verification_token = %s
                WHERE id = %s AND is_guest
                RETURNING id, email, name, plan, email_verified
            """, (email, password_hash, name, email_verified, verification_token, user_id))
            row = cur.fetchone()
            return dict(zip([c[0] for c in cur.description], row)) if row else None


def merge_guest_into(guest_id: str, user_id: str):
    """A guest signs in to an existing account: their trial interview moves there."""
    with db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT is_guest FROM users WHERE id = %s", (guest_id,))
            row = cur.fetchone()
            if not row or not row[0] or guest_id == user_id:
                return
            for table in ("sessions", "job_descriptions"):
                cur.execute(f"UPDATE {table} SET user_id = %s WHERE user_id = %s", (user_id, guest_id))
            cur.execute("DELETE FROM users WHERE id = %s", (guest_id,))


def db_set_verification_token(user_id: str, token: str):
    with db() as conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE users SET verification_token = %s WHERE id = %s", (token, user_id))


def db_get_user_by_verification_token(token: str) -> dict | None:
    with db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, email, name FROM users WHERE verification_token = %s", (token,)
            )
            row = cur.fetchone()
            if not row:
                return None
            return dict(zip([d[0] for d in cur.description], row))


def db_verify_email(user_id: str):
    with db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE users SET email_verified = TRUE, verification_token = NULL WHERE id = %s",
                (user_id,),
            )


def db_update_name(user_id: str, name: str):
    with db() as conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE users SET name = %s WHERE id = %s", (name, user_id))


def db_update_password(user_id: str, password_hash: str):
    with db() as conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE users SET password_hash = %s WHERE id = %s", (password_hash, user_id))


def db_get_password_hash(user_id: str) -> str | None:
    with db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT password_hash FROM users WHERE id = %s", (user_id,))
            row = cur.fetchone()
            return row[0] if row else None


def db_set_pending_email(user_id: str, new_email: str, token: str):
    with db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE users SET pending_email = %s, email_change_token = %s WHERE id = %s",
                (new_email, token, user_id),
            )


def db_get_user_by_email_change_token(token: str) -> dict | None:
    with db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, email, pending_email, name FROM users WHERE email_change_token = %s",
                (token,),
            )
            row = cur.fetchone()
            if not row:
                return None
            return dict(zip([d[0] for d in cur.description], row))


def db_confirm_email_change(user_id: str):
    with db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE users
                SET email = pending_email, pending_email = NULL, email_change_token = NULL
                WHERE id = %s
            """, (user_id,))


def db_update_email(user_id: str, new_email: str):
    with db() as conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE users SET email = %s WHERE id = %s", (new_email, user_id))


def db_cancel_email_change(user_id: str):
    with db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE users SET pending_email = NULL, email_change_token = NULL WHERE id = %s",
                (user_id,),
            )


# ── CV Profile ────────────────────────────────────────────────────────────────

def save_cv_profile(user_id: str, filename: str, raw_text: str, parsed: dict):
    """Upsert CV profile for a user — replaces any previous CV."""
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO cv_profiles (user_id, filename, raw_text, parsed, updated_at)
                VALUES (%s, %s, %s, %s, NOW())
                ON CONFLICT (user_id) DO UPDATE
                    SET filename   = EXCLUDED.filename,
                        raw_text   = EXCLUDED.raw_text,
                        parsed     = EXCLUDED.parsed,
                        updated_at = NOW()
            """, (user_id, filename, raw_text, json.dumps(parsed)))
        conn.commit()
    finally:
        conn.close()


def get_cv_profile(user_id: str) -> dict | None:
    """Return the stored CV profile for a user, or None if not found."""
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT filename, raw_text, parsed, updated_at
                FROM   cv_profiles
                WHERE  user_id = %s
            """, (user_id,))
            row = cur.fetchone()
            if not row:
                return None
            return {
                "filename":   row[0],
                "raw_text":   row[1],
                "parsed":     json.loads(row[2]) if row[2] else {},
                "updated_at": row[3].isoformat() if row[3] else None,
            }
    finally:
        conn.close()


# ── Password reset ────────────────────────────────────────────────────────────

def db_set_reset_token(user_id: str, token: str):
    with db() as conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE users SET reset_token = %s WHERE id = %s", (token, user_id))


def db_get_user_by_reset_token(token: str) -> dict | None:
    with db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, email, name FROM users WHERE reset_token = %s", (token,)
            )
            row = cur.fetchone()
            if not row:
                return None
            return dict(zip([d[0] for d in cur.description], row))


def db_clear_reset_token(user_id: str):
    with db() as conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE users SET reset_token = NULL WHERE id = %s", (user_id,))


# ── Run directly: python database.py ──────────────────────────────────────────

if __name__ == "__main__":
    init_db()
