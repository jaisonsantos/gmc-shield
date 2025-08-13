from fastapi import APIRouter, Depends
from ..auth import require_roles

router = APIRouter()

@router.get("/{store_id}/policies", dependencies=[Depends(require_roles("owner","manager","viewer"))])
def list_policies(store_id: int):
    return {"items": [
        {"type": "shipping", "status": "ok"},
        {"type": "returns", "status": "missing"},
        {"type": "contact", "status": "ok"},
    ]}
