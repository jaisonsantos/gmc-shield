from ..db import SessionLocal
from .. import models
from ..routers import feeds
from ..queue import get_rq_queue

queue = get_rq_queue('feed')

def enqueue(store_id: int, feed_id: int, raw: bytes, fmt: str) -> str:
    job = queue.enqueue(process, store_id, feed_id, raw, fmt)
    return job.id

def process(store_id: int, feed_id: int, raw: bytes, fmt: str):
    db = SessionLocal()
    try:
        feed = db.get(models.Feed, feed_id)
        if not feed:
            return {"error": "feed_not_found", "feed_id": feed_id}
        return feeds._ingest_raw(db, store_id, feed, raw, fmt)
    finally:
        db.close()
