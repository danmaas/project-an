from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

app = FastAPI(title="Player Insights")

# In the Docker image this is /app/static (populated from the Vite build).
# In local dev (running uvicorn from backend/), this resolves to backend/static
# and will simply be absent — the health endpoint still works.
STATIC_DIR = Path(__file__).resolve().parent.parent / "static"


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}


if STATIC_DIR.is_dir():
    app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
