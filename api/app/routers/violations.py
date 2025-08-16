from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from ..db import get_db
from .. import models, schemas
from ..auth import require_roles, Principal

router = APIRouter()


@router.get(
    "/{store_id}/violations",
    response_model=schemas.ViolationPage,
)
def list_violations(
    store_id: int,
    page: int = 1,
    per_page: int = 50,
    run_id: int | None = None,
    principal: Principal = Depends(require_roles("owner", "manager", "viewer")),
    db: Session = Depends(get_db),
):
    # valida ownership da store
    ok = (
        db.query(models.Store.id)
        .filter(models.Store.id == store_id, models.Store.account_id == principal["account_id"])
        .first()
    )
    if not ok:
        raise HTTPException(status_code=404, detail="Store not found")

    q = db.query(models.Violation).filter(models.Violation.store_id == store_id)

    if run_id is not None:
        run_ok = (
            db.query(models.ScanRun.id)
            .filter(models.ScanRun.id == run_id, models.ScanRun.store_id == store_id)
            .first()
        )
        if not run_ok:
            raise HTTPException(status_code=404, detail="Run not found")
        q = q.filter(models.Violation.run_id == run_id)

    q = q.order_by(models.Violation.id.asc())
    total = q.count()
    rows = q.offset((page - 1) * per_page).limit(per_page).all()
    items: List[schemas.ViolationOut] = [schemas.ViolationOut.model_validate(r) for r in rows]
    return schemas.ViolationPage(items=items, page=page, total=total)
