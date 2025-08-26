# api/app/main.py

import time, os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from .routers import auth, stores, feeds, violations, blocks, policies, appeals, notifications, ops, wp, scans

app          = FastAPI(title="GMC Shield API", version="0.1.0")
raw          = os.getenv("ALLOWED_ORIGINS") or os.getenv("CORS_ORIGINS", "http://localhost:5173")
origins      = [o.strip() for o in raw.split(",") if o.strip()]
origin_regex = os.getenv("ALLOWED_ORIGIN_REGEX")  # ^https://([a-z0-9-]+\.)?vercel\.app$|^https://[a-z0-9-]+\.ngrok-free\.app$

@app.middleware("http")
async def log_requests(request: Request, call_next):
    t0 = time.perf_counter()
    status = 500
    try:
        response = await call_next(request)
        status = getattr(response, "status_code", 200)
        return response
    finally:
        dt = (time.perf_counter() - t0) * 1000
        print(f"[REQ] {request.method} {request.url.path} -> {status} ({dt:.1f}ms)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=origin_regex or None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
app.include_router(ops.router,              prefix="/api/ops",      tags=["ops"])
app.include_router(auth.router,             prefix="/api/auth",     tags=["auth"])
app.include_router(stores.router,           prefix="/api/stores",   tags=["stores"])
app.include_router(feeds.router,            prefix="/api/stores",   tags=["feeds"])
app.include_router(feeds.router_v1,         prefix="/api/v1",       tags=["feeds"])
app.include_router(violations.router,       prefix="/api/stores",   tags=["violations"])
app.include_router(blocks.router,           prefix="/api/stores",   tags=["blocks"])
app.include_router(policies.router,         prefix="/api/stores",   tags=["policies"])
app.include_router(wp.router,               prefix="/api/stores",   tags=["wp"])
app.include_router(appeals.router,          prefix="/api/stores",   tags=["appeals"])
app.include_router(notifications.router,    prefix="/api/stores",   tags=["notifications"])
app.include_router(scans.router,            prefix="/api/stores",   tags=["scans"])
@app.get("/healthz")
def healthz():
    return {"ok": True}

