# api/app/routers/ops.py

from fastapi import APIRouter, Depends
import os, json
from ..auth import require_roles
from ..queue import get_redis, QUEUE_SCAN

router = APIRouter()

@router.get("/worker/health", dependencies=[Depends(require_roles("owner","manager","viewer"))])
def worker_health():
    r = get_redis()
    qlen = r.llen(QUEUE_SCAN)
    keys = [k for k in r.scan_iter(match="worker:heartbeat:*", count=50)]
    workers = []
    for k in keys:
        # cada heartbeat é um hash
        h = r.hgetall(k)
        # h vem como strings; é OK pro front
        workers.append(h or {"host":k.split(":")[-1], "ts":None, "processed":"0", "queue_len":str(qlen)})
    metrics = r.hgetall("metrics:jobs")
    return {"ok": True, "queue_len": qlen, "workers": workers, "metrics": metrics}
