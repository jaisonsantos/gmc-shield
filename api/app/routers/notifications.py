from fastapi import APIRouter, Depends
from ..auth import require_roles

router = APIRouter()

@router.get("/{store_id}/notifications", dependencies=[Depends(require_roles("owner","manager","viewer"))])
def list_notifications(store_id: int):
    return {"items": [{"id": 1, "type": "violation.created", "channel": "email", "created_at": "2025-08-10"}]}
