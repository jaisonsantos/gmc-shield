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


def _parse_merchant_id_from_account_name(account_name: str) -> str:
    """
    Extract merchant ID from Merchant API account name format.
    Format: accounts/MERCHANT_ID
    """
    if account_name.startswith("accounts/"):
        return account_name.split("/", 1)[1]
    return account_name


@router.get("/accounts")
async def list_accounts(
    request: Request,
    principal: Principal = Depends(require_roles("owner", "manager", "viewer")),
    db: Session = Depends(get_db),
):
    """
    List all Merchant Center accounts accessible by the authenticated user.
    Uses Merchant API v1 instead of deprecated Content API v2.1.
    """
    r = get_redis()
    _rate_limit(r, request.client.host or "", "mc:accounts")
    user = db.query(models.User).filter_by(email=principal["email"]).first()
    ga = db.query(models.GoogleAccount).filter_by(user_id=user.id).first() if user else None
    if not ga or not ga.content_scope_granted:
        raise HTTPException(status_code=400, detail="content scope not granted")
    
    # Merchant API v1: GET /accounts/v1/accounts
    url = f"{settings.GOOGLE_MERCHANT_API_BASE}/accounts/v1/accounts"
    res = await google_api_request(db, ga, "GET", url)
    log_event("mc.authinfo.ok", user_id=user.id if user else None)
    return res.json()


@router.get("/{merchant_id}/products")
async def list_products(
    merchant_id: str,
    request: Request,
    pageSize: int = 50,
    pageToken: str | None = None,
    principal: Principal = Depends(require_roles("owner", "manager", "viewer")),
    db: Session = Depends(get_db),
):
    """
    List products for a merchant account.
    Uses Merchant API v1 instead of deprecated Content API v2.1.
    Note: parameter name changed from maxResults to pageSize (Merchant API standard).
    """
    r = get_redis()
    _rate_limit(r, request.client.host or "", "mc:products")
    user = db.query(models.User).filter_by(email=principal["email"]).first()
    ga = db.query(models.GoogleAccount).filter_by(user_id=user.id).first() if user else None
    if not ga or not ga.content_scope_granted:
        raise HTTPException(status_code=400, detail="content scope not granted")
    
    params = {"pageSize": pageSize}
    if pageToken:
        params["pageToken"] = pageToken
    
    # Merchant API v1: GET /products/v1/accounts/{account_id}/products
    url = f"{settings.GOOGLE_MERCHANT_API_BASE}/products/v1/accounts/{merchant_id}/products"
    res = await google_api_request(db, ga, "GET", url, params=params)
    log_event("mc.products.ok", user_id=user.id if user else None, merchant_id=merchant_id)
    return res.json()


def _extract_product_attributes(product: dict) -> dict:
    """
    Extract and normalize product attributes from Merchant API v1 response format.
    
    Merchant API v1 returns:
    {
      "name": "accounts/123/products/en~US~SKU123",
      "offerId": "SKU123",
      "productAttributes": {
        "title": "...",
        "link": "...",
        "availability": "IN_STOCK",
        "price": {
          "amountMicros": "15990000",
          "currencyCode": "USD"
        },
        ...
      }
    }
    """
    attrs = product.get("productAttributes", {})
    price_obj = attrs.get("price", {})
    sale_price_obj = attrs.get("salePrice", {})
    
    def _micros_to_cents(micros_str: str | None) -> int | None:
        """Convert amountMicros (millionths of currency unit) to cents."""
        try:
            if micros_str is None:
                return None
            micros = int(micros_str)
            return micros // 10_000  # 1 million micros = 100 cents
        except (ValueError, TypeError):
            return None
    
    return {
        "offerId": product.get("offerId") or product.get("id", ""),
        "title": attrs.get("title"),
        "link": attrs.get("link"),
        "availability": attrs.get("availability"),
        "price_cents": _micros_to_cents(price_obj.get("amountMicros")),
        "currency": price_obj.get("currencyCode"),
        "sale_price_cents": _micros_to_cents(sale_price_obj.get("amountMicros")),
        "brand": attrs.get("brand"),
        "gtin": attrs.get("gtin"),
        "mpn": attrs.get("mpn"),
        "shipping": attrs.get("shipping", []),
        "raw": product,
    }


