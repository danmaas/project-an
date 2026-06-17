# syntax=docker/dockerfile:1.7

# ============================================================
# Stage 1: build the front-end (yarn + vite)
# ============================================================
FROM node:22-alpine AS frontend-builder

WORKDIR /build

# Enable Yarn 4 via corepack
RUN corepack enable

# Install deps first so source edits don't bust this layer.
# .yarnrc.yml must be present BEFORE `yarn install` so the node-modules
# linker is selected from the start (Yarn 4 defaults to PnP otherwise).
COPY frontend/package.json frontend/yarn.lock frontend/.yarnrc.yml ./
RUN yarn install --immutable

# Now copy source and build.
COPY frontend/ ./
RUN yarn build

# ============================================================
# Stage 2: runtime (python + fastapi + built front-end)
# ============================================================
FROM python:3.14-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Install uv for fast, deterministic dependency installs.
RUN pip install --no-cache-dir uv

# Install Python deps from pyproject.toml.
# This layer is cached unless pyproject.toml changes — front-end and backend
# source edits do NOT invalidate it.
COPY backend/pyproject.toml ./
RUN uv pip compile pyproject.toml -o /tmp/requirements.txt \
 && uv pip install --system --no-cache-dir -r /tmp/requirements.txt \
 && rm /tmp/requirements.txt

# Copy back-end source.
COPY backend/app ./app

# Copy built front-end assets. Placed last so front-end edits only invalidate
# this single layer (Python deps above are preserved in cache).
COPY --from=frontend-builder /build/dist ./static

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
