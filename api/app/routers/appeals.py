from fastapi import APIRouter, Depends
from ..auth import require_roles

router = APIRouter()

@router.post("/{store_id}/appeals", dependencies=[Depends(require_roles("owner","manager"))])
def create_appeal(store_id: int):
    return {"id": 1, "store_id": store_id, "status": "generated", "url": f"/downloads/appeal_{store_id}.zip"}
