from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Text, Index, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from .db import Base

class Account(Base):
    __tablename__       = "accounts"
    id                  = Column(Integer, primary_key=True)
    name                = Column(String(255), nullable=False)
    type                = Column(String(32), nullable=False)
    stripe_customer_id  = Column(String(255))
    created_at          = Column(DateTime, server_default=func.now(), nullable=False)

class User(Base):
    __tablename__   = "users"
    id              = Column(Integer, primary_key=True)
    account_id      = Column(Integer, ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False)
    email           = Column(String(255), unique=True, nullable=False)
    password_hash   = Column(String(255), nullable=False)
    role            = Column(String(32), nullable=False)
    created_at      = Column(DateTime, server_default=func.now(), nullable=False)

class Store(Base):
    __tablename__   = "stores"
    id              = Column(Integer, primary_key=True)
    account_id      = Column(Integer, ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False)
    platform        = Column(String(32), nullable=False)
    base_url        = Column(String(255), nullable=False)
    country         = Column(String(32))
    currency        = Column(String(16))
    contact_email   = Column(String(255))
    whitelist_ip    = Column(String(255))
    created_at      = Column(DateTime, server_default=func.now(), nullable=False)

    # WordPress integration
    wp_api_base           = Column(String(255))
    wp_base_url           = Column(String(255))
    wp_user               = Column(String(255))
    wp_app_password_enc   = Column(Text)
    wp_last_status_at     = Column(DateTime(timezone=True))
    wp_last_block_sync_at = Column(DateTime(timezone=True))
    wp_last_block_synced  = Column(Integer)

    __table_args__ = (
        Index("idx_stores_wp_api_base", "wp_api_base"),
    )

class Feed(Base):
    __tablename__   = "feeds"
    id              = Column(Integer, primary_key=True)
    store_id        = Column(Integer, ForeignKey("stores.id", ondelete="CASCADE"), nullable=False)
    source_type     = Column(String(16), nullable=False)
    url             = Column(String(512))
    format          = Column(String(8), nullable=False)
    last_hash       = Column(String(128))
    last_parsed_at  = Column(DateTime)
    last_item_count = Column(Integer)
    created_at      = Column(DateTime, server_default=func.now(), nullable=False)

class FeedVersion(Base):
    __tablename__ = "feed_versions"
    id = Column(Integer, primary_key=True)
    feed_id = Column(Integer, ForeignKey("feeds.id", ondelete="CASCADE"), nullable=False)
    content_hash = Column(String(128), nullable=False)
    items_count = Column(Integer, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    __table_args__ = (
        Index("idx_feed_versions_feed_created", "feed_id", "created_at"),
    )

class FeedItem(Base):
    __tablename__ = "feed_items"
    id = Column(Integer, primary_key=True)
    store_id = Column(Integer, ForeignKey("stores.id", ondelete="CASCADE"), nullable=False)
    feed_id = Column(Integer, ForeignKey("feeds.id", ondelete="CASCADE"), nullable=False)
    item_id = Column(String(128), nullable=False)
    title = Column(String(512))
    link_canonical = Column(Text)
    price_cents = Column(Integer)
    sale_price_cents = Column(Integer)
    currency = Column(String(8))
    availability = Column(String(32))
    brand = Column(String(128))
    gtin = Column(String(64))
    mpn = Column(String(128))
    shipping_json = Column(Text)
    raw_json = Column(Text)
    updated_at = Column(DateTime, server_default=func.now(), nullable=False)
    __table_args__ = (
        UniqueConstraint("store_id", "item_id", name="uq_feed_items_store_item"),
        Index("ix_feed_items_store_id", "store_id"),
        Index("ix_feed_items_feed_id", "feed_id"),
    )

class Violation(Base):
    __tablename__   = "violations"
    id              = Column(Integer, primary_key=True)
    store_id        = Column(Integer, ForeignKey("stores.id", ondelete="CASCADE"), nullable=False)
    feed_item_id    = Column(String(128))
    run_id          = Column(Integer, ForeignKey("scan_runs.id", ondelete="SET NULL"))
    rule_code       = Column(String(16), nullable=False)
    severity        = Column(String(16), nullable=False)
    message         = Column(Text, nullable=False)
    status          = Column(String(16), default="open", nullable=False)
    created_at      = Column(DateTime, server_default=func.now(), nullable=False)
    fixed_at        = Column(DateTime)
    __table_args__ = (
        Index("ix_violations_store_run", "store_id", "run_id"),
    )

class ScanRun(Base):
    __tablename__ = "scan_runs"
    id              = Column(Integer, primary_key=True)
    store_id        = Column(Integer, ForeignKey("stores.id", ondelete="CASCADE"), nullable=False)
    requested_by    = Column(String(255))
    started_at      = Column(DateTime(timezone=True))
    finished_at     = Column(DateTime(timezone=True))
    status          = Column(String(16), default="queued", nullable=False)
    items_total     = Column(Integer, default=0, nullable=False)
    items_ok        = Column(Integer, default=0, nullable=False)
    items_violation = Column(Integer, default=0, nullable=False)
    error_text      = Column(Text)
    __table_args__ = (
        Index("ix_scan_runs_store_started", "store_id", "started_at"),
        Index("ix_scan_runs_status", "status"),
    )

class PageSnapshot(Base):
    __tablename__ = "page_snapshots"
    id              = Column(Integer, primary_key=True)
    store_id        = Column(Integer, ForeignKey("stores.id", ondelete="CASCADE"), nullable=False)
    run_id          = Column(Integer, ForeignKey("scan_runs.id", ondelete="CASCADE"), nullable=False)
    feed_item_id    = Column(String(128))
    url             = Column(Text)
    fetched_at      = Column(DateTime(timezone=True))
    http_status     = Column(Integer)
    redirect_chain  = Column(JSONB)
    html_path       = Column(String(512))
    screenshot_path = Column(String(512))
    extracted       = Column(JSONB)
    __table_args__ = (
        Index("ix_page_snapshots_store_run", "store_id", "run_id"),
        Index("ix_page_snapshots_feed_item", "feed_item_id"),
    )

class Block(Base):
    __tablename__   = "blocks"
    id              = Column(Integer, primary_key=True)
    store_id        = Column(Integer, ForeignKey("stores.id", ondelete="CASCADE"), nullable=False)
    feed_item_id    = Column(String(128), nullable=False)
    reason          = Column(String(255))
    active          = Column(Boolean, default=True, nullable=False)
    created_at      = Column(DateTime, server_default=func.now(), nullable=False)
    deactivated_at  = Column(DateTime)


class WpPolicyBinding(Base):
    __tablename__ = "wp_policy_bindings"
    id            = Column(Integer, primary_key=True)
    store_id      = Column(Integer, ForeignKey("stores.id", ondelete="CASCADE"), nullable=False)
    policy_type   = Column(String(32), nullable=False)
    page_id       = Column(Integer, nullable=False)
    page_url      = Column(String(512), nullable=False)
    version       = Column(Integer, default=1, nullable=False)
    published_at  = Column(DateTime(timezone=True))
    content_hash  = Column(String(64))
    __table_args__ = (
        UniqueConstraint("store_id", "policy_type"),
        Index("ix_wp_policy_bindings_store", "store_id"),
    )
