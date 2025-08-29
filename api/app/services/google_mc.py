import httpx
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.settings import Settings
from app.crypto import decrypt_str, encrypt_str
from app.models import GoogleAccount
from app.observability import log_event

settings = Settings()

async def _refresh_token(db: Session, ga: GoogleAccount) -> str:
    refresh_token = decrypt_str(ga.refresh_token_enc)
    token_endpoint = (
        str(settings.GOOGLE_TOKEN_ENDPOINT)
        if settings.GOOGLE_TOKEN_ENDPOINT
        else "https://oauth2.googleapis.com/token"
    )
    log_event("oauth.refresh.start", user_id=ga.user_id)
    async with httpx.AsyncClient() as client:
        res = await client.post(
            token_endpoint,
            data={
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "grant_type": "refresh_token",
                "refresh_token": refresh_token,
            },
        )
    if res.status_code != 200:
        log_event("oauth.refresh.error", status=res.status_code, user_id=ga.user_id)
        raise HTTPException(status_code=401, detail="token refresh failed")
    data = res.json()
    ga.access_token_enc = encrypt_str(data["access_token"])
    if data.get("refresh_token"):
        ga.refresh_token_enc = encrypt_str(data["refresh_token"])
    ga.token_expiry = datetime.now(timezone.utc) + timedelta(seconds=data.get("expires_in", 0))
    db.commit()
    log_event("oauth.refresh.ok", user_id=ga.user_id)
    return decrypt_str(ga.access_token_enc)


async def _get_token(db: Session, ga: GoogleAccount) -> str:
    if not ga.access_token_enc or not ga.token_expiry:
        raise HTTPException(status_code=401, detail="no token")
    now = datetime.now(timezone.utc)
    expiry = ga.token_expiry
    if expiry.tzinfo is None:
        expiry = expiry.replace(tzinfo=timezone.utc)
    if expiry <= now + timedelta(seconds=60):
        return await _refresh_token(db, ga)
    return decrypt_str(ga.access_token_enc)


async def google_api_request(
    db: Session,
    ga: GoogleAccount,
    method: str,
    url: str,
    params: dict | None = None,
) -> httpx.Response:
    token = await _get_token(db, ga)
    headers = {"Authorization": f"Bearer {token}"}
    async with httpx.AsyncClient() as client:
        res = await client.request(method, url, params=params, headers=headers)
    if res.status_code == 401:
        token = await _refresh_token(db, ga)
        headers = {"Authorization": f"Bearer {token}"}
        async with httpx.AsyncClient() as client:
            res = await client.request(method, url, params=params, headers=headers)
        if res.status_code == 401:
            raise HTTPException(status_code=401, detail="unauthorized")
    if res.status_code == 403:
        try:
            err = res.json()
        except Exception:
            err = {}
        code = None
        if isinstance(err.get("error"), dict):
            code = err["error"].get("message")
        else:
            code = err.get("error")
        if code == "invalid_grant":
            raise HTTPException(status_code=403, detail="reconnect required")
        raise HTTPException(status_code=403, detail="forbidden")
    return res
