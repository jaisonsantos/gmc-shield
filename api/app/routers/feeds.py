from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..db import get_db
from .. import models, schemas
from ..auth import require_roles

router = APIRouter()

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

@router.get("/{store_id}/feed/versions", summary="Feed versions (demo)", dependencies=[Depends(require_roles("owner","manager","viewer"))])
def feed_versions(store_id: int):
    return {"items": [{"hash": "abc123", "changed": 12, "created_at": "2025-08-01"}]}
