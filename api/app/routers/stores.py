# api/app/routers/stores.py

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..db import get_db
from .. import models, schemas
from ..auth import require_roles, Principal
from ..queue import publish_scan_job
from ..models import Store

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

@router.post("/{store_id}/scan", summary="Queue scan", dependencies=[Depends(require_roles("owner","manager"))])
def queue_scan(store_id: int, principal: Principal = Depends(require_roles("owner","manager"))):
    """
    Publica um job de scan na fila (Redis). De-dup curto é feito no publish_scan_job.
    """
    job = publish_scan_job(
        store_id     = store_id,
        requested_by = principal["email"],
        limit_items  = 50,
        recrawl      = False,
    )
    # propaga skipped → job pode vir com "skipped": True se cair no de-dup
    return {
        "queued"        : not job.get("skipped", False),
        "skipped"       : job.get("skipped", False),
        "store_id"      : store_id,
        "limit_items"   : job.get("limit_items", 50),
        "recrawl"       : job.get("recrawl", False),
    }