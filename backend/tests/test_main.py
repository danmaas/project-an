from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app import main
from app.main import app

client = TestClient(app)


def test_healthz_returns_ok() -> None:
    response = client.get("/healthz")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_app_metadata() -> None:
    assert app.title == "Player Insights"


def test_unknown_route_returns_404() -> None:
    response = client.get("/not-a-real-path-xyz")
    assert response.status_code == 404


@pytest.fixture
def data_dir(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    monkeypatch.setattr(main, "DATA_DIR", tmp_path)
    return tmp_path


def test_list_data_files_returns_parquet_files_alphabetically(data_dir: Path) -> None:
    (data_dir / "events-b.parquet").write_bytes(b"PAR1")
    (data_dir / "events-a.parquet").write_bytes(b"PAR1")
    (data_dir / "notes.txt").write_text("ignored")
    (data_dir / ".hidden.parquet").write_bytes(b"PAR1")
    (data_dir / "subdir").mkdir()

    response = client.get("/api/data")

    assert response.status_code == 200
    assert response.json() == {"files": ["events-a.parquet", "events-b.parquet"]}


def test_list_data_files_returns_empty_list_for_empty_dir(data_dir: Path) -> None:
    response = client.get("/api/data")
    assert response.status_code == 200
    assert response.json() == {"files": []}


def test_list_data_files_returns_empty_list_when_dir_missing(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(main, "DATA_DIR", tmp_path / "does-not-exist")
    response = client.get("/api/data")
    assert response.status_code == 200
    assert response.json() == {"files": []}


def test_get_data_file_serves_parquet_bytes(data_dir: Path) -> None:
    payload = b"PAR1\x00\x01\x02fake-parquet-bytesPAR1"
    (data_dir / "events.parquet").write_bytes(payload)

    response = client.get("/api/data/events.parquet")

    assert response.status_code == 200
    assert response.content == payload
    assert response.headers["content-type"] == "application/vnd.apache.parquet"
    assert "max-age" in response.headers["cache-control"]


def test_head_request_returns_content_length_without_body(data_dir: Path) -> None:
    # Browser libraries (e.g. hyparquet) issue HEAD before GET to learn the
    # file size and decide on range requests; the route must answer HEAD too.
    payload = b"PAR1" + b"x" * 200
    (data_dir / "events.parquet").write_bytes(payload)

    response = client.head("/api/data/events.parquet")

    assert response.status_code == 200
    assert response.headers["content-length"] == str(len(payload))
    assert response.content == b""


def test_get_data_file_missing_returns_404(data_dir: Path) -> None:
    response = client.get("/api/data/does-not-exist.parquet")
    assert response.status_code == 404


def test_get_data_file_rejects_non_parquet_extension(data_dir: Path) -> None:
    (data_dir / "secrets.txt").write_text("hunter2")
    response = client.get("/api/data/secrets.txt")
    assert response.status_code == 404


def test_get_data_file_rejects_dotfile(data_dir: Path) -> None:
    (data_dir / ".hidden.parquet").write_bytes(b"PAR1")
    response = client.get("/api/data/.hidden.parquet")
    assert response.status_code == 404


def test_get_data_file_rejects_path_traversal(data_dir: Path, tmp_path: Path) -> None:
    # Plant a file outside DATA_DIR that an attacker might try to read.
    outside = tmp_path.parent / "outside.parquet"
    outside.write_bytes(b"PAR1-outside")
    # %2F is the URL-encoded slash; the router should decode it and our handler
    # should reject either the encoded or decoded form.
    response = client.get("/api/data/..%2Foutside.parquet")
    assert response.status_code == 404
