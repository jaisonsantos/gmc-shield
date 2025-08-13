from pydantic import BaseModel, EmailStr
from typing import Optional, List

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
