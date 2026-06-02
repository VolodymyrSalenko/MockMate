import json
import os
import psycopg
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/mockmate")


# ── Helpers ────────────────────────────────────────────────────────────────────

def _parse_url(url: str) -> dict:
    """Parse a postgresql://user:pass@host:port/dbname URL into parts."""
    url = url.replace("postgresql://", "").replace("postgres://", "")
    user_pass, rest = url.split("@", 1)
    user, password = (user_pass.split(":", 1) if ":" in user_pass else (user_pass, ""))
    host_port, dbname = rest.split("/", 1)
    host, port = (host_port.split(":") if ":" in host_port else (host_port, "5432"))
    return dict(user=user, password=password, host=host, port=int(port), dbname=dbname)


def get_connection():
    """Return a live psycopg3 connection to the mockmate database."""
    return psycopg.connect(DATABASE_URL, sslmode="require" if "render.com" in DATABASE_URL else "prefer")


# ── Step 1: create the database ────────────────────────────────────────────────

def create_database_if_not_exists():
    """
    Connect to the default 'postgres' DB and create 'mockmate' if it
    doesn't exist yet.  Must use AUTOCOMMIT — CREATE DATABASE can't run
    inside a transaction block.
    """
    parts = _parse_url(DATABASE_URL)
    dbname = parts.pop("dbname")

    conn = psycopg.connect(**parts, dbname="postgres", autocommit=True)
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


# ── Step 2: create tables ──────────────────────────────────────────────────────

def create_tables():
    """
    Create all three tables (users, sessions, answers) if they don't exist.
    Safe to call on every startup — uses IF NOT EXISTS.
    """
    conn = get_connection()
    try:
        with conn.cursor() as cur:

            # -- users --------------------------------------------------------
            cur.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id         UUID PRIMARY KEY,
                    created_at TIMESTAMP DEFAULT NOW(),
                    last_seen  TIMESTAMP DEFAULT NOW()
                )
            """)

            # -- sessions -----------------------------------------------------
            cur.execute("""
                CREATE TABLE IF NOT EXISTS sessions (
                    id               SERIAL PRIMARY KEY,
                    user_id          UUID REFERENCES users(id),
                    created_at       TIMESTAMP DEFAULT NOW(),
                    role             TEXT,
                    difficulty       TEXT,
                    interview_type   TEXT,
                    overall_score    REAL,
                    duration_seconds INTEGER,
                    summary          TEXT,
                    top_strength     TEXT,
                    top_improvement  TEXT
                )
            """)

            # -- answers (5 per session) --------------------------------------
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
                    star_r           BOOLEAN
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


# ── Public entry-point (used by FastAPI startup + CLI) ─────────────────────────

def init_db():
    """Full init: create DB then create tables.  Called on FastAPI startup."""
    print("🔧 Initialising MockMate database...")
    # Skip create-DB step when using a managed cloud database (Render, Supabase, etc.)
    # — those databases are pre-created; we only need to ensure the tables exist.
    if DATABASE_URL == "postgresql://postgres:postgres@localhost:5432/mockmate":
        create_database_if_not_exists()
    create_tables()
    print("🎉 Database ready.")


# ── Query helpers (used by FastAPI endpoints) ──────────────────────────────────

def upsert_user(user_id: str):
    """Insert user on first visit; update last_seen on every visit."""
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO users (id)
                VALUES (%s)
                ON CONFLICT (id) DO UPDATE SET last_seen = NOW()
            """, (user_id,))
        conn.commit()
    finally:
        conn.close()


def save_session(user_id: str, role: str, difficulty: str, interview_type: str,
                 overall_score: float, duration_seconds: int,
                 summary: str, top_strength: str, top_improvement: str,
                 answers: list) -> int:
    """
    Save a completed session + all its answers.
    Returns the new session id.
    """
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            # Insert session row
            cur.execute("""
                INSERT INTO sessions
                    (user_id, role, difficulty, interview_type,
                     overall_score, duration_seconds,
                     summary, top_strength, top_improvement)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
                RETURNING id
            """, (user_id, role, difficulty, interview_type,
                  overall_score, duration_seconds,
                  summary, top_strength, top_improvement))
            session_id = cur.fetchone()[0]

            # Insert one row per answer
            for a in answers:
                analytics = a.get("analytics") or {}
                star      = analytics.get("star") or {}
                cur.execute("""
                    INSERT INTO answers
                        (session_id, question_index, question, answer,
                         score, feedback, tip, ideal_answer,
                         wpm, word_count, total_fillers, duration_seconds,
                         star_s, star_t, star_a, star_r)
                    VALUES (%s,%s,%s,%s, %s,%s,%s,%s, %s,%s,%s,%s, %s,%s,%s,%s)
                """, (
                    session_id,
                    a.get("question_index", 0),
                    a.get("question", ""),
                    a.get("answer", ""),
                    a.get("score"),
                    a.get("feedback", ""),
                    a.get("tip", ""),
                    a.get("ideal_answer", ""),
                    analytics.get("wpm"),
                    analytics.get("wordCount"),
                    analytics.get("totalFillers"),
                    analytics.get("durationSeconds"),
                    star.get("situation"),
                    star.get("task"),
                    star.get("action"),
                    star.get("result"),
                ))

        conn.commit()
        return session_id
    finally:
        conn.close()


def get_sessions(user_id: str) -> list:
    """Return all sessions for a user, newest first (no answers — list view)."""
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id, created_at, role, difficulty, interview_type,
                       overall_score, duration_seconds
                FROM   sessions
                WHERE  user_id = %s
                ORDER  BY created_at DESC
            """, (user_id,))
            cols = [d[0] for d in cur.description]
            return [dict(zip(cols, row)) for row in cur.fetchall()]
    finally:
        conn.close()


def get_session_detail(session_id: int, user_id: str) -> dict | None:
    """Return one session + its answers.  Returns None if not found."""
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            # Session row
            cur.execute("""
                SELECT id, created_at, role, difficulty, interview_type,
                       overall_score, duration_seconds,
                       summary, top_strength, top_improvement
                FROM   sessions
                WHERE  id = %s AND user_id = %s
            """, (session_id, user_id))
            row = cur.fetchone()
            if not row:
                return None
            cols    = [d[0] for d in cur.description]
            session = dict(zip(cols, row))

            # Answer rows
            cur.execute("""
                SELECT question_index, question, answer, score, feedback,
                       tip, ideal_answer,
                       wpm, word_count, total_fillers, duration_seconds,
                       star_s, star_t, star_a, star_r
                FROM   answers
                WHERE  session_id = %s
                ORDER  BY question_index
            """, (session_id,))
            a_cols           = [d[0] for d in cur.description]
            session["answers"] = [dict(zip(a_cols, r)) for r in cur.fetchall()]

        return session
    finally:
        conn.close()


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
