import os
import uuid
import secrets
import smtplib
from datetime import datetime, timedelta
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import RedirectResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import bcrypt as _bcrypt
from jose import jwt, JWTError
from pydantic import BaseModel
from typing import Optional

from database import (
    get_connection,
    db_set_verification_token,
    db_get_user_by_verification_token,
    db_verify_email,
    db_update_name,
    db_update_password,
    db_get_password_hash,
    db_set_pending_email,
    db_get_user_by_email_change_token,
    db_confirm_email_change,
    db_update_email,
    db_cancel_email_change,
)

SECRET_KEY        = os.getenv("JWT_SECRET", "change-me-use-a-long-random-string-in-production")
ALGORITHM         = "HS256"
TOKEN_EXPIRE_DAYS = 30

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


# ── Email helper ───────────────────────────────────────────────────────────────

def _smtp_configured() -> bool:
    return bool(os.getenv("SMTP_HOST"))

def _effective_verified(user: dict) -> bool:
    """When SMTP is off everyone is auto-verified; when SMTP is on use DB value."""
    return not _smtp_configured() or bool(user.get("email_verified"))

def send_verification_email(to_email: str, name: str, token: str):
    if not _smtp_configured():
        return  # SMTP not set up — skip silently

    api_url      = os.getenv("API_BASE_URL",  "http://localhost:8000")
    frontend_url = os.getenv("FRONTEND_URL",  "http://localhost:5173")
    smtp_host    = os.getenv("SMTP_HOST")
    smtp_port    = int(os.getenv("SMTP_PORT", "587"))
    smtp_user    = os.getenv("SMTP_USER", "")
    smtp_pass    = os.getenv("SMTP_PASSWORD", "")
    smtp_from    = os.getenv("SMTP_FROM", smtp_user)

    verify_url = f"{api_url}/auth/verify-email?token={token}"
    first_name = name.split()[0] if name else "there"

    html = f"""
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#020617;font-family:system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 16px;">
      <table width="480" cellpadding="0" cellspacing="0"
             style="background:#0f172a;border-radius:20px;border:1px solid #1e293b;overflow:hidden;">
        <tr>
          <td style="padding:40px 40px 0;text-align:center;">
            <div style="display:inline-flex;width:56px;height:56px;border-radius:14px;
                        background:linear-gradient(135deg,#10b981,#14b8a6);
                        align-items:center;justify-content:center;margin-bottom:16px;">
              <span style="font-size:28px;">M</span>
            </div>
            <h1 style="margin:0;color:#fff;font-size:24px;font-weight:900;">
              Mock<span style="color:#10b981;">Mate</span>
            </h1>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px;">
            <p style="color:#e2e8f0;font-size:16px;margin:0 0 8px;">
              Hi {first_name} 👋
            </p>
            <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:0 0 28px;">
              Thanks for signing up! Click the button below to verify your email address
              and activate your MockMate account.
            </p>
            <div style="text-align:center;margin-bottom:28px;">
              <a href="{verify_url}"
                 style="display:inline-block;background:linear-gradient(135deg,#10b981,#14b8a6);
                        color:#fff;font-weight:700;font-size:15px;text-decoration:none;
                        padding:14px 32px;border-radius:12px;">
                Verify Email Address
              </a>
            </div>
            <p style="color:#475569;font-size:12px;text-align:center;margin:0;">
              Button not working? Copy this link:<br/>
              <a href="{verify_url}" style="color:#10b981;word-break:break-all;">{verify_url}</a>
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 40px;border-top:1px solid #1e293b;text-align:center;">
            <p style="color:#334155;font-size:11px;margin:0;">
              If you didn't create a MockMate account, you can safely ignore this email.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
"""

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Verify your MockMate account"
    msg["From"]    = smtp_from
    msg["To"]      = to_email
    msg.attach(MIMEText(html, "html"))

    try:
        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.ehlo()
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.sendmail(smtp_from, to_email, msg.as_string())
        print(f"  ✅ Verification email sent to {to_email}")
    except Exception as e:
        print(f"  ⚠️  Failed to send verification email: {e}")


# ── DB helpers ─────────────────────────────────────────────────────────────────

