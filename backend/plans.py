"""What each plan includes, and how many interviews are left.

The server checks every limit here; the pages only explain them. An interview counts when
it starts (its questions are generated), because that is when the AI costs begin.
"""
from datetime import datetime, timezone

from fastapi import HTTPException

from database import db

ALL_LANGUAGES = ["en-US", "de-DE", "fr-FR"]

_TRIAL = {
    "languages": ["en-US"],
    "premium_voice": False,          # the browser's own voice instead of ElevenLabs
    "video": False,                  # webcam recording and body language
    "coach": False,                  # the coach's review on the dashboard
    "cv_analysis": False,
    "retries_per_question": 1,
}

PLANS = {
    # Without an account: one interview to try MockMate
    "guest": {**_TRIAL, "interviews": 1, "per": "total"},
    # Signed up, email not confirmed yet: no interviews until it is
    "unverified": {**_TRIAL, "interviews": 0, "per": "total"},
    # A verified account
    "free":  {**_TRIAL, "interviews": 3, "per": "month"},
    # CHF 9.90 a month
    "pro": {
        "interviews": 30, "per": "month",
        "languages": ALL_LANGUAGES,
        "premium_voice": True,
        "video": True,
        "coach": True,
        "cv_analysis": True,
        "retries_per_question": 5,
    },
}

FEATURE_NAMES = {
    "premium_voice": "Natural interviewer voices",
    "video": "Video recording and body language",
    "coach": "The coach's review",
    "cv_analysis": "Resume analysis",
}


def plan_name(user: dict) -> str:
    if user.get("is_guest"):
        return "guest"
    if user.get("plan") == "pro":
        return "pro"
    return "free" if user.get("email_verified") else "unverified"


def plan_of(user: dict) -> dict:
    return PLANS[plan_name(user)]


def _month_start(now: datetime) -> datetime:
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


def _next_month_start(now: datetime) -> datetime:
    start = _month_start(now)
    return start.replace(year=start.year + 1, month=1) if start.month == 12 else start.replace(month=start.month + 1)


def usage(user: dict) -> dict:
    """The plan, how many interviews it allows, how many are used and what it includes."""
    name = plan_name(user)
    plan = PLANS[name]
    now = datetime.now(timezone.utc)
    since = None if plan["per"] == "total" else _month_start(now).replace(tzinfo=None)  # stored as naive UTC
    with db() as conn:
        with conn.cursor() as cur:
            if since is None:
                cur.execute("SELECT COUNT(*) FROM interview_usage WHERE user_id = %s", (str(user["id"]),))
            else:
                cur.execute("SELECT COUNT(*) FROM interview_usage WHERE user_id = %s AND created_at >= %s",
                            (str(user["id"]), since))
            used = cur.fetchone()[0]
    return {
        "plan": name,
        "used": used,
        "limit": plan["interviews"],
        "remaining": max(0, plan["interviews"] - used),
        "per": plan["per"],
        "resets_at": None if plan["per"] == "total" else _next_month_start(now).isoformat(),
        "features": {k: v for k, v in plan.items() if k not in ("interviews", "per")},
    }


def _deny(code: str, message: str):
    # 403 with a code the pages use to offer the right next step (sign up or upgrade)
    raise HTTPException(status_code=403, detail={"code": code, "message": message})


def check_new_interview(user: dict, language: str):
    """Raise 403 if this user may not start another interview, or not in this language."""
    u = usage(user)
    if language and language not in u["features"]["languages"]:
        _deny("upgrade", "Interviews in German and French are part of MockMate Pro.")
    if u["remaining"] > 0:
        return
    if u["plan"] == "unverified":
        _deny("verify", "Please confirm your email address first: we sent you a link.")
    if u["plan"] == "guest":
        _deny("signup", "You have used your free trial interview. Create a free account to get 3 interviews a month.")
    if u["plan"] == "free":
        _deny("upgrade", "You have used your 3 free interviews this month. Upgrade to Pro for 30 a month.")
    _deny("limit", "You have used your 30 interviews this month. They renew on the 1st.")


def record_interview(user: dict):
    with db() as conn:
        with conn.cursor() as cur:
            cur.execute("INSERT INTO interview_usage (user_id) VALUES (%s)", (str(user["id"]),))


def require_feature(user: dict, feature: str):
    if not plan_of(user).get(feature):
        _deny("upgrade", f"{FEATURE_NAMES.get(feature, 'This feature')} is part of MockMate Pro.")
