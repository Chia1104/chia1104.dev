.PHONY: help init init-www init-dash init-service \
        dev dev-www dev-dash dev-service \
        build build-www build-dash build-service \
        test test-watch test-e2e \
        lint lint-fix format type-check \
        db-up db-migrate db-seed db-studio db-generate \
        docker-build docker-build-www docker-build-dash docker-build-service \
        clean

## help: Show available targets
help:
	@echo "Usage: make <target>"
	@echo ""
	@echo "Setup:"
	@echo "  init              Install dependencies and create .env files for all apps"
	@echo "  init-www          Create .env for apps/www"
	@echo "  init-dash         Create .env for apps/dash"
	@echo "  init-service      Create .env for apps/service"
	@echo ""
	@echo "Development:"
	@echo "  dev               Run all applications"
	@echo "  dev-www           Run www + service"
	@echo "  dev-dash          Run dash + service"
	@echo "  dev-service       Run service only"
	@echo ""
	@echo "Build:"
	@echo "  build             Build all applications"
	@echo "  build-www         Build apps/www"
	@echo "  build-dash        Build apps/dash"
	@echo "  build-service     Build apps/service"
	@echo ""
	@echo "Testing:"
	@echo "  test              Run unit tests"
	@echo "  test-watch        Run unit tests in watch mode"
	@echo "  test-e2e          Run Playwright end-to-end tests"
	@echo ""
	@echo "Code Quality:"
	@echo "  lint              Lint all code"
	@echo "  lint-fix          Auto-fix linting issues"
	@echo "  format            Format code with Oxfmt"
	@echo "  type-check        Run TypeScript type checking"
	@echo ""
	@echo "Database:"
	@echo "  db-up             Start PostgreSQL and Redis with Docker"
	@echo "  db-migrate        Run database migrations"
	@echo "  db-seed           Seed the database"
	@echo "  db-studio         Open Drizzle Studio"
	@echo "  db-generate       Generate Drizzle types"
	@echo ""
	@echo "Docker:"
	@echo "  docker-build      Build all Docker images"
	@echo "  docker-build-www  Build www Docker image"
	@echo "  docker-build-dash Build dash Docker image"
	@echo "  docker-build-service Build service Docker image"
	@echo ""
	@echo "  clean             Clean all caches and build artifacts"

# ── Setup ────────────────────────────────────────────────────────────────────

init:
	@echo "Installing dependencies..."
	@pnpm install
	@echo "Installing dependencies... Done"
	@echo "Creating www .env file..."
	@cp ./apps/www/.env.example ./apps/www/.env
	@echo "Creating www .env file... Done"
	@echo "Creating dash .env file..."
	@cp ./apps/dash/.env.example ./apps/dash/.env
	@echo "Creating dash .env file... Done"
	@echo "Creating service .env file..."
	@cp ./apps/service/.env.example ./apps/service/.env
	@echo "Creating service .env file... Done"

init-www:
	@echo "Creating www .env file..."
	@cp ./apps/www/.env.example ./apps/www/.env
	@echo "Creating www .env file... Done"

init-dash:
	@echo "Creating dashboard .env file..."
	@cp ./apps/dash/.env.example ./apps/dash/.env
	@echo "Creating dashboard .env file... Done"

init-service:
	@echo "Creating service .env file..."
	@cp ./apps/service/.env.example ./apps/service/.env
	@echo "Creating service .env file... Done"

# ── Development ───────────────────────────────────────────────────────────────

dev:
	@pnpm dev

dev-www:
	@pnpm dev:www

dev-dash:
	@pnpm dev:dash

dev-service:
	@pnpm dev:service

# ── Build ─────────────────────────────────────────────────────────────────────

build:
	@pnpm build

build-www:
	@pnpm build:www

build-dash:
	@pnpm build:dash

build-service:
	@pnpm build:service

# ── Testing ───────────────────────────────────────────────────────────────────

test:
	@pnpm test

test-watch:
	@pnpm test:watch

test-e2e:
	@pnpm test:e2e

# ── Code Quality ──────────────────────────────────────────────────────────────

lint:
	@pnpm lint

lint-fix:
	@pnpm lint:fix

format:
	@pnpm format

type-check:
	@pnpm type:check

# ── Database ──────────────────────────────────────────────────────────────────

db-up:
	@pnpm db:up

db-migrate:
	@pnpm db:migrate

db-seed:
	@pnpm db:seed

db-studio:
	@pnpm db:studio

db-generate:
	@pnpm db:generate

# ── Docker ────────────────────────────────────────────────────────────────────

docker-build-www:
	@docker build -f Dockerfile.www -t chia1104-www .

docker-build-dash:
	@docker build -f Dockerfile.dash -t chia1104-dash .

docker-build-service:
	@docker build -f Dockerfile.service -t chia1104-service .

docker-build: docker-build-www docker-build-dash docker-build-service

# ── Cleanup ───────────────────────────────────────────────────────────────────

clean:
	@pnpm clean:workspaces
