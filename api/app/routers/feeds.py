from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, Query, Body, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy.sql import func
import httpx
from ..db import get_db
from .. import models, schemas
from ..auth import require_roles
from ..services.feed_ingest import parse_csv, parse_xml, normalize_row, compute_hash
from ..jobs import feed as feed_jobs

router = APIRouter()
router_v1 = APIRouter()

@router.post("/{store_id}/feed", summary="Configure feed", dependencies=[Depends(require_roles("owner","manager"))])
def set_feed(store_id: int, cfg: schemas.FeedConfig, db: Session = Depends(get_db)):
    feed = db.query(models.Feed).filter(models.Feed.store_id == store_id).first()
    if not feed:
        feed = models.Feed(store_id=store_id, source_type=cfg.source_type, url=cfg.url, format=cfg.format)
        db.add(feed)
    else:
        feed.source_type = cfg.source_type
        feed.url = cfg.url
        feed.format = cfg.format
    db.commit()
    return {"store_id": store_id, "configured": True, "format": cfg.format, "source_type": cfg.source_type}

@router.get(
    "/{store_id}/feed/versions",
    summary="Feed versions",
    dependencies=[Depends(require_roles("owner", "manager", "viewer"))],
)
@router_v1.get(
    "/stores/{store_id}/feeds/versions",
    summary="Feed versions",
    dependencies=[Depends(require_roles("owner", "manager", "viewer"))],
)
def feed_versions(store_id: int, db: Session = Depends(get_db)):
    feed = (
        db.query(models.Feed)
        .filter(models.Feed.store_id == store_id)
        .first()
    )
    if not feed:
        return {"items": []}
    versions = (
        db.query(models.FeedVersion)
        .filter(models.FeedVersion.feed_id == feed.id)
        .order_by(models.FeedVersion.created_at.desc())
        .all()
    )
    return {
        "items": [
            {
                "id": v.id,
                "hash": v.content_hash,
                "content_hash": v.content_hash,
                "items_count": v.items_count,
                "created_at": v.created_at,
            }
            for v in versions
        ]
    }


def _ingest_raw(db: Session, store_id: int, feed: models.Feed, raw: bytes, format: str, origin: str = ""):
    h = compute_hash(raw, origin)
    if feed.last_hash and feed.last_hash == h:
        return {"feed_id": feed.id, "content_hash": h, "hash": h, "items_imported": 0, "items_updated": 0, "skipped": "same-hash"}

    if format == "csv":
        rows = parse_csv(raw, delimiter=",")
    elif format == "tsv":
        rows = parse_csv(raw, delimiter="\t")
    elif format == "xml":
        rows = parse_xml(raw)
    else:
        raise HTTPException(400, "invalid format")

    items_count = imported = updated = 0
    for r in rows:
        items_count += 1
        n = normalize_row(r)
        if not n["item_id"]:
            continue
        existing = (
            db.query(models.FeedItem)
            .filter(models.FeedItem.store_id == store_id, models.FeedItem.item_id == n["item_id"])
            .first()
        )
        if existing:
            for k in (
                "title",
                "link_canonical",
                "price_cents",
                "sale_price_cents",
                "currency",
                "availability",
                "brand",
                "gtin",
                "mpn",
                "shipping_json",
                "raw_json",
            ):
                setattr(existing, k, n[k])
            updated += 1
        else:
            db.add(models.FeedItem(feed_id=feed.id, store_id=store_id, **n))
            imported += 1

    version = models.FeedVersion(feed_id=feed.id, content_hash=h, items_count=items_count)
    db.add(version)
    feed.last_hash = h
    feed.last_parsed_at = func.now()
    feed.last_item_count = items_count
    db.commit()

    return {
        "feed_id": feed.id,
        "content_hash": h,
        "hash": h,
        "version_id": version.id,
        "items_count": items_count,
        "items_imported": imported,
        "items_updated": updated,
    }


@router_v1.post(
    "/stores/{store_id}/feeds/ingest",
    summary="Ingest feed (URL or file)",
    dependencies=[Depends(require_roles("owner", "manager"))],
)
async def ingest_feed_v1(
    store_id: int,
    request: Request,
    url: str | None = Body(None),
    format_form: str | None = Form(None, alias="format"),
    format_json: str | None = Body(None, alias="format"),
    file: UploadFile | None = File(None),
    enqueue: bool = Query(False, alias="async"),
    db: Session = Depends(get_db),
):
    if request.headers.get("content-type", "").startswith("application/json"):
        body = await request.json()
        url = body.get("url", url)
        if format_json is None:
            format_json = body.get("format")
    feed = db.query(models.Feed).filter(models.Feed.store_id == store_id).first()
    feed_format = format_form or format_json or (feed.format if feed else None)
    raw = None
    origin = ""
    if file is not None:
        if not feed_format:
            raise HTTPException(400, "format is required")
        if not feed:
            feed = models.Feed(store_id=store_id, source_type="file", format=feed_format)
            db.add(feed)
            db.commit()
        raw = await file.read()
        origin = f"upload:{file.filename}" if getattr(file, "filename", None) else "upload"
    elif url:
        if not feed:
            if not feed_format:
                raise HTTPException(400, "format is required")
            feed = models.Feed(store_id=store_id, source_type="url", url=url, format=feed_format)
            db.add(feed)
            db.commit()
        else:
            feed.url = url
            if format_form or format_json:
                feed.format = feed_format
            db.commit()
        async with httpx.AsyncClient(timeout=30) as client:
            res = await client.get(url)
            res.raise_for_status()
            raw = res.content
        origin = url
    else:
        raise HTTPException(400, "url or file required")
    if enqueue:
        job_id = feed_jobs.enqueue(store_id, feed.id, raw, feed_format)
        return JSONResponse(status_code=202, content={"status": "queued", "job_id": job_id, "feed_id": feed.id})
    return _ingest_raw(db, store_id, feed, raw, feed_format, origin)


