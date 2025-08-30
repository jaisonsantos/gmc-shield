import os
import json
import time
import csv
import itertools
import datetime as dt
import socket
import signal
import redis
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.observability import log_event, trace_id_ctx

import sys
sys.path.append("/app")
from app import models  # noqa: E402

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")
DATABASE_URL = os.getenv(
    "DATABASE_URL", "postgresql+psycopg2://postgres:postgres@db:5432/postgres"
)
QUEUE_SCAN = "queue:scan"

r = redis.from_url(REDIS_URL, decode_responses=True)
engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine)

HOST = socket.gethostname()
HB_KEY = f"worker:heartbeat:{HOST}"
_running = True


def _stop(*_):
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
    r.expire(HB_KEY, 30)
    return payload

# Resolve demo feed CSV path from a few candidates
CSV_CANDIDATES = [
    os.getenv("DEMO_FEED_CSV"),
    "/app/docs/seed/demo_feed.csv",
    os.path.join(os.getcwd(), "docs", "seed", "demo_feed.csv"),
    os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "docs", "seed", "demo_feed.csv")),
]
FEED_CSV = next((p for p in CSV_CANDIDATES if p and os.path.exists(p)), None)


def fetch_feed_items_csv(limit: int):
    if not FEED_CSV:
        return []
    out = []
    with open(FEED_CSV) as f:
        reader = csv.DictReader(f)
        for row in itertools.islice(reader, limit):
            out.append(row)
    return out


def fetch_feed_items_db(sess, store_id: int, limit: int):
    """Yield minimal item dicts from DB for the store."""
    rows = (
        sess.query(models.FeedItem)
        .filter(models.FeedItem.store_id == store_id)
        .order_by(models.FeedItem.item_id)
        .limit(limit)
        .all()
    )
    out = []
    for r in rows:
        # Convert cents to float price to keep old heuristic logic
        def _from_cents(v):
            try:
                return (v or 0) / 100.0
            except Exception:
                return 0.0
        out.append(
            {
                "id": r.item_id,
                "title": r.title or r.item_id,
                "link": r.link_canonical or "",
                "price": f"{_from_cents(r.price_cents)} {r.currency or ''}".strip(),
                "availability": r.availability or "",
            }
        )
    return out


def process_job(job: dict):
    if job.get("type") != "scan_store":
        return
    store_id = int(job["store_id"])
    run_id = int(job["run_id"])
    limit = int(job.get("limit_items", 5))

    log_event("job start", job_id=run_id, store_id=store_id, user_id=None, request_id=None)
    sess = SessionLocal()
    run = sess.query(models.ScanRun).filter(models.ScanRun.id == run_id).first()
    if not run:
        sess.close()
        return

    run.status = "running"
    run.started_at = dt.datetime.utcnow()
    sess.commit()

    items_total = items_ok = items_violation = 0

    try:
        items_list = fetch_feed_items_db(sess, store_id, limit)
        if not items_list:
            # fallback to demo CSV for first-run experience
            items_list = fetch_feed_items_csv(limit)
        for idx, item in enumerate(items_list, start=1):
            items_total += 1
            # Be robust with missing/invalid price/currency
            tokens = (item.get("price") or "").split()
            try:
                feed_price = float(tokens[0]) if tokens else 0.0
            except Exception:
                feed_price = 0.0
            feed_currency = tokens[1] if len(tokens) > 1 else (item.get("currency") or "")
            feed_avail = item.get("availability", "")

            page_price = (feed_price or 0.0) * (1.3 if idx % 2 == 0 else 1.0)
            if feed_currency:
                page_currency = feed_currency if idx % 2 == 0 else "USD"
            else:
                page_currency = ""
            availability = feed_avail if idx % 3 != 0 else "out of stock"

            html = f"<html><body><h1>{item['title']}</h1><span class='price'>{page_price}</span></body></html>"
            html_dir = os.path.join("artifacts", f"store{store_id}", f"run{run_id}")
            os.makedirs(html_dir, exist_ok=True)
            html_path = os.path.join(html_dir, f"{item['id']}.html")
            with open(html_path, "w") as fh:
                fh.write(html)

            snapshot = models.PageSnapshot(
                store_id=store_id,
                run_id=run_id,
                feed_item_id=item['id'],
                url=item['link'],
                fetched_at=dt.datetime.utcnow(),
                http_status=200,
                html_path=html_path,
                screenshot_path="",
                extracted={
                    "price": page_price,
                    "currency": page_currency,
                    "availability": availability,
                    "h1": item['title'],
                },
            )
            sess.add(snapshot)

            violations = []
            if feed_price > 0 and abs(page_price - feed_price) / feed_price > 0.2:
                violations.append(
                    models.Violation(
                        store_id=store_id,
                        run_id=run_id,
                        feed_item_id=item['id'],
                        rule_code='R1',
                        severity='critical',
                        message='Preço divergente',
                    )
                )
            if page_currency != feed_currency:
                violations.append(
                    models.Violation(
                        store_id=store_id,
                        run_id=run_id,
                        feed_item_id=item['id'],
                        rule_code='R2',
                        severity='critical',
                        message='Moeda divergente',
                    )
                )
            if availability.lower() != feed_avail.lower():
                violations.append(
                    models.Violation(
                        store_id=store_id,
                        run_id=run_id,
                        feed_item_id=item['id'],
                        rule_code='R3',
                        severity='warning',
                        message='Disponibilidade divergente',
                    )
                )
            if idx % 5 == 0:
                violations.append(
                    models.Violation(
                        store_id=store_id,
                        run_id=run_id,
                        feed_item_id=item['id'],
                        rule_code='R4',
                        severity='warning',
                        message='Redirect suspeito',
                    )
                )
            if violations:
                items_violation += 1
                for v in violations:
                    sess.add(v)
            else:
                items_ok += 1
            sess.commit()

        run.items_total = items_total
        run.items_ok = items_ok
        run.items_violation = items_violation
        run.status = "done"
        run.finished_at = dt.datetime.utcnow()
        sess.commit()
    except Exception as e:
        sess.rollback()
        run.status = "error"
        run.error_text = str(e)[:1000]
        run.finished_at = dt.datetime.utcnow()
        sess.commit()
        sess.close()
        raise
    else:
        sess.close()
    log_event("job processed", job_id=run_id, store_id=store_id, user_id=None, request_id=None)


def main():
    log_event("worker started", job_id=None, store_id=None, user_id=None, request_id=None)
    processed = 0
    last_hb = 0.0
    while _running:
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
            log_event("invalid payload", level="error", error=str(e), job_id=None, store_id=None, user_id=None, request_id=None)
            continue
        try:
            trace_id_ctx.set(job.get("trace_id", ""))
            process_job(job)
            processed += 1
            r.hincrby("metrics:jobs", "processed", 1)
        except Exception as e:
            r.hincrby("metrics:jobs", "failed", 1)
            log_event("job error", level="error", error=str(e), job_id=job.get("run_id"), store_id=job.get("store_id"), user_id=None, request_id=None)
    r.delete(HB_KEY)
    log_event("worker stopped", job_id=None, store_id=None, user_id=None, request_id=None)


if __name__ == "__main__":
    main()
