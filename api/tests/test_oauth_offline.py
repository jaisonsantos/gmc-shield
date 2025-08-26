import httpx
import pytest
import respx
from fastapi.testclient import TestClient

from app.main import app


@respx.mock(assert_all_mocked=True)
def test_google_oauth_offline(monkeypatch):
    monkeypatch.setenv("DISABLE_NETWORK", "1")
    client = TestClient(app)
    res = client.get("/api/auth/google/start")
    assert res.status_code == 501
    with pytest.raises(Exception):
        httpx.get("https://example.com")
