.PHONY: help install install-backend install-frontend install-e2e \
        build build-bundled push-bundled run run-bundled \
        test test-backend test-frontend test-e2e \
        lint fmt typecheck clean

IMAGE_NAME         ?= project-an
BUNDLED_IMAGE_NAME ?= project-an-bundled
HOST_PORT          ?= 8000

# ECR target for `make push-bundled`. Defaults match the registry/repo named
# in TASK-800; override on the command line to publish elsewhere.
AWS_REGION   ?= us-east-1
ECR_REGISTRY ?= 043633525143.dkr.ecr.us-east-1.amazonaws.com
ECR_REPO     ?= $(ECR_REGISTRY)/project-an
ECR_TAG      ?= latest

help:
	@echo "Common targets:"
	@echo "  make install         install all dev deps (backend + frontend + e2e)"
	@echo "  make build           build the Docker image ($(IMAGE_NAME))"
	@echo "  make build-bundled   build a fully self-contained image with data/ baked in ($(BUNDLED_IMAGE_NAME))"
	@echo "  make push-bundled    build-bundled, then push it to ECR as $(ECR_REPO):$(ECR_TAG)"
	@echo "  make run             run the container, mounting ./data and exposing :$(HOST_PORT) (opens browser)"
	@echo "  make run-bundled     run the self-contained image (no data mount), exposing :$(HOST_PORT) (opens browser)"
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

# Builds a self-contained image that has the data/ directory baked into /data.
# Depends on `build` so the base runtime layers are available to extend.
build-bundled: build
	docker build -f Dockerfile.bundled --build-arg BASE_IMAGE=$(IMAGE_NAME):latest -t $(BUNDLED_IMAGE_NAME) .

# Authenticates against AWS ECR, tags the bundled image for the target repo,
# and pushes it. Assumes AWS credentials are present in the environment such
# that `aws ecr get-login-password` works (env vars / SSO / instance role).
push-bundled: build-bundled
	aws ecr get-login-password --region $(AWS_REGION) \
	  | docker login --username AWS --password-stdin $(ECR_REGISTRY)
	docker tag $(BUNDLED_IMAGE_NAME):latest $(ECR_REPO):$(ECR_TAG)
	docker push $(ECR_REPO):$(ECR_TAG)

run: build
	@( \
	  until curl -fsS http://127.0.0.1:$(HOST_PORT)/healthz >/dev/null 2>&1; do sleep 0.3; done; \
	  open http://127.0.0.1:$(HOST_PORT) \
	) & \
	docker run --rm -p $(HOST_PORT):8000 -v $(PWD)/data:/data $(IMAGE_NAME)

# Like `run` but uses the bundled image and omits the -v data mount — data is
# baked into the image so the container is fully self-contained.
run-bundled: build-bundled
	@( \
	  until curl -fsS http://127.0.0.1:$(HOST_PORT)/healthz >/dev/null 2>&1; do sleep 0.3; done; \
	  open http://127.0.0.1:$(HOST_PORT) \
	) & \
	docker run --rm -p $(HOST_PORT):8000 $(BUNDLED_IMAGE_NAME)

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
