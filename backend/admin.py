from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from auth import get_current_user
from database import get_connection

router = APIRouter(prefix="/admin", tags=["admin"])




def require_admin(current_user: dict = Depends(get_current_user)):
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


# ── List users ─────────────────────────────────────────────────────────────────

@router.get("/users")
def list_users(search: str = "", page: int = Query(default=1, ge=1), limit: int = Query(default=25, ge=1, le=100), _: dict = Depends(require_admin)):
    offset = (page - 1) * limit
    conn   = get_connection()
    try:
        with conn.cursor() as cur:
            if search:
                like = f"%{search.lower()}%"
                cur.execute("""
                    SELECT id, email, name, plan, is_admin, ai_consent, created_at, last_seen,
                           (SELECT COUNT(*) FROM sessions WHERE user_id = users.id) AS session_count
                    FROM   users
                    WHERE  LOWER(email) LIKE %s OR LOWER(name) LIKE %s
                    ORDER  BY created_at DESC
                    LIMIT  %s OFFSET %s
                """, (like, like, limit, offset))
            else:
                cur.execute("""
                    SELECT id, email, name, plan, is_admin, ai_consent, created_at, last_seen,
                           (SELECT COUNT(*) FROM sessions WHERE user_id = users.id) AS session_count
                    FROM   users
                    ORDER  BY created_at DESC
                    LIMIT  %s OFFSET %s
                """, (limit, offset))

            cols  = [d[0] for d in cur.description]
            users = [dict(zip(cols, row)) for row in cur.fetchall()]

            if search:
                like = f"%{search.lower()}%"
                cur.execute(
                    "SELECT COUNT(*) FROM users WHERE LOWER(email) LIKE %s OR LOWER(name) LIKE %s",
                    (like, like),
                )
            else:
                cur.execute("SELECT COUNT(*) FROM users")
            total = cur.fetchone()[0]
    finally:
        conn.close()

    for u in users:
        u["id"] = str(u["id"])
        if u.get("created_at"):
            u["created_at"] = u["created_at"].isoformat()
        if u.get("last_seen"):
            u["last_seen"] = u["last_seen"].isoformat()

    return {"users": users, "total": total, "page": page, "pages": max(1, (total + limit - 1) // limit)}


# ── Set plan ───────────────────────────────────────────────────────────────────

class SetPlanRequest(BaseModel):
    plan: str

@router.patch("/users/{user_id}/plan")
def set_plan(user_id: str, req: SetPlanRequest, _: dict = Depends(require_admin)):
    if req.plan not in ("free", "pro"):
        raise HTTPException(status_code=400, detail="plan must be 'free' or 'pro'")
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("UPDATE users SET plan = %s WHERE id = %s", (req.plan, user_id))
            if cur.rowcount == 0:
                raise HTTPException(status_code=404, detail="User not found")
        conn.commit()
    finally:
        conn.close()
    return {"ok": True, "plan": req.plan}


# ── Toggle admin ───────────────────────────────────────────────────────────────

class SetAdminRequest(BaseModel):
    is_admin: bool

@router.patch("/users/{user_id}/admin")
def set_admin(user_id: str, req: SetAdminRequest, current_user: dict = Depends(require_admin)):
    if str(current_user["id"]) == user_id:
        raise HTTPException(status_code=400, detail="Cannot modify your own admin status")
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("UPDATE users SET is_admin = %s WHERE id = %s", (req.is_admin, user_id))
            if cur.rowcount == 0:
                raise HTTPException(status_code=404, detail="User not found")
        conn.commit()
    finally:
        conn.close()
    return {"ok": True, "is_admin": req.is_admin}


# ── Delete user ────────────────────────────────────────────────────────────────

@router.delete("/users/{user_id}")
def delete_user(user_id: str, current_user: dict = Depends(require_admin)):
    if str(current_user["id"]) == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account via admin panel")
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM sessions    WHERE user_id = %s", (user_id,))
            cur.execute("DELETE FROM cv_profiles WHERE user_id = %s", (user_id,))
            cur.execute("DELETE FROM users       WHERE id      = %s", (user_id,))
            if cur.rowcount == 0:
                raise HTTPException(status_code=404, detail="User not found")
        conn.commit()
    finally:
        conn.close()
    return {"ok": True}
