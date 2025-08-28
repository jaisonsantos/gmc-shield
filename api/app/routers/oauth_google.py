import base64
import hashlib
import json
import secrets
import time
import urllib.parse
from datetime import datetime, timezone, timedelta
import os

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Query
from fastapi.responses import RedirectResponse
from itsdangerous import TimestampSigner, BadSignature, SignatureExpired
from jose import jwt
from sqlalchemy.orm import Session

from app.core.settings import Settings
from app.queue import get_redis
from app.db import get_db
from app import models
from app.auth import create_token
from app.crypto import encrypt_str
from app.observability import log_event


router = APIRouter()
settings = Settings()
signer = TimestampSigner(settings.effective_jwt_secret)


def _allowed_origins() -> list[str]:
    raw = os.getenv("ALLOWED_ORIGINS") or os.getenv("CORS_ORIGINS", "")
    return [o.strip() for o in raw.split(",") if o.strip()]


def _sanitize_return_to(path: str) -> str:
    try:
        parsed = urllib.parse.urlparse(path)
        if parsed.scheme or parsed.netloc:
            # Permite URLs absolutas apenas se o host está nas origens permitidas
            origins = _allowed_origins()
            if not origins:
                return "/"
            allowed = {urllib.parse.urlparse(o).netloc for o in origins if o}
            if parsed.netloc in allowed:
                return path
            return "/"
        if not parsed.path.startswith("/"):
            return "/"
        return parsed.path or "/"
    except Exception:
        return "/"


def _rate_limit(r, ip: str, key: str, limit: int = 10, window: int = 60) -> None:
    rl_key = f"rl:{key}:{ip}"
    count = r.incr(rl_key)
    if count == 1:
        r.expire(rl_key, window)
    if count > limit:
        raise HTTPException(status_code=429, detail="rate limited")


@router.get("/api/auth/google/start")
def auth_google_start(request: Request, return_to: str = "/"):
    r = get_redis()
    _rate_limit(r, request.client.host or "", "oauth:start")
    # Se não for fornecido, tenta deduzir a origem do frontend e usar /app/login
    if not return_to or return_to == "/":
        origin = request.headers.get("origin") or ""
        if origin:
            candidate = f"{origin}/login"
            rt = _sanitize_return_to(candidate)
            if rt != "/":
                return_to = rt
    return_to = _sanitize_return_to(return_to)

    state_id = secrets.token_urlsafe(16)
    payload = json.dumps({"return_to": return_to, "ts": int(time.time())})
    r.setex(f"oauth:state:{state_id}", 300, payload)

    code_verifier = secrets.token_urlsafe(64)
    r.setex(f"oauth:pkce:{state_id}", 300, code_verifier)
    nonce = secrets.token_urlsafe(16)
    r.setex(f"oauth:nonce:{state_id}", 300, nonce)
    signed_state = signer.sign(state_id).decode()

    code_challenge = base64.urlsafe_b64encode(
        hashlib.sha256(code_verifier.encode()).digest()
    ).rstrip(b"=").decode()

    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": str(settings.GOOGLE_OAUTH_REDIRECT_URI),
        "response_type": "code",
        "scope": settings.GOOGLE_OAUTH_SCOPES_BASE,
        "state": signed_state,
        "code_challenge": code_challenge,
        "code_challenge_method": "S256",
        "nonce": nonce,
        "access_type": "offline",
        "prompt": "consent",
    }
    auth_endpoint = str(settings.GOOGLE_AUTH_ENDPOINT) if settings.GOOGLE_AUTH_ENDPOINT else f"{settings.GOOGLE_OAUTH_ISSUER}/o/oauth2/v2/auth"
    auth_url = f"{auth_endpoint}?{urllib.parse.urlencode(params)}"
    log_event("oauth.start", return_to=return_to)
    return {"auth_url": auth_url}


