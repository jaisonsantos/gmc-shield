from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import Principal, require_roles
from ..db import get_db
from .. import models, schemas
from ..jobs import crawl

router = APIRouter()


@router.post("/{store_id}/scan", status_code=201)
def enqueue_scan(
    store_id: int,
    req: schemas.ScanRequest,
    principal: Principal = Depends(require_roles("owner", "manager")),
    db: Session = Depends(get_db),
):
    store = (
        db.query(models.Store)
        .filter(models.Store.id == store_id, models.Store.account_id == principal["account_id"])
        .first()
    )
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")

    items = []
    if req.item_id:
        item = (
            db.query(models.FeedItem)
            .filter(models.FeedItem.store_id == store_id, models.FeedItem.item_id == req.item_id)
            .first()
        )
        if not item or not item.link_canonical:
            raise HTTPException(status_code=404, detail="Item not found")
        items = [item]
    else:
        limit = req.limit_items or 20
        items = (
            db.query(models.FeedItem)
            .filter(models.FeedItem.store_id == store_id)
            .order_by(models.FeedItem.item_id)
            .limit(limit)
            .all()
        )

    run = models.ScanRun(
        store_id=store_id,
        requested_by=principal["email"],
        status="queued",
        items_total=len(items),
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    queued = 0
    for item in items:
        if not item.link_canonical:
            continue
        crawl.enqueue(store_id, run.id, item.item_id, item.link_canonical)
        queued += 1

    return {"run_id": run.id, "queued": queued, "items_total": len(items)}


@router.get("/{store_id}/runs/{run_id}/snapshots", response_model=list[schemas.PageSnapshotOut])
def list_snapshots(
    store_id: int,
    run_id: int,
    limit: int = 50,
    principal: Principal = Depends(require_roles("owner", "manager", "viewer")),
    db: Session = Depends(get_db),
):
    ok = (
        db.query(models.ScanRun)
        .filter(models.ScanRun.id == run_id, models.ScanRun.store_id == store_id)
        .first()
    )
    if not ok:
        raise HTTPException(status_code=404, detail="Run not found")

    rows = (
        db.query(models.PageSnapshot)
        .filter(
            models.PageSnapshot.store_id == store_id,
            models.PageSnapshot.run_id == run_id,
        )
        .order_by(models.PageSnapshot.fetched_at.desc())
        .limit(limit)
        .all()
    )
    return [schemas.PageSnapshotOut.model_validate(r) for r in rows]
