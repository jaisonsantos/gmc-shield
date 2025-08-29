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
    monkeypatch.setattr(google_mc.settings, "GOOGLE_API_BASE", "https://mc")
    monkeypatch.setattr(google_mc.settings, "GOOGLE_CLIENT_ID", "cid")
    monkeypatch.setattr(google_mc.settings, "GOOGLE_CLIENT_SECRET", "sec")
    monkeypatch.setattr(google_mc.settings, "GOOGLE_TOKEN_ENDPOINT", "https://token")
    monkeypatch.setattr(svc.settings, "GOOGLE_API_BASE", "https://mc")
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
def test_mc_accounts_propagates_authinfo_mock(monkeypatch):
    client, TestingSession, _ = setup(monkeypatch)
    db = TestingSession()
    _, token = seed_ga(db)
    db.close()
    respx.get("https://mc/content/v2.1/accounts/authinfo").mock(
        return_value=httpx.Response(200, json={"accountIdentifiers": [{"merchantId": "123"}]})
    )
    headers = {"Authorization": f"Bearer {token}"}
    res = client.get("/api/google/mc/accounts", headers=headers)
    assert res.status_code == 200
    assert res.json()["accountIdentifiers"][0]["merchantId"] == "123"


@respx.mock
def test_mc_products_pagination_two_pages(monkeypatch):
    client, TestingSession, _ = setup(monkeypatch)
    db = TestingSession()
    _, token = seed_ga(db)
    db.close()
    respx.get("https://mc/content/v2.1/123/products").mock(
        side_effect=[
            httpx.Response(200, json={"nextPageToken": "p2", "resources": [1]}),
            httpx.Response(200, json={"resources": [2]}),
        ]
    )
    headers = {"Authorization": f"Bearer {token}"}
    first = client.get("/api/google/mc/123/products", headers=headers)
    assert first.status_code == 200
    assert first.json()["nextPageToken"] == "p2"
    second = client.get("/api/google/mc/123/products?pageToken=p2", headers=headers)
    assert second.status_code == 200
    assert second.json()["resources"] == [2]


@respx.mock
def test_mc_products_401_then_refresh_succeeds(monkeypatch):
    client, TestingSession, _ = setup(monkeypatch)
    db = TestingSession()
    ga, token = seed_ga(db)
    db.close()
    # first call 401 then 200
    respx.get("https://mc/content/v2.1/123/products").mock(
        side_effect=[httpx.Response(401), httpx.Response(200, json={"resources": []})]
    )
    respx.post("https://token").mock(
        return_value=httpx.Response(200, json={"access_token": "new", "expires_in": 3600})
    )
    headers = {"Authorization": f"Bearer {token}"}
    res = client.get("/api/google/mc/123/products", headers=headers)
    assert res.status_code == 200
    db = TestingSession()
    ga = db.query(models.GoogleAccount).first()
    assert ga.access_token_enc == "new"
    db.close()


@respx.mock
def test_mc_products_403_invalid_grant_requires_reconnect(monkeypatch):
    client, TestingSession, _ = setup(monkeypatch)
    db = TestingSession()
    _, token = seed_ga(db)
    db.close()
    respx.get("https://mc/content/v2.1/123/products").mock(
        return_value=httpx.Response(403, json={"error": "invalid_grant"})
    )
    headers = {"Authorization": f"Bearer {token}"}
    res = client.get("/api/google/mc/123/products", headers=headers)
    assert res.status_code == 403
    assert res.json()["detail"] == "reconnect required"
