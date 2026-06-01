import os
import uuid
from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import bcrypt as _bcrypt
from jose import jwt, JWTError
from pydantic import BaseModel

from database import get_connection

SECRET_KEY         = os.getenv("JWT_SECRET", "change-me-use-a-long-random-string-in-production")
ALGORITHM          = "HS256"
TOKEN_EXPIRE_DAYS  = 30

bearer = HTTPBearer()
router = APIRouter(prefix="/auth", tags=["auth"])


# ── Password helpers ───────────────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    return _bcrypt.hashpw(plain.encode("utf-8"), _bcrypt.gensalt()).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    return _bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


# ── JWT helpers ────────────────────────────────────────────────────────────────

def create_token(user_id: str) -> str:
    expire = datetime.utcnow() + timedelta(days=TOKEN_EXPIRE_DAYS)
    return jwt.encode({"sub": user_id, "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)

def decode_token(token: str) -> str:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload["sub"]
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


# ── DB helpers ─────────────────────────────────────────────────────────────────

def db_get_user_by_email(email: str) -> dict | None:
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, email, password_hash, name, plan FROM users WHERE email = %s",
                (email.lower().strip(),)
            )
            row = cur.fetchone()
            if not row:
                return None
            cols = [d[0] for d in cur.description]
            return dict(zip(cols, row))
    finally:
        conn.close()

def db_get_user_by_id(user_id: str) -> dict | None:
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, email, name, plan FROM users WHERE id = %s",
                (user_id,)
            )
            row = cur.fetchone()
            if not row:
                return None
            cols = [d[0] for d in cur.description]
            return dict(zip(cols, row))
    finally:
        conn.close()

def db_create_user(user_id: str, email: str, password_hash: str, name: str) -> dict:
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO users (id, email, password_hash, name, plan)
                VALUES (%s, %s, %s, %s, 'free')
                RETURNING id, email, name, plan
            """, (user_id, email, password_hash, name))
            row  = cur.fetchone()
            cols = [d[0] for d in cur.description]
        conn.commit()
        return dict(zip(cols, row))
    finally:
        conn.close()


# ── FastAPI dependency — resolves Bearer token → user dict ─────────────────────

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer)) -> dict:
    user_id = decode_token(credentials.credentials)
    user    = db_get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


# ── Request models ─────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email:    str
    password: str
    name:     str

class LoginRequest(BaseModel):
    email:    str
    password: str


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post("/register", status_code=201)
def register(req: RegisterRequest):
    email = req.email.strip().lower()
    name  = req.name.strip()

    if not email or not req.password or not name:
        raise HTTPException(status_code=400, detail="email, password, and name are required")
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    if db_get_user_by_email(email):
        raise HTTPException(status_code=409, detail="An account with this email already exists")

    user_id = str(uuid.uuid4())
    user    = db_create_user(user_id, email, hash_password(req.password), name)
    token   = create_token(user_id)

    return {"token": token, "user": {
        "id":    str(user["id"]),
        "email": user["email"],
        "name":  user["name"],
        "plan":  user["plan"],
    }}


@router.post("/login")
def login(req: LoginRequest):
    user = db_get_user_by_email(req.email)
    if not user or not user.get("password_hash"):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("UPDATE users SET last_seen = NOW() WHERE id = %s", (str(user["id"]),))
        conn.commit()
    finally:
        conn.close()

    return {"token": create_token(str(user["id"])), "user": {
        "id":    str(user["id"]),
        "email": user["email"],
        "name":  user["name"],
        "plan":  user["plan"],
    }}


@router.get("/me")
def me(current_user: dict = Depends(get_current_user)):
    return {
        "id":    str(current_user["id"]),
        "email": current_user["email"],
        "name":  current_user["name"],
        "plan":  current_user["plan"],
    }
