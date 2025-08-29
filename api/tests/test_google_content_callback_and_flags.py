import time
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
from app.routers import oauth_google


def setup(monkeypatch):
    engine = create_engine(
        "sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    TestingSession = sessionmaker(bind=engine)
    Base.metadata.create_all(engine, tables=[models.Account.__table__, models.User.__table__, models.GoogleAccount.__table__])

    def override_get_db():
        db = TestingSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db

    r = fakeredis.FakeRedis(decode_responses=True)
    monkeypatch.setattr(oauth_google, "get_redis", lambda: r)
    monkeypatch.setattr(oauth_google, "encrypt_str", lambda s: s)
    monkeypatch.setattr(oauth_google.settings, "GOOGLE_CLIENT_ID", "cid")
    monkeypatch.setattr(oauth_google.settings, "GOOGLE_CLIENT_SECRET", "secret")
    monkeypatch.setattr(oauth_google.settings, "GOOGLE_OAUTH_REDIRECT_URI", "http://localhost:8000/api/auth/google/callback")
    monkeypatch.setattr(oauth_google.settings, "GOOGLE_TOKEN_ENDPOINT", "https://token")
    monkeypatch.setattr(oauth_google.settings, "GOOGLE_USERINFO_ENDPOINT", "https://userinfo")
    client = TestClient(app)

    def teardown():
        app.dependency_overrides.pop(get_db, None)

    return client, r, teardown, TestingSession


@respx.mock
def test_callback_sets_content_scope_granted_true(monkeypatch):
    client, r, teardown, TestingSession = setup(monkeypatch)
    state_id = "abc"
    nonce = "nonce123"
    r.setex(f"oauth:state:{state_id}", 300, '{"return_to": "/app", "content": true}')
    r.setex(f"oauth:pkce:{state_id}", 300, "verifier")
    r.setex(f"oauth:nonce:{state_id}", 300, nonce)
    state = oauth_google.signer.sign(state_id).decode()

    id_token = oauth_google.jwt.encode(
        {
            "iss": oauth_google.settings.GOOGLE_OAUTH_ISSUER,
            "aud": oauth_google.settings.GOOGLE_CLIENT_ID,
            "exp": int(time.time()) + 3600,
            "nonce": nonce,
        },
        "secret",
        algorithm="HS256",
    )

    respx.post("https://token").mock(
        return_value=httpx.Response(
            200,
            json={
                "access_token": "at",
                "refresh_token": "rt",
                "expires_in": 3600,
                "id_token": id_token,
            },
        )
    )
    respx.get("https://userinfo").mock(
        return_value=httpx.Response(
            200,
            json={"sub": "sub1", "email": "user@example.com", "name": "User", "picture": "http://p"},
        )
    )

    res = client.get(f"/api/auth/google/callback?state={state}&code=CODE", allow_redirects=False)
    assert res.status_code == 307
    db = TestingSession()
    ga = db.query(models.GoogleAccount).first()
    assert ga.content_scope_granted is True
    db.close()
    teardown()


@respx.mock
def test_refresh_token_not_overwritten_with_null(monkeypatch):
    client, r, teardown, TestingSession = setup(monkeypatch)
    db = TestingSession()
    acc = models.Account(name="a", type="merchant")
    db.add(acc)
    db.flush()
    user = models.User(account_id=acc.id, email="u@e.com", password_hash="", role="owner")
    db.add(user)
    db.flush()
    ga = models.GoogleAccount(user_id=user.id, sub="subx", refresh_token_enc="old_enc")
    db.add(ga)
    db.commit()
    db.close()

    state_id = "id3"
    nonce = "n3"
    r.setex(f"oauth:state:{state_id}", 300, '{"return_to": "/", "content": true}')
    r.setex(f"oauth:pkce:{state_id}", 300, "ver")
    r.setex(f"oauth:nonce:{state_id}", 300, nonce)
    state = oauth_google.signer.sign(state_id).decode()

    id_token = oauth_google.jwt.encode(
        {
            "iss": oauth_google.settings.GOOGLE_OAUTH_ISSUER,
            "aud": oauth_google.settings.GOOGLE_CLIENT_ID,
            "exp": int(time.time()) + 3600,
            "nonce": nonce,
        },
        "secret",
        algorithm="HS256",
    )

    respx.post("https://token").mock(
        return_value=httpx.Response(
            200,
            json={"access_token": "at", "expires_in": 3600, "id_token": id_token},
        )
    )
    respx.get("https://userinfo").mock(
        return_value=httpx.Response(200, json={"sub": "subx", "email": "u@e.com"})
    )

    res = client.get(f"/api/auth/google/callback?state={state}&code=C", allow_redirects=False)
    assert res.status_code == 307
    db = TestingSession()
    ga = db.query(models.GoogleAccount).filter_by(sub="subx").first()
    assert ga.refresh_token_enc == "old_enc"
    db.close()
    teardown()
