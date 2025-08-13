# /worker/run_worker.py
import os, sys, time, json, socket, random, signal
import datetime as dt
import redis
from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine

# garante que 'from app import models' funcione dentro do container
sys.path.append("/app")

from app import models  # noqa: E402
from app.db import Base  # noqa: E402

REDIS_URL    = os.getenv("REDIS_URL", "redis://redis:6379/0")
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+psycopg2://postgres:postgres@db:5432/postgres")
QUEUE_SCAN   = "queue:scan"

# --- infra
r = redis.from_url(REDIS_URL, decode_responses=True)
engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine)

HOST   = socket.gethostname()
HB_KEY = f"worker:heartbeat:{HOST}"
_running = True


def _stop(*_):
    """Graceful shutdown on SIGTERM/SIGINT."""
    global _running
    _running = False


signal.signal(signal.SIGTERM, _stop)
signal.signal(signal.SIGINT, _stop)


def heartbeat(processed: int = 0):
    payload = {
        "host": HOST,
        "ts": dt.datetime.utcnow().isoformat(),
        "processed": processed,
        "queue_len": r.llen(QUEUE_SCAN),
    }
    r.hset(HB_KEY, mapping=payload)
    r.expire(HB_KEY, 30)  # expira caso o worker morra
    return payload


def seed_violations(sess, store_id: int, limit_items: int = 3):
    """Gera algumas violações de exemplo. Para demo, limpa as anteriores da store."""
    # delete eficiente (não sincroniza sessão)
    sess.query(models.Violation)\
        .filter(models.Violation.store_id == store_id)\
        .delete(synchronize_session=False)
    sess.commit()

    samples = [
        {"rule_code": "R1", "severity": "critical", "message": "Preço divergente 20%", "feed_item_id": "SKU-123", "status": "open"},
        {"rule_code": "R5", "severity": "critical", "message": "Política de devolução ausente", "feed_item_id": None, "status": "open"},
        {"rule_code": "R7", "severity": "warning",  "message": "JSON-LD preço inconsistente", "feed_item_id": "SKU-456", "status": "open"},
    ]
    random.shuffle(samples)
    take = samples[: max(1, min(limit_items, len(samples)))]

    for v in take:
        sess.add(models.Violation(
            store_id=store_id,
            feed_item_id=v["feed_item_id"],
            rule_code=v["rule_code"],
            severity=v["severity"],
            message=v["message"],
            status=v["status"],
        ))
    sess.commit()


def process_job(job: dict):
    if job.get("type") != "scan_store":
        return
    store_id = int(job["store_id"])
    limit    = int(job.get("limit_items", 50))

    # simula trabalho
    time.sleep(1.0)

    sess = SessionLocal()
    try:
        seed_violations(sess, store_id, limit_items=min(limit, 3))
        print(f"[worker] processed job scan_store store={store_id} limit={limit}")
    finally:
        sess.close()


def main():
    print(f"[worker] started on {HOST} — Redis={REDIS_URL} DB={DATABASE_URL}")
    processed = 0
    last_hb = 0.0

    while _running:
        # heartbeat a cada ~5s mesmo ocioso
        now = time.time()
        if now - last_hb > 5:
            heartbeat(processed)
            last_hb = now

        item = r.brpop(QUEUE_SCAN, timeout=2)
        if not item:
            continue

        _, payload = item
        try:
            job = json.loads(payload)
        except Exception as e:
            print("[worker] invalid payload:", e, payload)
            continue

        try:
            process_job(job)
            processed += 1
            r.hincrby("metrics:jobs", "processed", 1)
        except Exception as e:
            r.hincrby("metrics:jobs", "failed", 1)
            print("[worker] error:", e)

    # encerrando
    r.delete(HB_KEY)
    print("[worker] stopped")


if __name__ == "__main__":
    main()
