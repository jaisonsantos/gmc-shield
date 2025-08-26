import contextvars
import datetime as dt
import json
import uuid
from collections import Counter, deque
from typing import Any, Dict

trace_id_ctx: contextvars.ContextVar[str] = contextvars.ContextVar(
    "trace_id", default=""
)

_request_durations: deque[float] = deque(maxlen=1000)
_status_counts: Counter = Counter()


def log_event(msg: str, level: str = "info", **extra: Any) -> None:
    log: Dict[str, Any] = {
        "ts": dt.datetime.utcnow().isoformat(),
        "level": level,
        "msg": msg,
        "trace_id": trace_id_ctx.get(),
    }
    log.update(extra)
    print(json.dumps(log))


def record_request(
    status: int,
    duration_ms: float,
    request_id: str | None,
    **extra: Any,
) -> None:
    _status_counts[str(status)] += 1
    _request_durations.append(duration_ms)
    log_event(
        "request",
        status=status,
        duration_ms=round(duration_ms, 2),
        request_id=request_id,
        **extra,
    )


def get_metrics() -> Dict[str, Any]:
    data = list(_request_durations)
    if data:
        data.sort()
        p50 = data[int(0.5 * (len(data) - 1))]
        p95 = data[int(0.95 * (len(data) - 1))]
    else:
        p50 = p95 = 0.0
    return {
        "count": sum(_status_counts.values()),
        "status": dict(_status_counts),
        "latency_ms": {"p50": p50, "p95": p95},
    }


def new_trace_id(header: str | None = None) -> str:
    tid = header or str(uuid.uuid4())
    trace_id_ctx.set(tid)
    return tid
