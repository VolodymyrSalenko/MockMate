import os
import time
import re
import uuid
import secrets
import smtplib
from datetime import datetime, timedelta
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.responses import RedirectResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import bcrypt as _bcrypt
from jose import jwt, JWTError
from pydantic import BaseModel
from typing import Optional
from rate_limit import limiter

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
    db_set_reset_token,
    db_get_user_by_reset_token,
    db_clear_reset_token,
)

_jwt_secret = os.getenv("JWT_SECRET")
if not _jwt_secret:
    raise RuntimeError("JWT_SECRET environment variable is required but not set")
SECRET_KEY        = _jwt_secret
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

_EMAIL_REGEX = re.compile(r'^[^\s@]+@[^\s@]+\.[^\s@]{2,}$')

def _valid_email(email: str) -> bool:
    return bool(_EMAIL_REGEX.match(email))


def create_token(user_id: str, version: int = 0) -> str:
    expire = datetime.utcnow() + timedelta(days=TOKEN_EXPIRE_DAYS)
    return jwt.encode({"sub": user_id, "ver": version, "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)

def decode_token(token: str) -> str:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload["sub"]
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


# ── Email-token helpers ────────────────────────────────────────────────────────

def _make_token(hours: int = 24) -> str:
    """Return a URL-safe token with a 24-hour expiry encoded in it."""
    raw = secrets.token_urlsafe(32)
    exp = int(time.time()) + hours * 3600
    return f"{raw}.{exp}"

def _token_expired(token: str) -> bool:
    """True if the token is malformed or past its expiry timestamp."""
    try:
        _, exp = token.rsplit(".", 1)
        return int(exp) < int(time.time())
    except (ValueError, TypeError):
        return True


# ── Email helper ───────────────────────────────────────────────────────────────

def _smtp_configured() -> bool:
    return bool(os.getenv("SMTP_HOST"))

def _effective_verified(user: dict) -> bool:
    """When SMTP is off everyone is auto-verified; when SMTP is on use DB value."""
    return not _smtp_configured() or bool(user.get("email_verified"))

def _send_email(
    to_email: str,
    subject: str,
    first_name: str,
    body_text: str,
    cta_url: str,
    cta_label: str,
    footer: str,
):
    """Send a branded HTML + plain-text email. No-op if SMTP is not configured."""
    if not _smtp_configured():
        return

    smtp_host = os.getenv("SMTP_HOST")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER", "")
    smtp_pass = os.getenv("SMTP_PASSWORD", "")
    smtp_from = os.getenv("SMTP_FROM", smtp_user)

    plain = (
        f"Hi {first_name},\n\n"
        f"{body_text}\n\n"
        f"{cta_label}:\n{cta_url}\n\n"
        f"{footer}\n\n"
        f"— MockMate"
    )

    html = f"""<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#020617;font-family:system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 16px;">
      <table width="480" cellpadding="0" cellspacing="0"
             style="background:#0f172a;border-radius:20px;border:1px solid #1e293b;overflow:hidden;">
        <tr>
          <td style="padding:40px 40px 0;text-align:center;">
            <div style="display:inline-block;width:56px;height:56px;border-radius:14px;
                        background:linear-gradient(135deg,#10b981,#14b8a6);
                        line-height:56px;text-align:center;margin-bottom:16px;">
              <span style="font-size:28px;color:#fff;font-weight:900;">M</span>
            </div>
            <h1 style="margin:0;color:#fff;font-size:24px;font-weight:900;">
              Mock<span style="color:#10b981;">Mate</span>
            </h1>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px;">
            <p style="color:#e2e8f0;font-size:16px;margin:0 0 8px;">Hi {first_name},</p>
            <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:0 0 28px;">{body_text}</p>
            <div style="text-align:center;margin-bottom:28px;">
              <a href="{cta_url}"
                 style="display:inline-block;background:linear-gradient(135deg,#10b981,#14b8a6);
                        color:#fff;font-weight:700;font-size:15px;text-decoration:none;
                        padding:14px 32px;border-radius:12px;">
                {cta_label}
              </a>
            </div>
            <p style="color:#475569;font-size:12px;text-align:center;margin:0;">
              Button not working? Copy this link:<br/>
              <a href="{cta_url}" style="color:#10b981;word-break:break-all;">{cta_url}</a>
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 40px;border-top:1px solid #1e293b;text-align:center;">
            <p style="color:#334155;font-size:11px;margin:0;">{footer}</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""

    brevo_api_key = os.getenv("BREVO_API_KEY")
    if brevo_api_key:
        try:
            import httpx
            with httpx.Client(timeout=30) as client:
                r = client.post(
                    "https://api.brevo.com/v3/smtp/email",
                    headers={"api-key": brevo_api_key, "Content-Type": "application/json"},
                    json={
                        "sender": {"email": smtp_from, "name": "MockMate"},
                        "to": [{"email": to_email}],
                        "subject": subject,
                        "htmlContent": html,
                        "textContent": plain,
                    },
                )
                r.raise_for_status()
            print(f"  ✅ Email sent to {to_email}: {subject}")
        except Exception as e:
            print(f"  ⚠️  Failed to send email to {to_email}: {e}")
        return

    msg = MIMEMultipart("alternative")
    msg["Subject"]    = subject
    msg["From"]       = smtp_from
    msg["To"]         = to_email
    msg["Message-ID"] = f"<{uuid.uuid4()}@mockmate>"
    msg.attach(MIMEText(plain, "plain"))
    msg.attach(MIMEText(html,  "html"))

    try:
        if smtp_port == 465:
            with smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=30) as server:
                server.login(smtp_user, smtp_pass)
                server.sendmail(smtp_from, to_email, msg.as_string())
        else:
            with smtplib.SMTP(smtp_host, smtp_port, timeout=30) as server:
                server.ehlo()
                server.starttls()
                server.login(smtp_user, smtp_pass)
                server.sendmail(smtp_from, to_email, msg.as_string())
        print(f"  ✅ Email sent to {to_email}: {subject}")
    except Exception as e:
        print(f"  ⚠️  Failed to send email to {to_email}: {e}")


def send_verification_email(to_email: str, name: str, token: str):
    api_url    = os.getenv("API_BASE_URL", "http://localhost:8000")
    first_name = name.split()[0] if name else "there"
    _send_email(
        to_email,
        subject    = "Verify your MockMate account",
        first_name = first_name,
        body_text  = "Thanks for signing up! Click the button below to verify your email address and activate your MockMate account.",
        cta_url    = f"{api_url}/auth/verify-email?token={token}",
        cta_label  = "Verify Email Address",
        footer     = "If you didn't create a MockMate account, you can safely ignore this email.",
    )


def send_email_change_email(to_email: str, name: str, token: str):
    api_url    = os.getenv("API_BASE_URL", "http://localhost:8000")
    first_name = name.split()[0] if name else "there"
    _send_email(
        to_email,
        subject    = "Confirm your new MockMate email address",
        first_name = first_name,
        body_text  = "You requested to change your MockMate email address to this address. Click the button below to confirm the change.",
        cta_url    = f"{api_url}/auth/verify-email-change?token={token}",
        cta_label  = "Confirm New Email",
        footer     = "If you didn't request this change, you can safely ignore this email.",
    )


def send_password_reset_email(to_email: str, name: str, token: str):
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
    first_name   = name.split()[0] if name else "there"
    _send_email(
        to_email,
        subject    = "Reset your MockMate password",
        first_name = first_name,
        body_text  = "You requested a password reset for your MockMate account. Click the button below to choose a new password. This link expires in 1 hour.",
        cta_url    = f"{frontend_url}?reset_token={token}",
        cta_label  = "Reset Password",
        footer     = "If you didn't request a password reset, you can safely ignore this email — your password won't change.",
    )


# ── DB helpers ─────────────────────────────────────────────────────────────────

def db_get_user_by_email(email: str) -> dict | None:
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, email, password_hash, name, plan, email_verified, token_version FROM users WHERE email = %s",
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
                "SELECT id, email, name, plan, email_verified, pending_email, ai_consent, is_admin, token_version FROM users WHERE id = %s",
                (user_id,)
            )
            row = cur.fetchone()
            if not row:
                return None
            cols = [d[0] for d in cur.description]
            return dict(zip(cols, row))
    finally:
        conn.close()

def _db_increment_token_version(user_id: str):
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE users SET token_version = COALESCE(token_version, 0) + 1 WHERE id = %s",
                (user_id,)
            )
        conn.commit()
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
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = db_get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    if payload.get("ver", 0) != (user.get("token_version") or 0):
        raise HTTPException(status_code=401, detail="Session expired — please log in again")
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

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    token:        str
    new_password: str


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post("/register", status_code=201)
@limiter.limit("5/minute")
def register(request: Request, req: RegisterRequest):
    email = req.email.strip().lower()
    name  = req.name.strip()

    if not email or not _valid_email(email) or not req.password or not name:
        raise HTTPException(status_code=400, detail="Valid email, password, and name are required")
    if len(req.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    if db_get_user_by_email(email):
        raise HTTPException(status_code=409, detail="An account with this email already exists")

    user_id = str(uuid.uuid4())

    if _smtp_configured():
        ver_token = _make_token()
        db_create_user(user_id, email, hash_password(req.password), name,
                       email_verified=False, verification_token=ver_token)
        send_verification_email(email, name, ver_token)
        return {"needs_verification": True, "email": email}
    else:
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
@limiter.limit("10/minute")
def login(request: Request, req: LoginRequest):
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
            if not _smtp_configured() and not user.get("email_verified"):
                cur.execute("UPDATE users SET email_verified = TRUE WHERE id = %s", (str(user["id"]),))
        conn.commit()
    finally:
        conn.close()

    return {"token": create_token(str(user["id"]), version=user.get("token_version") or 0), "user": {
        "id":             str(user["id"]),
        "email":          user["email"],
        "name":           user["name"],
        "plan":           user["plan"],
        "email_verified": _effective_verified(user),
    }}


@router.get("/verify-email")
def verify_email(token: str):
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
    if _token_expired(token):
        return RedirectResponse(f"{frontend_url}?verified=error")
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
        "ai_consent":     current_user.get("ai_consent"),
        "is_admin":       bool(current_user.get("is_admin")),
    }


@router.post("/resend-verification")
def resend_verification(current_user: dict = Depends(get_current_user)):
    if not _smtp_configured():
        raise HTTPException(status_code=400, detail="Email verification is not enabled on this server.")
    if current_user.get("email_verified"):
        raise HTTPException(status_code=400, detail="Email is already verified.")
    ver_token = _make_token()
    db_set_verification_token(str(current_user["id"]), ver_token)
    send_verification_email(current_user["email"], current_user["name"] or "", ver_token)
    return {"ok": True}


@router.patch("/email")
def change_email(req: ChangeEmailRequest, current_user: dict = Depends(get_current_user)):
    new_email = req.new_email.strip().lower()
    if not new_email or not _valid_email(new_email):
        raise HTTPException(status_code=400, detail="Invalid email address")
    if new_email == current_user["email"]:
        raise HTTPException(status_code=400, detail="This is already your current email address")
    if db_get_user_by_email(new_email):
        raise HTTPException(status_code=409, detail="This email is already in use by another account")

    if _smtp_configured():
        token = _make_token()
        db_set_pending_email(str(current_user["id"]), new_email, token)
        send_email_change_email(new_email, current_user["name"] or "", token)
        return {"pending": True, "email": new_email}
    else:
        db_update_email(str(current_user["id"]), new_email)
        return {"pending": False, "email": new_email}


@router.get("/verify-email-change")
def verify_email_change_route(token: str):
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
    if _token_expired(token):
        return RedirectResponse(f"{frontend_url}?email_change_error=true")
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


class AIConsentRequest(BaseModel):
    consent: bool

@router.post("/ai-consent")
def set_ai_consent(req: AIConsentRequest, current_user: dict = Depends(get_current_user)):
    """Record the user's consent decision for AI data processing (Swiss DSG / GDPR Art. 6)."""
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE users SET ai_consent = %s, ai_consent_at = NOW() WHERE id = %s",
                (req.consent, str(current_user["id"]))
            )
        conn.commit()
    finally:
        conn.close()
    return {"ok": True, "ai_consent": req.consent}


@router.delete("/account")
def delete_account(current_user: dict = Depends(get_current_user)):
    """Permanently erase all data for the authenticated user (Swiss DSG / GDPR right to erasure)."""
    user_id = str(current_user["id"])
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM sessions   WHERE user_id = %s", (user_id,))  # cascades to answers
            cur.execute("DELETE FROM cv_profiles WHERE user_id = %s", (user_id,))
            cur.execute("DELETE FROM users       WHERE id      = %s", (user_id,))
        conn.commit()
    finally:
        conn.close()
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
    if len(req.new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters")
    current_hash = db_get_password_hash(str(current_user["id"]))
    if not current_hash or not verify_password(req.current_password, current_hash):
        raise HTTPException(status_code=401, detail="Current password is incorrect")
    db_update_password(str(current_user["id"]), hash_password(req.new_password))
    _db_increment_token_version(str(current_user["id"]))
    return {"ok": True}


@router.post("/forgot-password")
def forgot_password(req: ForgotPasswordRequest):
    # Always return success to avoid leaking which emails are registered
    email = req.email.strip().lower()
    user  = db_get_user_by_email(email)
    if user and user.get("email_verified"):
        token = _make_token(hours=1)
        db_set_reset_token(str(user["id"]), token)
        send_password_reset_email(email, user.get("name") or "", token)
    return {"ok": True}


@router.post("/reset-password")
def reset_password(req: ResetPasswordRequest):
    if len(req.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    if _token_expired(req.token):
        raise HTTPException(status_code=400, detail="Reset link has expired. Please request a new one.")
    user = db_get_user_by_reset_token(req.token)
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or already-used reset link.")
    db_update_password(str(user["id"]), hash_password(req.new_password))
    db_clear_reset_token(str(user["id"]))
    return {"ok": True}
