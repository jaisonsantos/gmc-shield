import datetime as dt
import fakeredis
import httpx
import respx
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.db import Base, get_db
from app import models
from app.auth import create_token
from app.routers import google_mc
from app.services import google_mc as svc


def setup(monkeypatch):
    engine = create_engine(
        "sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    TestingSession = sessionmaker(bind=engine)
    Base.metadata.create_all(
        engine,
        tables=[
            models.Account.__table__,
            models.User.__table__,
            models.Store.__table__,
            models.GoogleAccount.__table__,
        ],
    )

    def override_get_db():
        db = TestingSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db

    r = fakeredis.FakeRedis(decode_responses=True)
    monkeypatch.setattr(google_mc, "get_redis", lambda: r)
    monkeypatch.setattr(svc, "decrypt_str", lambda s: s)
    monkeypatch.setattr(svc, "encrypt_str", lambda s: s)
    monkeypatch.setattr(google_mc.settings, "GOOGLE_API_BASE", "https://www.googleapis.com")
    monkeypatch.setattr(google_mc.settings, "GOOGLE_MERCHANT_API_BASE", "https://merchantapi.googleapis.com")
    monkeypatch.setattr(google_mc.settings, "GOOGLE_CLIENT_ID", "cid")
    monkeypatch.setattr(google_mc.settings, "GOOGLE_CLIENT_SECRET", "sec")
    monkeypatch.setattr(google_mc.settings, "GOOGLE_TOKEN_ENDPOINT", "https://token")
    monkeypatch.setattr(svc.settings, "GOOGLE_API_BASE", "https://www.googleapis.com")
    monkeypatch.setattr(svc.settings, "GOOGLE_MERCHANT_API_BASE", "https://merchantapi.googleapis.com")
    monkeypatch.setattr(svc.settings, "GOOGLE_CLIENT_ID", "cid")
    monkeypatch.setattr(svc.settings, "GOOGLE_CLIENT_SECRET", "sec")
    monkeypatch.setattr(svc.settings, "GOOGLE_TOKEN_ENDPOINT", "https://token")
    client = TestClient(app)
    return client, TestingSession, r


def seed_ga(db):
    acc = models.Account(name="a", type="merchant")
    db.add(acc)
    db.flush()
    user = models.User(account_id=acc.id, email="u@e.com", password_hash="", role="owner")
    db.add(user)
    db.flush()
    ga = models.GoogleAccount(
        user_id=user.id,
        sub="sub",
        access_token_enc="at",
        refresh_token_enc="rt",
        token_expiry=dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=1),
        content_scope_granted=True,
    )
    db.add(ga)
    db.commit()
    token = create_token(user.email, user.role, user.account_id)
    return ga, token


@respx.mock
def test_mc_accounts_calls_merchant_api_v1(monkeypatch):
    """Test that /accounts endpoint calls Merchant API v1."""
    client, TestingSession, _ = setup(monkeypatch)
    db = TestingSession()
    _, token = seed_ga(db)
    db.close()
    
    respx.get("https://merchantapi.googleapis.com/accounts/v1/accounts").mock(
        return_value=httpx.Response(200, json={
            "accounts": [
                {
                    "name": "accounts/123456789",
                    "displayName": "My Store"
                }
            ]
        })
    )
    headers = {"Authorization": f"Bearer {token}"}
    res = client.get("/api/google/mc/accounts", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "accounts" in data
    assert data["accounts"][0]["name"] == "accounts/123456789"


@respx.mock
def test_mc_products_calls_merchant_api_v1(monkeypatch):
    """Test that /products endpoint calls Merchant API v1 with correct format."""
    client, TestingSession, _ = setup(monkeypatch)
    db = TestingSession()
    _, token = seed_ga(db)
    db.close()
    
    respx.get("https://merchantapi.googleapis.com/products/v1/accounts/123456789/products").mock(
        return_value=httpx.Response(200, json={
            "products": [
                {
                    "name": "accounts/123456789/products/en~US~SKU-001",
                    "offerId": "SKU-001",
                    "productAttributes": {
                        "title": "Test Product",
                        "link": "http://example.com/p/sku-001",
                        "availability": "IN_STOCK",
                        "price": {
                            "amountMicros": "1599000000",
                            "currencyCode": "USD"
                        }
                    }
                }
            ]
        })
    )
    
    headers = {"Authorization": f"Bearer {token}"}
    res = client.get("/api/google/mc/123456789/products?pageSize=50", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "products" in data
    assert data["products"][0]["offerId"] == "SKU-001"


def setup_env(monkeypatch):
    """Setup environment for import tests."""
    return setup(monkeypatch)[:2]


@respx.mock
def test_import_products_creates_items_and_version_merchant_api(monkeypatch):
    """Test import flow with Merchant API v1 response format."""
    client, TestingSession = setup_env(monkeypatch)
    db = TestingSession()
    acc = models.Account(name="acc", type="merchant")
    db.add(acc)
    db.flush()
    user = models.User(account_id=acc.id, email="owner@example.com", password_hash="", role="owner")
    db.add(user)
    db.flush()
    store = models.Store(account_id=acc.id, platform="woocommerce", base_url="http://x", country="ES", currency="EUR")
    db.add(store)
    db.flush()
    ga = models.GoogleAccount(
        user_id=user.id,
        sub="sub",
        email="owner@example.com",
        access_token_enc="at",
        refresh_token_enc="rt",
        token_expiry=dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=1),
        content_scope_granted=True,
    )
    db.add(ga)
    db.commit()
    store_id = store.id
    token = create_token(user.email, user.role, user.account_id)
    db.close()

    respx.get("https://merchantapi.googleapis.com/products/v1/accounts/123/products").mock(
        return_value=httpx.Response(200, json={
            "products": [
                {
                    "name": "accounts/123/products/en~PT~SKU-001",
                    "offerId": "SKU-001",
                    "productAttributes": {
                        "title": "Produto de teste",
                        "link": "http://example.com/p/sku-001",
                        "availability": "IN_STOCK",
                        "price": {
                            "amountMicros": "1000000000",
                            "currencyCode": "EUR"
                        }
                    }
                }
            ]
        })
    )

    headers = {"Authorization": f"Bearer {token}"}
    res = client.post(f"/api/google/mc/123/import?store_id={store_id}", headers=headers)
    assert res.status_code == 200
    out = res.json()
    assert out["imported"] == 1

    db = TestingSession()
    assert db.query(models.Feed).count() == 1
    assert db.query(models.FeedItem).count() == 1
    assert db.query(models.FeedVersion).count() == 1
    item = db.query(models.FeedItem).first()
    assert item.item_id == "SKU-001"
    assert item.title == "Produto de teste"
    assert item.price_cents == 1000  # 1000000000 micros = 1000 cents
    assert item.currency == "EUR"
    db.close()