@router.post("/{merchant_id}/import")
async def import_products(
    merchant_id: str,
    request: Request,
    store_id: int = Query(..., description="Store ID that will receive GMC items"),
    principal: Principal = Depends(require_roles("owner", "manager")),
    db: Session = Depends(get_db),
):
    """
    Import products from Merchant Center (via Merchant API v1) into feed items.
    - Creates/updates `Feed` and `FeedVersion`.
    - Upserts `FeedItem` (unique key: store_id + item_id).
    """
    # Validate ownership
    store = (
        db.query(models.Store)
        .filter(models.Store.id == store_id, models.Store.account_id == principal["account_id"])
        .first()
    )
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")

    # Require Google Content scope
    user = db.query(models.User).filter_by(email=principal["email"]).first()
    ga = db.query(models.GoogleAccount).filter_by(user_id=user.id).first() if user else None
    if not ga or not ga.content_scope_granted:
        raise HTTPException(status_code=400, detail="content scope not granted")

    # Get or create feed
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

    # Fetch all pages from Merchant API v1
    params = {"pageSize": 250}
    url = f"{settings.GOOGLE_MERCHANT_API_BASE}/products/v1/accounts/{merchant_id}/products"
    products: list[dict] = []
    
    while True:
        res = await google_api_request(db, ga, "GET", url, params=params)
        data = res.json()
        # Merchant API v1 uses "products" key instead of "resources"
        products.extend(data.get("products", []))
        token = data.get("nextPageToken")
        if not token:
            break
        params["pageToken"] = token

    # Compute deterministic content hash for versioning
    hasher = hashlib.sha256()
    for p in sorted(products, key=lambda x: str(x.get("offerId") or x.get("id"))):
        attrs = _extract_product_attributes(p)
        parts = [
            str(attrs.get("offerId") or ""),
            str(attrs.get("link") or ""),
            str(attrs.get("price_cents") or ""),
            str(attrs.get("currency") or ""),
            str(attrs.get("availability") or ""),
        ]
        hasher.update("|".join(parts).encode())
    content_hash = hasher.hexdigest()

    # Create version if different
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

    # Upsert items
    upserted = 0
    for p in products:
        attrs = _extract_product_attributes(p)
        offer_id = str(attrs.get("offerId", "")).strip()
        if not offer_id:
            continue

        row = (
            db.query(models.FeedItem)
            .filter(models.FeedItem.store_id == store_id, models.FeedItem.item_id == offer_id)
            .first()
        )
        if row:
            row.feed_id = feed.id
            row.title = attrs.get("title")
            row.link_canonical = attrs.get("link")
            row.price_cents = attrs.get("price_cents")
            row.sale_price_cents = attrs.get("sale_price_cents")
            row.currency = attrs.get("currency")
            row.availability = attrs.get("availability")
            row.brand = attrs.get("brand")
            row.gtin = attrs.get("gtin")
            row.mpn = attrs.get("mpn")
            row.shipping_json = json.dumps(attrs.get("shipping") or [])
            row.raw_json = json.dumps(attrs.get("raw"))
            row.updated_at = func.now()
        else:
            row = models.FeedItem(
                store_id=store_id,
                feed_id=feed.id,
                item_id=offer_id,
                title=attrs.get("title"),
                link_canonical=attrs.get("link"),
                price_cents=attrs.get("price_cents"),
                sale_price_cents=attrs.get("sale_price_cents"),
                currency=attrs.get("currency"),
                availability=attrs.get("availability"),
                brand=attrs.get("brand"),
                gtin=attrs.get("gtin"),
                mpn=attrs.get("mpn"),
                shipping_json=json.dumps(attrs.get("shipping") or []),
                raw_json=json.dumps(attrs.get("raw")),
            )
            db.add(row)
        upserted += 1
    db.commit()

    # Persist chosen merchant on store if not set
    if not store.google_merchant_id:
        store.google_merchant_id = str(merchant_id)
        db.add(store)
        db.commit()

    log_event("mc.import.ok", store_id=store_id, merchant_id=merchant_id, count=upserted)
    return {"imported": upserted, "items_total": len(products), "feed_id": feed.id, "content_hash": content_hash}
