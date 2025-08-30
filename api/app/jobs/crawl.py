import asyncio
from sqlalchemy import func

from ..db import SessionLocal
from .. import models
from ..services import crawler, artifacts
from ..queue import get_rq_queue

queue = get_rq_queue("crawl")


def enqueue(store_id: int, run_id: int, feed_item_id: str, url: str) -> str:
    """
    Enqueue crawl task in RQ. In CI/tests (no Redis), degrade gracefully and
    return a dummy job id without raising, so API remains available.
    """
    try:
        job = queue.enqueue(process, store_id, run_id, feed_item_id, url)
        return job.id
    except Exception as e:  # pragma: no cover - network-dependent path
        # Avoid test/CI failures when Redis is not present.
        try:
            from ..observability import log_event
            log_event("rq.enqueue.error", level="error", error=str(e), job_id=run_id, store_id=store_id)
        except Exception:
            pass
        return "noop"


def process(store_id: int, run_id: int, feed_item_id: str, url: str):
    db = SessionLocal()
    try:
        run = db.get(models.ScanRun, run_id)
        if not run:
            return {"error": "run_not_found", "run_id": run_id}

        for ua_label, ua_str in [
            ("googlebot", crawler.UA_GOOGLEBOT),
            ("chrome", crawler.UA_CHROME),
        ]:
            res = asyncio.run(crawler.crawl_once(url, ua_str))
            html_rel, png_rel = artifacts.snapshot_paths(
                store_id, run_id, feed_item_id, ua_label
            )
            html_abs = artifacts.ARTIFACTS_ROOT / html_rel
            png_abs = artifacts.ARTIFACTS_ROOT / png_rel
            html_path = None
            png_path = None
            if res.get("html"):
                html_abs.write_text(res["html"], encoding="utf-8")
                html_path = str(html_rel)
            if res.get("screenshot_bytes"):
                png_abs.write_bytes(res["screenshot_bytes"])
                png_path = str(png_rel)
            snap = models.PageSnapshot(
                store_id=store_id,
                run_id=run_id,
                feed_item_id=feed_item_id,
                url=res.get("final_url"),
                fetched_at=func.now(),
                http_status=res.get("status"),
                redirect_chain=res.get("redirect_chain"),
                html_path=html_path,
                screenshot_path=png_path,
                extracted=res.get("extracted"),
            )
            db.add(snap)
        db.commit()
    finally:
        db.close()
    return {"ok": True}
