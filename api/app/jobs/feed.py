import os
from redis import Redis
from rq import Queue
from ..db import SessionLocal
from .. import models
from ..routers import feeds

redis = Redis.from_url(os.getenv('REDIS_URL', 'redis://redis:6379/0'))
queue = Queue('feed', connection=redis)

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