@router.post(
    "/{store_id}/feed/import",
    summary="Import feed (URL or file)",
    dependencies=[Depends(require_roles("owner", "manager"))],
)
async def import_feed(
    store_id: int,
    source_type: str = Form(...),
    format: str = Form(...),
    url: str | None = Form(None),
    file: UploadFile | None = File(None),
    enqueue: bool = Query(False, alias="async"),
    db: Session = Depends(get_db),
):
    feed = db.query(models.Feed).filter(models.Feed.store_id == store_id).first()
    if not feed:
        raise HTTPException(400, "Feed not configured")

    if source_type == "url":
        if not url:
            url = feed.url
        async with httpx.AsyncClient(timeout=30) as client:
            res = await client.get(url)
            res.raise_for_status()
            raw = res.content
        origin = url or ""
    elif source_type == "file":
        if not file:
            raise HTTPException(400, "file is required")
        raw = await file.read()
        origin = f"upload:{file.filename}" if getattr(file, "filename", None) else "upload"
    else:
        raise HTTPException(400, "invalid source_type")
    if enqueue:
        job_id = feed_jobs.enqueue(store_id, feed.id, raw, format)
        return JSONResponse(
            status_code=202,
            content={"status": "queued", "job_id": job_id, "feed_id": feed.id},
        )
    return _ingest_raw(db, store_id, feed, raw, format, origin)


@router.post(
    "/{store_id}/feed/ingest",
    summary="Ingest feed from configured URL",
    dependencies=[Depends(require_roles("owner", "manager"))],
)
async def ingest_from_url(
    store_id: int,
    enqueue: bool = Query(False, alias="async"),
    db: Session = Depends(get_db),
):
    feed = db.query(models.Feed).filter(models.Feed.store_id == store_id).first()
    if not feed or not feed.url:
        raise HTTPException(400, "Feed not configured")
    async with httpx.AsyncClient(timeout=30) as client:
        res = await client.get(feed.url)
        res.raise_for_status()
        raw = res.content
    origin = feed.url
    if enqueue:
        job_id = feed_jobs.enqueue(store_id, feed.id, raw, feed.format)
        return JSONResponse(
            status_code=202,
            content={"status": "queued", "job_id": job_id, "feed_id": feed.id},
        )
    return _ingest_raw(db, store_id, feed, raw, feed.format, origin)


@router.post(
    "/{store_id}/feed/upload",
    summary="Upload and ingest feed file",
    dependencies=[Depends(require_roles("owner", "manager"))],
)
async def upload_feed(
    store_id: int,
    format: str = Form(...),
    file: UploadFile = File(...),
    enqueue: bool = Query(False, alias="async"),
    db: Session = Depends(get_db),
):
    feed = db.query(models.Feed).filter(models.Feed.store_id == store_id).first()
    if not feed:
        feed = models.Feed(store_id=store_id, source_type="file", format=format)
        db.add(feed)
        db.commit()
    raw = await file.read()
    origin = f"upload:{file.filename}" if getattr(file, "filename", None) else "upload"
    if enqueue:
        job_id = feed_jobs.enqueue(store_id, feed.id, raw, format)
        return JSONResponse(
            status_code=202,
            content={"status": "queued", "job_id": job_id, "feed_id": feed.id},
        )
    return _ingest_raw(db, store_id, feed, raw, format, origin)


@router.get(
    "/{store_id}/items",
    summary="List feed items",
    dependencies=[Depends(require_roles("owner", "manager", "viewer"))],
)
def list_items(
    store_id: int,
    page: int = 1,
    limit: int = 50,
    db: Session = Depends(get_db),
):
    q = db.query(models.FeedItem).filter(models.FeedItem.store_id == store_id)
    total = q.count()
    items = (
        q.order_by(models.FeedItem.item_id)
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )
    return {
        "items": [schemas.FeedItemOut.model_validate(i).model_dump() for i in items],
        "page": page,
        "total": total,
    }


@router_v1.get(
    "/feeds/versions/{version_id}/items",
    summary="Items for feed version",
    dependencies=[Depends(require_roles("owner", "manager", "viewer"))],
)
def version_items(
    version_id: int,
    page: int = 1,
    limit: int = 50,
    db: Session = Depends(get_db),
):
    version = db.get(models.FeedVersion, version_id)
    if not version:
        raise HTTPException(404, "version not found")
    q = db.query(models.FeedItem).filter(models.FeedItem.feed_id == version.feed_id)
    total = q.count()
    items = (
        q.order_by(models.FeedItem.item_id)
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )
    return {
        "items": [schemas.FeedItemOut.model_validate(i).model_dump() for i in items],
        "page": page,
        "total": total,
    }
