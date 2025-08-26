import httpx
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.main import app
from app.db import Base, get_db
from app import models
from app.auth import create_token

# setup test database
engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
@event.listens_for(engine, "connect")
def connect(dbapi_connection, connection_record):
    pass
TestingSession = sessionmaker(bind=engine)
Base.metadata.create_all(
    engine,
    tables=[
        models.Account.__table__,
        models.Store.__table__,
        models.Feed.__table__,
        models.FeedVersion.__table__,
        models.FeedItem.__table__,
    ],
)

def override_get_db():
    db = TestingSession()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


def seed_store(db):
    acc = models.Account(name="A", type="merchant")
    db.add(acc)
    db.flush()
    store = models.Store(account_id=acc.id, platform="woo", base_url="http://example.com")
    db.add(store)
    db.commit()
    return store.id


def test_ingest_and_list_versions_and_items():
    db = TestingSession()
    store_id = seed_store(db)
    db.close()
    csv_data = "id,title,price\n1,Item,9.99 USD\n2,Item2,5 USD\n"
    files = {"file": ("feed.csv", csv_data, "text/csv")}
    token = create_token("t@example.com", "owner", 1)
    headers = {"Authorization": f"Bearer {token}"}
    res = client.post(f"/api/v1/stores/{store_id}/feeds/ingest", files=files, data={"format": "csv"}, headers=headers)
    assert res.status_code == 200
    body = res.json()
    assert body["items_imported"] == 2
    versions = client.get(f"/api/v1/stores/{store_id}/feeds/versions", headers=headers).json()["items"]
    assert versions and versions[0]["items_count"] == 2
    version_id = versions[0]["id"]
    items = client.get(f"/api/v1/feeds/versions/{version_id}/items", headers=headers).json()
    assert items["total"] == 2


def test_ingest_via_url_json(monkeypatch):
    db = TestingSession()
    store_id = seed_store(db)
    db.close()
    token = create_token("t@example.com", "owner", 1)
    headers = {"Authorization": f"Bearer {token}"}

    async def fake_get(self, url, *args, **kwargs):
        return httpx.Response(200, content=b"id,title,price\n3,Item3,1 USD\n", request=httpx.Request("GET", url))

    monkeypatch.setattr(httpx.AsyncClient, "get", fake_get)

    res = client.post(
        f"/api/v1/stores/{store_id}/feeds/ingest",
        json={"url": "http://example.com/feed.csv", "format": "csv"},
        headers=headers,
    )
    assert res.status_code == 200
    body = res.json()
    assert body["items_imported"] == 1


def test_legacy_versions_endpoint_returns_hash(monkeypatch):
    db = TestingSession()
    store_id = seed_store(db)
    db.close()
    token = create_token("t@example.com", "owner", 1)
    headers = {"Authorization": f"Bearer {token}"}
    files = {"file": ("feed.csv", "id,title,price\n1,Item,9 USD\n", "text/csv")}
    client.post(
        f"/api/v1/stores/{store_id}/feeds/ingest", files=files, data={"format": "csv"}, headers=headers
    )
    res = client.get(f"/api/stores/{store_id}/feed/versions", headers=headers)
    body = res.json()
    assert "items" in body and body["items"]
    assert "hash" in body["items"][0]
    assert body["items"][0]["hash"] == body["items"][0]["content_hash"]
