# api/app/routers/wp.py

from datetime import datetime, timezone
import os
import hashlib

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Literal

from ..auth import require_roles, Principal
from ..db import get_db
from .. import models, schemas
from ..crypto import encrypt_str, decrypt_str
from ..wp_client import wp_client

from jinja2 import Environment, FileSystemLoader, select_autoescape, TemplateNotFound
import markdown2

TEMPLATE_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "templates")
_env = Environment(loader=FileSystemLoader(TEMPLATE_DIR), autoescape=select_autoescape())

def render_policy_html(policy_type: str, content_md: str) -> str:
    try:
        tmpl = _env.get_template(f"policies/{policy_type}.md.j2")
    except TemplateNotFound:
        raise HTTPException(status_code=400, detail=f"Template não encontrado para '{policy_type}'")
    md = tmpl.render(content_md=content_md)
    return markdown2.markdown(md)

router = APIRouter()


@router.post("/{store_id}/wp/credentials")
def save_credentials(
    store_id: int,
    body: schemas.WpCredsIn,
    principal: Principal = Depends(require_roles("owner", "manager")),
    db: Session = Depends(get_db),
):
    store = db.query(models.Store).filter(models.Store.id==store_id, models.Store.account_id==principal["account_id"]).first()
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    base = str(body.wp_api_base).rstrip("/")
    if not base.endswith("/wp-json"):
        raise HTTPException(status_code=400, detail="wp_api_base deve apontar para /wp-json")
    store.wp_api_base = base
    store.wp_base_url = str(body.wp_base_url) if getattr(body, "wp_base_url", None) else base[: -len("/wp-json")]
    store.wp_user = body.wp_user
    store.wp_app_password_enc = encrypt_str(body.wp_app_password)
    db.add(store)
    db.commit()

    # optional test
    verify = os.getenv("WP_VERIFY_TLS", "true").lower() != "false"
    timeout = float(os.getenv("WP_TIMEOUT_SEC", "10"))
    try:
        with wp_client(store.wp_api_base, store.wp_user, body.wp_app_password, verify=verify, timeout=timeout) as c:
            r = c.get("wp/v2/users/me")
            r.raise_for_status()
            store.wp_last_status_at = datetime.now(timezone.utc)
            db.add(store)
            db.commit()
    except Exception as e:
        # em dev, ajuda muito retornar erro claro
        if os.getenv("ENV", "dev") != "prod":
            detail = getattr(getattr(e, "response", None), "text", str(e))
            raise HTTPException(status_code=400, detail=f"Falha ao validar WP creds: {detail}")
        # em prod, só não marca como conectado e segue

    return {"ok": True}


@router.get("/{store_id}/wp/status", response_model=schemas.WpStatusOut)
def wp_status(
    store_id: int,
    principal: Principal = Depends(require_roles("owner", "manager", "viewer")),
    db: Session = Depends(get_db),
):
    store = db.query(models.Store).filter(models.Store.id==store_id, models.Store.account_id==principal["account_id"]).first()
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    bindings = db.query(models.WpPolicyBinding).filter(models.WpPolicyBinding.store_id==store.id).all()
    policies = {
        b.policy_type: {
            "page_id": b.page_id,
            "page_url": b.page_url,
            "published_at": b.published_at,
            "version": b.version,
        }
        for b in bindings
    }
    return schemas.WpStatusOut(
        connected=bool(store.wp_last_status_at),
        site=store.wp_base_url,
        wp_api_base=store.wp_api_base,
        wp_user=store.wp_user,
        last_status_at=store.wp_last_status_at,
        last_block_sync_at=store.wp_last_block_sync_at,
        last_block_synced=store.wp_last_block_synced,
        policies=policies,
    )