@router.get("/api/auth/google/callback")
async def auth_google_callback(
    request: Request,
    state: str = Query(...),
    code: str = Query(...),
    db: Session = Depends(get_db),
):
    r = get_redis()
    _rate_limit(r, request.client.host or "", "oauth:cb")
    try:
        state_id = signer.unsign(state, max_age=300).decode()
    except (BadSignature, SignatureExpired):
        raise HTTPException(status_code=400, detail="invalid state")

    payload_raw = r.get(f"oauth:state:{state_id}")
    code_verifier = r.get(f"oauth:pkce:{state_id}")
    nonce = r.get(f"oauth:nonce:{state_id}")

    r.delete(f"oauth:state:{state_id}")
    r.delete(f"oauth:pkce:{state_id}")
    r.delete(f"oauth:nonce:{state_id}")

    if not payload_raw or not code_verifier or not nonce:
        raise HTTPException(status_code=400, detail="invalid or expired state")

    payload = json.loads(payload_raw)
    return_to = _sanitize_return_to(payload.get("return_to", "/"))

    token_endpoint = str(settings.GOOGLE_TOKEN_ENDPOINT) if settings.GOOGLE_TOKEN_ENDPOINT else "https://oauth2.googleapis.com/token"
    async with httpx.AsyncClient() as client:
        token_res = await client.post(
            token_endpoint,
            data={
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "code": code,
                "redirect_uri": str(settings.GOOGLE_OAUTH_REDIRECT_URI),
                "grant_type": "authorization_code",
                "code_verifier": code_verifier,
            },
        )
        if token_res.status_code != 200:
            log_event("oauth.callback.error", reason="token", status=token_res.status_code)
            raise HTTPException(status_code=400, detail="token exchange failed")
        token_data = token_res.json()

        id_token = token_data.get("id_token")
        if id_token:
            claims = jwt.get_unverified_claims(id_token)
            now = datetime.now(timezone.utc)
            if (
                claims.get("iss") != settings.GOOGLE_OAUTH_ISSUER
                or claims.get("aud") != settings.GOOGLE_CLIENT_ID
                or now.timestamp() > claims.get("exp", 0)
                or claims.get("nonce") != nonce
            ):
                log_event("oauth.callback.error", reason="id_token")
                raise HTTPException(status_code=400, detail="invalid id_token")

        access_token = token_data["access_token"]
        userinfo_endpoint = str(settings.GOOGLE_USERINFO_ENDPOINT) if settings.GOOGLE_USERINFO_ENDPOINT else f"{settings.GOOGLE_API_BASE}/oauth2/v3/userinfo"
        userinfo_res = await client.get(
            userinfo_endpoint,
            headers={"Authorization": f"Bearer {access_token}"},
        )
        if userinfo_res.status_code != 200:
            log_event("oauth.callback.error", reason="userinfo", status=userinfo_res.status_code)
            raise HTTPException(status_code=400, detail="failed userinfo")
        userinfo = userinfo_res.json()

    sub = userinfo["sub"]
    email = userinfo.get("email", "").lower()

    g_account = db.query(models.GoogleAccount).filter_by(sub=sub).first()
    if g_account:
        user = db.query(models.User).filter_by(id=g_account.user_id).first()
    else:
        user = db.query(models.User).filter_by(email=email).first()
        if not user:
            account = models.Account(name=email.split("@")[0], type="merchant")
            db.add(account)
            db.flush()
            user = models.User(account_id=account.id, email=email, password_hash="", role="owner")
            db.add(user)
            db.flush()
        g_account = models.GoogleAccount(user_id=user.id, sub=sub)
        db.add(g_account)

    g_account.email = email
    g_account.name = userinfo.get("name")
    g_account.picture = userinfo.get("picture")
    g_account.access_token_enc = encrypt_str(access_token)
    if token_data.get("refresh_token"):
        g_account.refresh_token_enc = encrypt_str(token_data["refresh_token"])
    g_account.token_expiry = datetime.now(timezone.utc) + timedelta(seconds=token_data.get("expires_in", 0))
    if g_account.content_scope_granted is None:
        g_account.content_scope_granted = False
    db.commit()

    app_token = create_token(user.email, user.role, user.account_id)
    target = return_to + ("&" if "?" in return_to else "?") + f"token={app_token}"
    resp = RedirectResponse(url=target)
    resp.set_cookie("token", app_token, httponly=True, samesite="lax")
    log_event("oauth.callback.ok", user_id=user.id)
    return resp
