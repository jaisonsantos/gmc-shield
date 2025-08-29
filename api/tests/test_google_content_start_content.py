import urllib.parse
import fakeredis
from fastapi.testclient import TestClient

from app.main import app
from app.routers import oauth_google


def setup_client(monkeypatch):
    r = fakeredis.FakeRedis(decode_responses=True)
    monkeypatch.setattr(oauth_google, "get_redis", lambda: r)
    monkeypatch.setattr(oauth_google.settings, "GOOGLE_CLIENT_ID", "cid")
    monkeypatch.setattr(
        oauth_google.settings,
        "GOOGLE_OAUTH_REDIRECT_URI",
        "http://localhost:8000/api/auth/google/callback",
    )
    client = TestClient(app)
    return client, r


def test_start_content_builds_auth_url_and_persists_state_pkce(monkeypatch):
    client, r = setup_client(monkeypatch)
    res = client.get("/api/auth/google/start-content?return_to=/settings")
    assert res.status_code == 200
    auth_url = res.json()["auth_url"]
    qs = urllib.parse.parse_qs(urllib.parse.urlparse(auth_url).query)
    assert qs["scope"][0] == oauth_google.settings.GOOGLE_OAUTH_SCOPES_CONTENT
    state = qs["state"][0]
    state_id = oauth_google.signer.unsign(state, max_age=300).decode()
    assert r.get(f"oauth:state:{state_id}") is not None
    assert r.get(f"oauth:pkce:{state_id}") is not None
    assert r.get(f"oauth:nonce:{state_id}") is not None


def test_start_content_rate_limited(monkeypatch):
    client, _ = setup_client(monkeypatch)
    for _ in range(10):
        assert client.get("/api/auth/google/start-content").status_code == 200
    res = client.get("/api/auth/google/start-content")
    assert res.status_code == 429
