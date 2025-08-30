# api/app/queue.py

import os
import json
import datetime as dt
import redis
from redis import Redis
from rq import Queue
from .observability import trace_id_ctx, log_event

QUEUE_SCAN = "queue:scan"


def get_redis() -> redis.Redis:
    url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    return redis.from_url(url, decode_responses=True)


def publish_scan_job(
    store_id: int,
    run_id: int,
    limit_items: int = 50,
    requested_by: str | None = None,
    recrawl: bool = False,
):
    r = get_redis()
    payload = {
        "type": "scan_store",
        "store_id": store_id,
        "run_id": run_id,
        "limit_items": limit_items,
        "recrawl": recrawl,
        "requested_by": requested_by,
        "ts": dt.datetime.now(dt.timezone.utc).isoformat(),
        "skipped": False,
        "trace_id": trace_id_ctx.get(),
    }
    # Fila FIFO: LPUSH + BRPOP do worker
    r.lpush(QUEUE_SCAN, json.dumps(payload))
    r.hincrby("metrics:jobs", "published", 1)
    try:
        qlen = r.llen(QUEUE_SCAN)
    except Exception:
        qlen = None
    # log observabilidade para facilitar troubleshooting
    log_event("scan.job.published", job_id=run_id, store_id=store_id, user_id=None, request_id=None, queue_len=qlen)
    return payload


def get_rq_queue(name: str) -> Queue:
    """Return an RQ queue with shared Redis connection."""
    conn: Redis = Redis.from_url(os.getenv("REDIS_URL", "redis://redis:6379/0"))
    return Queue(name, connection=conn)
