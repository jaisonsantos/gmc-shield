from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from ..db import get_db
from .. import models, schemas
from ..auth import require_roles

router = APIRouter()

@router.get("/{store_id}/violations", response_model=dict, dependencies=[Depends(require_roles("owner","manager","viewer"))])
def list_violations(store_id: int, page: int = 1, per_page: int = 50, db: Session = Depends(get_db)):
    q = db.query(models.Violation).filter(models.Violation.store_id == store_id).order_by(models.Violation.id.asc())
    total = q.count()
    rows = q.offset((page - 1) * per_page).limit(per_page).all()
    items: List[schemas.ViolationOut] = [schemas.ViolationOut.model_validate(r) for r in rows]
    return {"items": items, "page": page, "total": total}
