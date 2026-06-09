import os
import hmac
import hashlib
import base64
import json

import httpx
from fastapi import APIRouter, HTTPException, Depends, Request, Header
from fastapi.security import HTTPAuthorizationCredentials

from auth import decode_token, bearer
from database import db

router = APIRouter(prefix="/billing", tags=["billing"])

POLAR_ACCESS_TOKEN   = os.getenv("POLAR_ACCESS_TOKEN", "")
POLAR_PRODUCT_ID     = os.getenv("POLAR_PRODUCT_ID", "")
POLAR_WEBHOOK_SECRET = os.getenv("POLAR_WEBHOOK_SECRET", "")
FRONTEND_URL         = os.getenv("FRONTEND_URL", "http://localhost:5173")
POLAR_API_BASE       = "https://api.polar.sh"


def _verify_polar_signature(raw_body: bytes, webhook_id: str, webhook_timestamp: str, webhook_signature: str) -> bool:
    """Standard Webhooks (https://www.standardwebhooks.com) signature verification."""
    secret = POLAR_WEBHOOK_SECRET
    if secret.startswith("whsec_"):
        secret = secret[6:]
    try:
        secret_bytes = base64.b64decode(secret)
    except Exception:
        return False

    msg = f"{webhook_id}.{webhook_timestamp}.{raw_body.decode('utf-8')}"
    expected = base64.b64encode(
        hmac.new(secret_bytes, msg.encode("utf-8"), hashlib.sha256).digest()
    ).decode("utf-8")

    sigs = [s.split(",", 1)[1] for s in webhook_signature.split(" ") if "," in s]
    return any(hmac.compare_digest(expected, s) for s in sigs)


@router.post("/checkout")
async def create_checkout(creds: HTTPAuthorizationCredentials = Depends(bearer)):
    user_id = decode_token(creds.credentials)

    if not POLAR_ACCESS_TOKEN or not POLAR_PRODUCT_ID:
        # 422 (not 5xx) so Render's proxy doesn't strip CORS headers
        raise HTTPException(status_code=422, detail="Billing not configured — contact support")

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                f"{POLAR_API_BASE}/v1/checkouts/custom/",
                headers={
                    "Authorization": f"Bearer {POLAR_ACCESS_TOKEN}",
                    "Content-Type": "application/json",
                },
                json={
                    "product_id": POLAR_PRODUCT_ID,
                    "success_url": f"{FRONTEND_URL}?checkout=success",
                    "metadata": {"user_id": user_id},
                },
            )
    except httpx.TimeoutException:
        raise HTTPException(status_code=408, detail="Checkout request timed out — please try again")
    except Exception:
        raise HTTPException(status_code=422, detail="Could not reach billing service — please try again")

    if resp.status_code not in (200, 201):
        raise HTTPException(status_code=422, detail=f"Checkout failed (Polar {resp.status_code}) — check your Polar product ID")

    data = resp.json()
    url = data.get("url") or data.get("checkout_url")
    if not url:
        raise HTTPException(status_code=422, detail="No checkout URL returned from Polar")

    return {"url": url}


@router.post("/webhook")
async def polar_webhook(
    request: Request,
    webhook_id: str | None        = Header(None, alias="webhook-id"),
    webhook_timestamp: str | None = Header(None, alias="webhook-timestamp"),
    webhook_signature: str | None = Header(None, alias="webhook-signature"),
):
    raw_body = await request.body()

    if not POLAR_WEBHOOK_SECRET:
        raise HTTPException(status_code=503, detail="Webhook not configured — POLAR_WEBHOOK_SECRET is required")
    if not all([webhook_id, webhook_timestamp, webhook_signature]):
        raise HTTPException(status_code=400, detail="Missing webhook headers")
    if not _verify_polar_signature(raw_body, webhook_id, webhook_timestamp, webhook_signature):
        raise HTTPException(status_code=403, detail="Invalid webhook signature")

    payload    = json.loads(raw_body)
    event_type = payload.get("type", "")
    data       = payload.get("data", {})
    meta       = data.get("metadata") or {}

    user_id  = meta.get("user_id")
    new_plan = None

    if event_type == "checkout.updated" and data.get("status") == "confirmed":
        new_plan = "pro"
    elif event_type == "subscription.created":
        new_plan = "pro"
    elif event_type == "subscription.updated":
        status = data.get("status", "")
        if status in ("canceled", "revoked"):
            new_plan = "free"
        elif status == "active":
            new_plan = "pro"

    if user_id and new_plan:
        _set_plan(user_id, new_plan)

    return {"ok": True}


def _set_plan(user_id: str, plan: str):
    with db() as conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE users SET plan = %s WHERE id = %s", (plan, user_id))
