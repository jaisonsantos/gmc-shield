# api/app/queue.py

import os, json, datetime as dt
import redis

QUEUE_SCAN = "queue:scan"

def get_redis() -> redis.Redis:
    url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    return redis.from_url(url, decode_responses=True)

def publish_scan_job(store_id: int, requested_by: str, limit_items: int = 50, recrawl: bool = False):
    r = get_redis()

    # De-dup por 5s para evitar flood do botão
    dedup_key = f"dedup:scan:{store_id}"
    if r.set(dedup_key, "1", nx=True, ex=5) is None:
        # já tem um job recente — apenas devolve payload “skipped”
        return {
            "type": "scan_store",
            "store_id": store_id,
            "limit_items": limit_items,
            "recrawl": recrawl,
            "requested_by": requested_by,
            "ts": dt.datetime.now(dt.timezone.utc).isoformat() ,
            "skipped": True,
        }

    payload = {
        "type": "scan_store",
        "store_id": store_id,
        "limit_items": limit_items,
        "recrawl": recrawl,
        "requested_by": requested_by,
        "ts": dt.datetime.now(dt.timezone.utc).isoformat(),
        "skipped": False,
    }
    # Fila FIFO: LPUSH + BRPOP do worker
    r.lpush(QUEUE_SCAN, json.dumps(payload))
    r.hincrby("metrics:jobs", "published", 1)
    return payload

