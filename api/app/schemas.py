from pydantic import BaseModel, EmailStr, HttpUrl
from typing import Optional, List, Literal, Dict
from datetime import datetime

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class StoreCreate(BaseModel):
    name: str
    platform: str
    base_url: str
    country: Optional[str] = None
    currency: Optional[str] = None
    contact_email: Optional[EmailStr] = None

class FeedConfig(BaseModel):
    source_type: str
    url: Optional[str] = None
    format: str

class ScanRequest(BaseModel):
    limit_items: Optional[int] = 50
    recrawl: Optional[bool] = False

class ViolationOut(BaseModel):
    id: int
    rule_code: str
    severity: str
    message: str
    status: str
    feed_item_id: Optional[str] = None
    run_id: Optional[int] = None
    class Config:
        from_attributes = True


class ViolationPage(BaseModel):
    items: List[ViolationOut]
    page: int
    total: int

    class Config:
        from_attributes = True

class ScanRunOut(BaseModel):
    id: int
    status: str
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    items_total: int
    items_ok: int
    items_violation: int
    class Config:
        from_attributes = True

class BlockCreate(BaseModel):
    feed_item_id: str
    reason: Optional[str] = None

class PolicyCreate(BaseModel):
    type: str
    content_md: str
    publish: bool = False

class AppealCreate(BaseModel):
    violations_ids: List[int]
    notes: Optional[str] = None


class WpCredsIn(BaseModel):
    wp_api_base: HttpUrl
    wp_base_url: Optional[HttpUrl] = None
    wp_user: str
    wp_app_password: str


class PolicyRenderIn(BaseModel):
    type: Literal["refund", "shipping", "privacy"]
    content_md: str


class PolicyPublishIn(PolicyRenderIn):
    status: Literal["publish", "draft"] = "publish"


class PolicyPublishOut(BaseModel):
    type: str
    page_id: int
    page_url: str
    published_at: datetime
    version: int


class WpStatusOut(BaseModel):
    connected: bool
    site: Optional[str] = None
    wp_api_base: Optional[str] = None
    wp_user: Optional[str] = None
    last_status_at: Optional[datetime]
    last_block_sync_at: Optional[datetime] = None
    last_block_synced: Optional[int] = None
    policies: Dict[str, Dict]


class BlockSyncOut(BaseModel):
    total: int
    synced: int
    mode: Literal["pull", "push"]
