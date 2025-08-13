# api/app/routers/blocks.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from datetime import datetime
from .. import models, schemas
from ..db import get_db
from ..auth import require_roles, Principal
from ..models import Store, Block

router = APIRouter()

@router.post("/{store_id}/blocks", dependencies=[Depends(require_roles("owner","manager"))])
def create_block(store_id: int, body: schemas.BlockCreate, db: Session = Depends(get_db)):
    existing = (
        db.query(models.Block)
        .filter(
            models.Block.store_id==store_id,
            models.Block.feed_item_id==body.feed_item_id,
            models.Block.active.is_(True)
        ).first())
    if existing:
        return {
            "id"          : existing.id, 
            "store_id"    : store_id,
            "feed_item_id": existing.feed_item_id, 
            "active"      : True
        }
    blk = models.Block(
        store_id     = store_id, 
        feed_item_id = body.feed_item_id,
        reason       = body.reason, 
        active       = True
    )
    db.add(blk)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        # alguém criou em paralelo — busca e retorna
        again = (
            db.query(models.Block)
            .filter(
                models.Block.store_id==store_id,
                models.Block.feed_item_id==body.feed_item_id,
                models.Block.active.is_(True)
            ).first())
        if again:
            return {
                "id"          : again.id, 
                "store_id"    : store_id,
                "feed_item_id": again.feed_item_id, 
                "active"      : True
            }
        raise
    db.refresh(blk)
    return {"id": blk.id, "store_id": store_id, "feed_item_id": blk.feed_item_id, "active": blk.active}

@router.get("/{store_id}/blocks", dependencies=[Depends(require_roles("owner","manager","viewer"))])
def list_blocks(store_id: int, db: Session = Depends(get_db)):
    rows = db.query(models.Block).filter(models.Block.store_id == store_id).order_by(models.Block.id.asc()).all()
    return {"items": [{"id": r.id, "feed_item_id": r.feed_item_id, "active": r.active, "reason": r.reason} for r in rows]}

@router.delete("/{store_id}/blocks/{block_id}", status_code=204, dependencies=[Depends(require_roles("owner","manager"))])
def deactivate_block(
    store_id: int, 
    block_id: int,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_roles("owner","manager"))
):
    store = db.query(Store).filter(
        Store.id         == store_id,
        Store.account_id == principal["account_id"]
    ).first()
    if not store:
        raise HTTPException(404, "Store not found")

    block = db.query(Block).filter(
        Block.id       == block_id,
        Block.store_id == store.id,
        Block.active.is_(True)
    ).first()
    if not block:
        raise HTTPException(404, "Block not found or already inactive")

    block.active = False
    if hasattr(block, "deactivated_at"):
        block.deactivated_at = datetime.utcnow()
    db.add(block)
    db.commit()
    return  # 204

@router.delete("/{store_id}/blocks/by-feed-item/{feed_item_id}", status_code=204, dependencies=[Depends(require_roles("owner","manager"))])
def deactivate_by_feed_item(
    store_id: int, 
    feed_item_id: str, 
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_roles("owner","manager"))
):
    store = db.query(Store).filter(Store.id==store_id, Store.account_id==principal["account_id"]).first()
    if not store:
        raise HTTPException(404, "Store not found")
    (db.query(Block)
     .filter(
        Block.store_id==store.id,
        Block.feed_item_id==feed_item_id,
        Block.active.is_(True)
    )
    .update({"active": False}, synchronize_session=False))
    db.commit()
    return