@router.post("/{store_id}/wp/policies/render")
def render_policy(
    store_id: int,
    body: schemas.PolicyRenderIn,
    principal: Principal = Depends(require_roles("owner", "manager")),
    db: Session = Depends(get_db),
):
    ok = (
        db.query(models.Store.id)
        .filter(
            models.Store.id == store_id,
            models.Store.account_id == principal["account_id"],
        )
        .first()
    )
    if not ok:
        raise HTTPException(status_code=404, detail="Store not found")
    html = render_policy_html(body.type, body.content_md)
    return {"html": html}


@router.post("/{store_id}/wp/policies/publish", response_model=schemas.PolicyPublishOut)
def publish_policy(
    store_id: int,
    body: schemas.PolicyPublishIn,
    principal: Principal = Depends(require_roles("owner", "manager")),
    db: Session = Depends(get_db),
):
    store = db.query(models.Store).filter(models.Store.id==store_id, models.Store.account_id==principal["account_id"]).first()
    if not store or not store.wp_api_base or not store.wp_user or not store.wp_app_password_enc:
        raise HTTPException(status_code=400, detail="WP credentials not set")

    try:
        app_pass = decrypt_str(store.wp_app_password_enc)
    except ValueError:
        raise HTTPException(status_code=400, detail="Credencial inválida ou rotacionada")
    html = render_policy_html(body.type, body.content_md)
    title_map = {
        "refund": "Política de Devolução",
        "shipping": "Política de Envio",
        "privacy": "Política de Privacidade",
    }
    verify = os.getenv("WP_VERIFY_TLS", "true").lower() != "false"
    timeout = float(os.getenv("WP_TIMEOUT_SEC", "10"))
    try:
        with wp_client(store.wp_api_base, store.wp_user, app_pass, verify=verify, timeout=timeout) as c:
            binding = db.query(models.WpPolicyBinding).filter(models.WpPolicyBinding.store_id==store.id, models.WpPolicyBinding.policy_type==body.type).first()
            payload = {"title": title_map[body.type], "content": html, "status": body.status}
            if binding:
                r = c.put(f"wp/v2/pages/{binding.page_id}", json=payload)
            else:
                r = c.post("wp/v2/pages", json=payload)
            r.raise_for_status()
            data = r.json()
            page_id = data.get("id")
            page_url = data.get("link")
    except HTTPException:
        raise
    except Exception as e:
        if getattr(e, "response", None) and e.response.status_code in (401, 403):
            raise HTTPException(status_code=400, detail="Verifique Application Password")
        raise
    h = hashlib.sha1(body.content_md.encode()).hexdigest()
    now = datetime.now(timezone.utc)
    if binding:
        changed = binding.content_hash != h
        binding.page_id = page_id
        binding.page_url = page_url
        binding.published_at = now
        if changed:
            binding.version += 1
            binding.content_hash = h
    else:
        binding = models.WpPolicyBinding(
            store_id=store.id,
            policy_type=body.type,
            page_id=page_id,
            page_url=page_url,
            version=1,
            published_at=now,
            content_hash=h,
        )
        db.add(binding)
    db.commit()
    return schemas.PolicyPublishOut(
        type=body.type,
        page_id=page_id,
        page_url=page_url,
        published_at=binding.published_at,
        version=binding.version,
    )


@router.post("/{store_id}/wp/blocks/sync", response_model=schemas.BlockSyncOut)
def sync_blocks(
    store_id: int,
    mode: Literal["pull", "push"] = "pull",
    principal: Principal = Depends(require_roles("owner", "manager")),
    db: Session = Depends(get_db),
):
    store = db.query(models.Store).filter(models.Store.id==store_id, models.Store.account_id==principal["account_id"]).first()
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    total = (
        db.query(models.Block)
        .filter(models.Block.store_id == store.id, models.Block.active.is_(True))
        .count()
    )
    now = datetime.now(timezone.utc)
    store.wp_last_block_sync_at = now
    store.wp_last_block_synced = total
    db.add(store)
    db.commit()
    return schemas.BlockSyncOut(total=total, synced=total, mode=mode)
