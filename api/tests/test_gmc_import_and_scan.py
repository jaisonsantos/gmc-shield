import datetime as dt
import httpx
import fakeredis
import respx
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.db import Base, get_db
from app import models
from app.auth import create_token
from app.routers import google_mc as router_gmc


def setup_env(monkeypatch):
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
            models.Feed.__table__,
            models.FeedVersion.__table__,
            models.FeedItem.__table__,
            models.ScanRun.__table__,
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
    monkeypatch.setattr(router_gmc, "get_redis", lambda: r)
    client = TestClient(app)
    return client, TestingSession


def seed_user_ga(db):
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
    token = create_token(user.email, user.role, user.account_id)
    return store.id, token


@respx.mock
def test_import_products_creates_items_and_version(monkeypatch):
    client, TestingSession = setup_env(monkeypatch)
    db = TestingSession()
    store_id, token = seed_user_ga(db)
    db.close()

    # mock Google Content API via service wrapper
    async def fake_greq(db, ga, method, url, params=None):  # type: ignore[no-redef]
        assert "products" in url
        return httpx.Response(200, json={
            "resources": [
                {
                    "id": "online:pt:ES:SKU-001",
                    "offerId": "SKU-001",
                    "title": "Produto de teste",
                    "link": "http://example.com/p/sku-001",
                    "availability": "in stock",
                    "price": {"value": "10.00", "currency": "EUR"},
                }
            ]
        })

    monkeypatch.setattr(router_gmc, "google_api_request", fake_greq)

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
    db.close()


def test_scan_enqueue_counts_available_items(monkeypatch):
    client, TestingSession = setup_env(monkeypatch)
    db = TestingSession()
    store_id, token = seed_user_ga(db)
    # create one feed item for store
    feed = models.Feed(store_id=store_id, source_type="gmc", format="json")
    db.add(feed)
    db.flush()
    db.add(models.FeedItem(store_id=store_id, feed_id=feed.id, item_id="SKU-001", title="x", link_canonical="http://example.com", price_cents=1000, currency="EUR", availability="in stock"))
    db.commit()
    db.close()

    headers = {"Authorization": f"Bearer {token}"}
    res = client.post(f"/api/stores/{store_id}/scan", headers=headers, json={"limit_items": 20})
    assert res.status_code == 201
    payload = res.json()
    assert payload["queued"] == 1

