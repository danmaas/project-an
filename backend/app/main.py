import os
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

app = FastAPI(title="Player Insights")

# In the Docker image this resolves to the /data mount. In local dev, override
# via PROJECT_AN_DATA_DIR or just point uvicorn at the repo's data/ directory.
DATA_DIR = Path(os.environ.get("PROJECT_AN_DATA_DIR", "/data"))

STATIC_DIR = Path(__file__).resolve().parent.parent / "static"


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}


@app.api_route("/api/data/{filename}", methods=["GET", "HEAD"])
def get_data_file(filename: str) -> FileResponse:
    # Defense against path traversal: require a plain `.parquet` filename and
    # confirm the resolved path stays inside DATA_DIR.
    if "/" in filename or filename.startswith(".") or not filename.endswith(".parquet"):
        raise HTTPException(status_code=404)
    data_dir = DATA_DIR.resolve()
    candidate = (data_dir / filename).resolve()
    if not candidate.is_file() or data_dir not in candidate.parents:
        raise HTTPException(status_code=404)
    return FileResponse(
        candidate,
        media_type="application/vnd.apache.parquet",
        headers={"Cache-Control": "public, max-age=3600"},
    )


if STATIC_DIR.is_dir():
    app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
