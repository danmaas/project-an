from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_healthz_returns_ok() -> None:
    response = client.get("/healthz")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_app_metadata() -> None:
    assert app.title == "Player Insights"


def test_unknown_route_returns_404() -> None:
    # With no static dir mounted in the dev tree, an unknown path should 404.
    response = client.get("/not-a-real-path-xyz")
    assert response.status_code == 404
