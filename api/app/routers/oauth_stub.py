from fastapi import APIRouter, HTTPException

router = APIRouter()


@router.get("/api/auth/google/start")
async def auth_google_start():
    raise HTTPException(status_code=501, detail="not implemented")


@router.get("/api/auth/google/callback")
async def auth_google_callback():
    raise HTTPException(status_code=501, detail="not implemented")


@router.get("/api/auth/google/start-content")
async def auth_google_start_content():
    raise HTTPException(status_code=501, detail="not implemented")


@router.get("/api/google/mc/accounts")
async def google_mc_accounts():
    raise HTTPException(status_code=501, detail="not implemented")


@router.get("/api/google/mc/{merchant_id}/products")
async def google_mc_products(merchant_id: str):
    raise HTTPException(status_code=501, detail="not implemented")
