from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.auth import require_roles, Principal
from app.db import get_db
from app import models
from app.queue import get_redis
from app.observability import log_event
from app.core.settings import Settings

from .oauth_google import _rate_limit
from ..services.google_mc import google_api_request

router = APIRouter()
settings = Settings()

@router.get("/accounts")
async def list_accounts(
    request: Request,
    principal: Principal = Depends(require_roles("owner", "manager", "viewer")),
    db: Session = Depends(get_db),
):
    r = get_redis()
    _rate_limit(r, request.client.host or "", "mc:accounts")
    user = db.query(models.User).filter_by(email=principal["email"]).first()
    ga = db.query(models.GoogleAccount).filter_by(user_id=user.id).first() if user else None
    if not ga or not ga.content_scope_granted:
        raise HTTPException(status_code=400, detail="content scope not granted")
    url = f"{settings.GOOGLE_API_BASE}/content/v2.1/accounts/authinfo"
    res = await google_api_request(db, ga, "GET", url)
    log_event("mc.authinfo.ok", user_id=user.id if user else None)
    return res.json()


@router.get("/{merchant_id}/products")
async def list_products(
    merchant_id: str,
    request: Request,
    maxResults: int = 50,
    pageToken: str | None = None,
    principal: Principal = Depends(require_roles("owner", "manager", "viewer")),
    db: Session = Depends(get_db),
):
    r = get_redis()
    _rate_limit(r, request.client.host or "", "mc:products")
    user = db.query(models.User).filter_by(email=principal["email"]).first()
    ga = db.query(models.GoogleAccount).filter_by(user_id=user.id).first() if user else None
    if not ga or not ga.content_scope_granted:
        raise HTTPException(status_code=400, detail="content scope not granted")
    params = {"maxResults": maxResults}
    if pageToken:
        params["pageToken"] = pageToken
    url = f"{settings.GOOGLE_API_BASE}/content/v2.1/{merchant_id}/products"
    res = await google_api_request(db, ga, "GET", url, params=params)
    log_event("mc.products.ok", user_id=user.id if user else None, merchant_id=merchant_id)
    return res.json()
