# api/app/routers/stores.py

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
from .. import models, schemas
from ..auth import require_roles, Principal
from ..queue import publish_scan_job, get_redis
from ..models import Store, ScanRun

router = APIRouter()

@router.post("", summary="Create store")
def create_store(
    store: schemas.StoreCreate,
    principal: Principal = Depends(require_roles("owner", "manager")),
    db: Session = Depends(get_db),
):
    """
    Cria uma loja para o account do usuário autenticado.
    """
    s = models.Store(
        account_id      = principal["account_id"],
        platform        = store.platform,
        base_url        = store.base_url,
        country         = store.country,
        currency        = store.currency,
        contact_email   = store.contact_email,
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    return {"id": s.id}

@router.get("/{store_id}/overview", summary="Store overview", dependencies=[Depends(require_roles("owner","manager","viewer"))])
def store_overview(store_id: int, db: Session = Depends(get_db)):
    """
    Pequeno resumo da loja para cards/visão geral.
    """
    q           = db.query(models.Violation).filter(models.Violation.store_id == store_id)
    total       = q.count()
    critical    = q.filter(models.Violation.severity == "critical").count()
    warning     = q.filter(models.Violation.severity == "warning").count()
    info        = q.filter(models.Violation.severity == "info").count()

    items_blocked = (
        db.query(models.Block)
        .filter(
            models.Block.store_id == store_id, 
            models.Block.active.is_(True)
        )
        .count()
    )
    policies = {"ok": 2, "missing": 1}
    risk     = min(100, critical * 15 + warning * 5 + info * 2 + items_blocked)

    return {
        "store_id"        : store_id,
        "violations"      : {"critical": critical, "warning": warning, "info": info},
        "items_blocked"   : items_blocked,
        "policies"        : policies,
        "suspension_state": "unknown",
        "risk_score"      : risk if total else 0,
    }

@router.get("")
@router.get("/")
def list_stores(
    principal: Principal = Depends(require_roles("owner", "manager", "viewer")),
    db: Session = Depends(get_db),
):
    """
    Lista lojas do account do usuário atual.
    """
    rows = (
        db.query(Store)
        .filter(Store.account_id == principal["account_id"])
        .order_by(Store.id.desc())
        .all()
    )
    return [
        {
            "id": s.id,
            "platform": s.platform,
            "base_url": s.base_url,
            "country": s.country,
            "currency": s.currency,
            "contact_email": s.contact_email,
        }
        for s in rows
    ]

@router.post("/{store_id}/scan", summary="Queue scan")
def queue_scan(
    store_id: int,
    req: schemas.ScanRequest = schemas.ScanRequest(),
    principal: Principal = Depends(require_roles("owner", "manager")),
    db: Session = Depends(get_db),
):
    """Cria um run de scan e publica job na fila."""

    # valida ownership da store
    store = (
        db.query(Store)
        .filter(Store.id == store_id, Store.account_id == principal["account_id"])
        .first()
    )
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")

    # de-dup antes de criar run
    r = get_redis()
    if r.set(f"dedup:scan:{store_id}", "1", nx=True, ex=5) is None:
        return {"queued": False, "skipped": True}

    run = ScanRun(
        store_id=store_id,
        requested_by=principal["email"],
        status="queued",
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    publish_scan_job(store_id=store_id, run_id=run.id, limit_items=req.limit_items)

    return {"queued": True, "run_id": run.id}


@router.get(
    "/{store_id}/scan/runs",
    summary="List scan runs",
    response_model=list[schemas.ScanRunOut],
)
def list_runs(
    store_id: int,
    limit: int = 20,
    principal: Principal = Depends(require_roles("owner", "manager", "viewer")),
    db: Session = Depends(get_db),
):
    # valida ownership
    ok = (
        db.query(Store.id)
        .filter(Store.id == store_id, Store.account_id == principal["account_id"])
        .first()
    )
    if not ok:
        raise HTTPException(status_code=404, detail="Store not found")

    rows = (
        db.query(ScanRun)
        .filter(ScanRun.store_id == store_id)
        .order_by(ScanRun.id.desc())
        .limit(limit)
        .all()
    )
    return [schemas.ScanRunOut.model_validate(r) for r in rows]