def db_get_user_by_email(email: str) -> dict | None:
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, email, password_hash, name, plan, email_verified FROM users WHERE email = %s",
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
                "SELECT id, email, name, plan, email_verified, pending_email FROM users WHERE id = %s",
                (user_id,)
            )
            row = cur.fetchone()
            if not row:
                return None
            cols = [d[0] for d in cur.description]
            return dict(zip(cols, row))
    finally:
        conn.close()

def db_create_user(user_id: str, email: str, password_hash: str, name: str,
                   email_verified: bool = False, verification_token: str | None = None) -> dict:
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO users (id, email, password_hash, name, plan, email_verified, verification_token)
                VALUES (%s, %s, %s, %s, 'free', %s, %s)
                RETURNING id, email, name, plan, email_verified
            """, (user_id, email, password_hash, name, email_verified, verification_token))
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

class UpdateProfileRequest(BaseModel):
    name: str

class UpdatePasswordRequest(BaseModel):
    current_password: str
    new_password:     str

class ChangeEmailRequest(BaseModel):
    new_email: str


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

    if _smtp_configured():
        # Create unverified user, send email
        ver_token = secrets.token_urlsafe(32)
        db_create_user(user_id, email, hash_password(req.password), name,
                       email_verified=False, verification_token=ver_token)
        send_verification_email(email, name, ver_token)
        return {"needs_verification": True, "email": email}
    else:
        # No SMTP — auto-verify and log in immediately
        user  = db_create_user(user_id, email, hash_password(req.password), name,
                               email_verified=True)
        token = create_token(user_id)
        return {"token": token, "user": {
            "id":             str(user["id"]),
            "email":          user["email"],
            "name":           user["name"],
            "plan":           user["plan"],
            "email_verified": True,
        }}


@router.post("/login")
def login(req: LoginRequest):
    user = db_get_user_by_email(req.email)
    if not user or not user.get("password_hash"):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if _smtp_configured() and not user.get("email_verified"):
        raise HTTPException(status_code=403, detail="Please verify your email before logging in.")

    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("UPDATE users SET last_seen = NOW() WHERE id = %s", (str(user["id"]),))
            # Auto-verify in DB when SMTP is off so the flag stays consistent
            if not _smtp_configured() and not user.get("email_verified"):
                cur.execute("UPDATE users SET email_verified = TRUE WHERE id = %s", (str(user["id"]),))
        conn.commit()
    finally:
        conn.close()

    return {"token": create_token(str(user["id"])), "user": {
        "id":             str(user["id"]),
        "email":          user["email"],
        "name":           user["name"],
        "plan":           user["plan"],
        "email_verified": _effective_verified(user),
    }}


@router.get("/verify-email")
def verify_email(token: str):
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
    user = db_get_user_by_verification_token(token)
    if not user:
        return RedirectResponse(f"{frontend_url}?verified=error")
    db_verify_email(str(user["id"]))
    return RedirectResponse(f"{frontend_url}?verified=true")


@router.get("/me")
def me(current_user: dict = Depends(get_current_user)):
    return {
        "id":             str(current_user["id"]),
        "email":          current_user["email"],
        "name":           current_user["name"],
        "plan":           current_user["plan"],
        "email_verified": _effective_verified(current_user),
        "pending_email":  current_user.get("pending_email"),
    }


@router.post("/resend-verification")
def resend_verification(current_user: dict = Depends(get_current_user)):
    if not _smtp_configured():
        raise HTTPException(status_code=400, detail="Email verification is not enabled on this server.")
    if current_user.get("email_verified"):
        raise HTTPException(status_code=400, detail="Email is already verified.")
    ver_token = secrets.token_urlsafe(32)
    db_set_verification_token(str(current_user["id"]), ver_token)
    send_verification_email(current_user["email"], current_user["name"] or "", ver_token)
    return {"ok": True}


def send_email_change_email(to_email: str, name: str, token: str):
    if not _smtp_configured():
        return

    api_url      = os.getenv("API_BASE_URL",  "http://localhost:8000")
    smtp_host    = os.getenv("SMTP_HOST")
    smtp_port    = int(os.getenv("SMTP_PORT", "587"))
    smtp_user    = os.getenv("SMTP_USER", "")
    smtp_pass    = os.getenv("SMTP_PASSWORD", "")
    smtp_from    = os.getenv("SMTP_FROM", smtp_user)

    confirm_url = f"{api_url}/auth/verify-email-change?token={token}"
    first_name  = name.split()[0] if name else "there"

    html = f"""
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#020617;font-family:system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 16px;">
      <table width="480" cellpadding="0" cellspacing="0"
             style="background:#0f172a;border-radius:20px;border:1px solid #1e293b;overflow:hidden;">
        <tr>
          <td style="padding:40px 40px 0;text-align:center;">
            <div style="display:inline-flex;width:56px;height:56px;border-radius:14px;
                        background:linear-gradient(135deg,#10b981,#14b8a6);
                        align-items:center;justify-content:center;margin-bottom:16px;">
              <span style="font-size:28px;">M</span>
            </div>
            <h1 style="margin:0;color:#fff;font-size:24px;font-weight:900;">
              Mock<span style="color:#10b981;">Mate</span>
            </h1>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px;">
            <p style="color:#e2e8f0;font-size:16px;margin:0 0 8px;">
              Hi {first_name} 👋
            </p>
            <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:0 0 28px;">
              You requested to change your MockMate email address to this address.
              Click the button below to confirm the change.
            </p>
            <div style="text-align:center;margin-bottom:28px;">
              <a href="{confirm_url}"
                 style="display:inline-block;background:linear-gradient(135deg,#10b981,#14b8a6);
                        color:#fff;font-weight:700;font-size:15px;text-decoration:none;
                        padding:14px 32px;border-radius:12px;">
                Confirm New Email
              </a>
            </div>
            <p style="color:#475569;font-size:12px;text-align:center;margin:0;">
              Button not working? Copy this link:<br/>
              <a href="{confirm_url}" style="color:#10b981;word-break:break-all;">{confirm_url}</a>
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 40px;border-top:1px solid #1e293b;text-align:center;">
            <p style="color:#334155;font-size:11px;margin:0;">
              If you didn't request this change, you can safely ignore this email.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
"""

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Confirm your new MockMate email address"
    msg["From"]    = smtp_from
    msg["To"]      = to_email
    msg.attach(MIMEText(html, "html"))

    try:
        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.ehlo()
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.sendmail(smtp_from, to_email, msg.as_string())
        print(f"  ✅ Email change confirmation sent to {to_email}")
    except Exception as e:
        print(f"  ⚠️  Failed to send email change confirmation: {e}")


@router.patch("/email")
def change_email(req: ChangeEmailRequest, current_user: dict = Depends(get_current_user)):
    new_email = req.new_email.strip().lower()
    if not new_email or "@" not in new_email:
        raise HTTPException(status_code=400, detail="Invalid email address")
    if new_email == current_user["email"]:
        raise HTTPException(status_code=400, detail="This is already your current email address")
    if db_get_user_by_email(new_email):
        raise HTTPException(status_code=409, detail="This email is already in use by another account")

    if _smtp_configured():
        token = secrets.token_urlsafe(32)
        db_set_pending_email(str(current_user["id"]), new_email, token)
        send_email_change_email(new_email, current_user["name"] or "", token)
        return {"pending": True, "email": new_email}
    else:
        db_update_email(str(current_user["id"]), new_email)
        return {"pending": False, "email": new_email}


@router.get("/verify-email-change")
def verify_email_change_route(token: str):
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
    user = db_get_user_by_email_change_token(token)
    if not user or not user.get("pending_email"):
        return RedirectResponse(f"{frontend_url}?email_change_error=true")
    if db_get_user_by_email(user["pending_email"]):
        return RedirectResponse(f"{frontend_url}?email_change_error=taken")
    db_confirm_email_change(str(user["id"]))
    return RedirectResponse(f"{frontend_url}?email_changed=true")


@router.post("/cancel-email-change")
def cancel_email_change(current_user: dict = Depends(get_current_user)):
    db_cancel_email_change(str(current_user["id"]))
    return {"ok": True}


@router.patch("/profile")
def update_profile(req: UpdateProfileRequest, current_user: dict = Depends(get_current_user)):
    name = req.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name cannot be empty")
    db_update_name(str(current_user["id"]), name)
    return {"ok": True, "name": name}


@router.patch("/password")
def update_password(req: UpdatePasswordRequest, current_user: dict = Depends(get_current_user)):
    if len(req.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters")
    current_hash = db_get_password_hash(str(current_user["id"]))
    if not current_hash or not verify_password(req.current_password, current_hash):
        raise HTTPException(status_code=401, detail="Current password is incorrect")
    db_update_password(str(current_user["id"]), hash_password(req.new_password))
    return {"ok": True}
