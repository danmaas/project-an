.PHONY: help install install-backend install-frontend install-e2e \
        build run test test-backend test-frontend test-e2e \
        lint fmt typecheck clean

IMAGE_NAME ?= project-an
HOST_PORT  ?= 8000

help:
	@echo "Common targets:"
	@echo "  make install         install all dev deps (backend + frontend + e2e)"
	@echo "  make build           build the Docker image ($(IMAGE_NAME))"
	@echo "  make run             run the container, mounting ./data and exposing :$(HOST_PORT) (opens browser)"
	@echo "  make test            run all tests (backend, frontend, e2e)"
	@echo "  make test-backend    pytest"
	@echo "  make test-frontend   vitest"
	@echo "  make test-e2e        build image, run Playwright against it"
	@echo "  make lint            ruff check + eslint"
	@echo "  make fmt             ruff format + prettier"
	@echo "  make typecheck       vue-tsc"
	@echo "  make clean           remove build artifacts"

install: install-backend install-frontend install-e2e

install-backend:
	cd backend && uv sync

install-frontend:
	cd frontend && corepack enable && yarn install

install-e2e:
	cd e2e && corepack enable && yarn install
	cd e2e && yarn playwright install --with-deps chromium

build:
	docker build -t $(IMAGE_NAME) .

run: build
	@( \
	  until curl -fsS http://127.0.0.1:$(HOST_PORT)/healthz >/dev/null 2>&1; do sleep 0.3; done; \
	  open http://127.0.0.1:$(HOST_PORT) \
	) & \
	docker run --rm -p $(HOST_PORT):8000 -v $(PWD)/data:/data $(IMAGE_NAME)

test: test-backend test-frontend test-e2e

test-backend:
	cd backend && uv run pytest

test-frontend:
	cd frontend && yarn test

test-e2e: build
	cd e2e && yarn test

lint:
	cd backend && uv run ruff check .
	cd frontend && yarn lint

fmt:
	cd backend && uv run ruff format .
	cd frontend && yarn format

typecheck:
	cd frontend && yarn typecheck

clean:
	rm -rf backend/.venv backend/.pytest_cache backend/.coverage
	rm -rf frontend/node_modules frontend/dist frontend/.yarn/cache
	rm -rf e2e/node_modules e2e/test-results e2e/playwright-report e2e/.yarn/cache
