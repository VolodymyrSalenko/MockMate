import json
import os
import json
import psycopg
from contextlib import contextmanager
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/mockmate")


# ── Helpers ────────────────────────────────────────────────────────────────────

def _parse_url(url: str) -> dict:
    url = url.replace("postgresql://", "").replace("postgres://", "")
    user_pass, rest = url.split("@", 1)
    user, password = (user_pass.split(":", 1) if ":" in user_pass else (user_pass, ""))
    host_port, dbname = rest.split("/", 1)
    host, port = (host_port.split(":") if ":" in host_port else (host_port, "5432"))
    return dict(user=user, password=password, host=host, port=int(port), dbname=dbname)


def get_connection():
    return psycopg.connect(DATABASE_URL, sslmode="require" if "render.com" in DATABASE_URL else "prefer")

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

        conn.commit()
        print("  ✅ tables ready (users, sessions, answers, cv_profiles)")
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

        # answers — filler detail, STAR count, per-answer AI score
        "ALTER TABLE answers ADD COLUMN IF NOT EXISTS filler_counts   JSONB",
        "ALTER TABLE answers ADD COLUMN IF NOT EXISTS star_score      INTEGER",
        "ALTER TABLE answers ADD COLUMN IF NOT EXISTS ai_answer_score REAL",

        # users — email verification
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified     BOOLEAN DEFAULT FALSE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token TEXT",

        # users — email change flow
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS pending_email      TEXT",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS email_change_token TEXT",
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
                    face_confidence_score, face_samples_count
                )
                VALUES (%s,%s,%s,%s, %s,%s, %s,%s,%s, %s,%s,%s, %s,%s, %s,%s, %s,%s)
                RETURNING id
            """, (
                user_id, role, difficulty, interview_type,
                overall_score, duration_seconds,
                summary, top_strength, top_improvement,
                language, company_name, candidate_name,
                ai_score, ai_verdict,
                eye_contact_pct, head_stability_pct,
                face_confidence_score, face_samples_count,
            ))
            session_id = cur.fetchone()[0]

            for a in answers:
                analytics = a.get("analytics") or {}
                star      = analytics.get("star") or {}
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
                    analytics.get("starScore"), a.get("ai_answer_score"),
                ))
        return session_id


def get_sessions(user_id: str) -> list:
    with db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id, created_at, role, difficulty, interview_type,
                       overall_score, duration_seconds,
                       language, company_name, candidate_name,
                       ai_score, ai_verdict,
                       eye_contact_pct, head_stability_pct, face_confidence_score
                FROM   sessions
                WHERE  user_id = %s
                ORDER  BY created_at DESC
            """, (user_id,))
            cols = [d[0] for d in cur.description]
            return [dict(zip(cols, row)) for row in cur.fetchall()]


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
                       face_confidence_score, face_samples_count
                FROM   sessions
                WHERE  id = %s AND user_id = %s
            """, (session_id, user_id))
            row = cur.fetchone()
            if not row:
                return None
            session = dict(zip([d[0] for d in cur.description], row))

            cur.execute("""
                SELECT question_index, question, answer, score, feedback,
                       tip, ideal_answer,
                       wpm, word_count, total_fillers, duration_seconds,
                       star_s, star_t, star_a, star_r,
                       filler_counts, star_score, ai_answer_score
                FROM   answers
                WHERE  session_id = %s
                ORDER  BY question_index
            """, (session_id,))
            a_cols             = [d[0] for d in cur.description]
            session["answers"] = [dict(zip(a_cols, r)) for r in cur.fetchall()]
        return session


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


# ── Run directly: python database.py ──────────────────────────────────────────

if __name__ == "__main__":
    init_db()
