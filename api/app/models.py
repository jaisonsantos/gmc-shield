from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Text
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

class Feed(Base):
    __tablename__   = "feeds"
    id              = Column(Integer, primary_key=True)
    store_id        = Column(Integer, ForeignKey("stores.id", ondelete="CASCADE"), nullable=False)
    source_type     = Column(String(16), nullable=False)
    url             = Column(String(512))
    format          = Column(String(8), nullable=False)
    last_hash       = Column(String(128))
    last_parsed_at  = Column(DateTime)

class Violation(Base):
    __tablename__   = "violations"
    id              = Column(Integer, primary_key=True)
    store_id        = Column(Integer, ForeignKey("stores.id", ondelete="CASCADE"), nullable=False)
    feed_item_id    = Column(String(128))
    rule_code       = Column(String(16), nullable=False)
    severity        = Column(String(16), nullable=False)
    message         = Column(Text, nullable=False)
    status          = Column(String(16), default="open", nullable=False)
    created_at      = Column(DateTime, server_default=func.now(), nullable=False)
    fixed_at        = Column(DateTime)

class Block(Base):
    __tablename__   = "blocks"
    id              = Column(Integer, primary_key=True)
    store_id        = Column(Integer, ForeignKey("stores.id", ondelete="CASCADE"), nullable=False)
    feed_item_id    = Column(String(128), nullable=False)
    reason          = Column(String(255))
    active          = Column(Boolean, default=True, nullable=False)
    created_at      = Column(DateTime, server_default=func.now(), nullable=False)
    deactivated_at  = Column(DateTime)
