from fastapi import APIRouter, Depends, HTTPException, Request, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
import hashlib
import json

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


@router.post("/{merchant_id}/import")
async def import_products(
    merchant_id: str,
    request: Request,
    store_id: int = Query(..., description="Store ID that will receive GMC items"),
    principal: Principal = Depends(require_roles("owner", "manager")),
    db: Session = Depends(get_db),
):
    """
    Importa produtos do GMC para os itens do feed da loja (source_type='gmc').
    - Cria/atualiza `Feed` e `FeedVersion`.
    - Upsert em `FeedItem` (chave única store_id+item_id).
    """
    # valida ownership
    store = (
        db.query(models.Store)
        .filter(models.Store.id == store_id, models.Store.account_id == principal["account_id"])
        .first()
    )
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")

    # require Google Content scope
    user = db.query(models.User).filter_by(email=principal["email"]).first()
    ga = db.query(models.GoogleAccount).filter_by(user_id=user.id).first() if user else None
    if not ga or not ga.content_scope_granted:
        raise HTTPException(status_code=400, detail="content scope not granted")

    # get or create feed
    feed = (
        db.query(models.Feed)
        .filter(models.Feed.store_id == store_id, models.Feed.source_type == "gmc")
        .first()
    )
    if not feed:
        feed = models.Feed(
            store_id=store_id,
            source_type="gmc",
            url=f"gmc:{merchant_id}",
            format="json",
        )
        db.add(feed)
        db.flush()

    # iterate all pages
    params = {"maxResults": 250}
    url = f"{settings.GOOGLE_API_BASE}/content/v2.1/{merchant_id}/products"
    products: list[dict] = []
    while True:
        res = await google_api_request(db, ga, "GET", url, params=params)
        data = res.json()
        products.extend(data.get("resources", []))
        token = data.get("nextPageToken")
        if not token:
            break
        params["pageToken"] = token

    # compute deterministic content hash for versioning
    hasher = hashlib.sha256()
    for p in sorted(products, key=lambda x: str(x.get("offerId") or x.get("id"))):
        price = (p.get("price") or {}).get("value") or ""
        curr = (p.get("price") or {}).get("currency") or ""
        parts = [
            str(p.get("offerId") or p.get("id") or ""),
            str(p.get("link") or ""),
            str(price),
            str(curr),
            str(p.get("availability") or ""),
        ]
        hasher.update("|".join(parts).encode())
    content_hash = hasher.hexdigest()

    # create version if different
    from app import models as m
    existing = (
        db.query(m.FeedVersion)
        .filter(m.FeedVersion.feed_id == feed.id, m.FeedVersion.content_hash == content_hash)
        .first()
    )
    if not existing:
        ver = m.FeedVersion(feed_id=feed.id, content_hash=content_hash, items_count=len(products))
        db.add(ver)
        db.flush()

    # upsert items
    upserted = 0
    for p in products:
        offer_id = str(p.get("offerId") or p.get("id") or "").strip()
        if not offer_id:
            continue
        price = p.get("price") or {}
        sale = p.get("salePrice") or {}
        def _to_cents(v: str | None) -> int | None:
            try:
                if v is None:
                    return None
                return int(round(float(v) * 100))
            except Exception:
                return None
        row = (
            db.query(models.FeedItem)
            .filter(models.FeedItem.store_id == store_id, models.FeedItem.item_id == offer_id)
            .first()
        )
        if row:
            row.feed_id = feed.id
            row.title = p.get("title")
            row.link_canonical = p.get("link")
            row.price_cents = _to_cents(price.get("value"))
            row.sale_price_cents = _to_cents(sale.get("value"))
            row.currency = price.get("currency")
            row.availability = p.get("availability")
            row.brand = p.get("brand")
            row.gtin = p.get("gtin")
            row.mpn = p.get("mpn")
            row.shipping_json = json.dumps(p.get("shipping") or [])
            row.raw_json = json.dumps(p)
            row.updated_at = func.now()
        else:
            row = models.FeedItem(
                store_id=store_id,
                feed_id=feed.id,
                item_id=offer_id,
                title=p.get("title"),
                link_canonical=p.get("link"),
                price_cents=_to_cents(price.get("value")),
                sale_price_cents=_to_cents(sale.get("value")),
                currency=price.get("currency"),
                availability=p.get("availability"),
                brand=p.get("brand"),
                gtin=p.get("gtin"),
                mpn=p.get("mpn"),
                shipping_json=json.dumps(p.get("shipping") or []),
                raw_json=json.dumps(p),
            )
            db.add(row)
        upserted += 1
    db.commit()

    # persist chosen merchant on store if not set
    if not store.google_merchant_id:
        store.google_merchant_id = str(merchant_id)
        db.add(store)
        db.commit()

    log_event("mc.import.ok", store_id=store_id, merchant_id=merchant_id, count=upserted)
    return {"imported": upserted, "items_total": len(products), "feed_id": feed.id, "content_hash": content_hash}
