# GMC Shield

GMC Shield is a SaaS + WooCommerce plugin prototype focused on preventing Google Merchant Center suspensions by detecting feed/store inconsistencies, collecting evidence, and supporting remediation workflows.

The repository explores a full workflow around merchant-data ingestion, crawling, rules, preventive blocking, policy publishing, and appeal evidence.

## Why this project

Google Merchant Center issues can come from mismatches between product feeds, storefront content, policies, and technical metadata. GMC Shield models that problem as an engineering pipeline rather than a manual checklist.

## Engineering highlights

- **FastAPI backend** with SQLAlchemy and Alembic migrations.
- **PostgreSQL + Redis** for persistence and queues.
- **RQ workers** for asynchronous feed, crawl, rules, report, and notification jobs.
- **Feed ingestion** for XML, CSV, and TSV sources.
- **Crawler pipeline** designed around Playwright-based page inspection.
- **Rules engine** that compares feed data and storefront evidence.
- **Evidence-oriented workflows** for violations and appeal preparation.
- **WooCommerce plugin** with REST integration, settings, and SKU-level controls.
- **WordPress credential protection** using Fernet encryption with key rotation support.
- **React/Vite frontend** for dashboard and operational flows.
- **Docker-based local environment** for API, workers, database, Redis, and WordPress integration.

## Architecture

```text
Product feed ───────┐
                    ▼
               Feed ingestion
                    │
                    ▼
              PostgreSQL
                    │
        ┌───────────┼───────────┐
        ▼           ▼           ▼
   Crawl queue   Rules queue   Reports
        │           │
        ▼           ▼
   Store pages   Violations + evidence
        │           │
        └──────┬────┘
               ▼
          FastAPI backend
            │       │
            ▼       ▼
      React/Vite   WooCommerce plugin
```

Redis + RQ coordinate asynchronous jobs across the pipeline.

## Core capabilities

- Product-feed ingestion and normalization.
- Versioning by feed hash.
- Store crawling and evidence collection.
- Feed-to-page rule evaluation.
- Violation tracking.
- Preventive feed blocking.
- WordPress policy publishing.
- Appeal-kit workflow.
- Notifications and operational status.
- WooCommerce integration through REST.

## Tech stack

- **Backend:** FastAPI, SQLAlchemy, Alembic
- **Database:** PostgreSQL
- **Queues:** Redis, RQ
- **Frontend:** React, Vite
- **Browser automation:** Playwright
- **WordPress:** custom WooCommerce plugin + REST API
- **Security:** JWT-based API auth, Fernet encryption for stored integration secrets
- **Infrastructure:** Docker Compose

## Quick start

Copy the example environment file first:

```bash
cp .env.example .env
```

Then start the core services:

```bash
docker compose up -d redis db
docker compose run --rm api alembic upgrade head
docker compose up -d api worker rq-feed
```

Run the frontend:

```bash
cd web
npm install
npm run dev
```

The FastAPI documentation is available at `http://localhost:8000/docs`.

## Local development without Docker

```bash
cd api
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Worker:

```bash
python -u ../worker/run_worker.py
```

## Environment and secrets

Important variables include:

```env
DATABASE_URL=<postgres-url>
REDIS_URL=<redis-url>
SECRET_KEY=<application-secret>
CORS_ORIGINS=http://localhost:5173
FERNET_KEY=<generate-a-new-fernet-key>
GOOGLE_CLIENT_ID=<client-id>
GOOGLE_CLIENT_SECRET=<client-secret>
```

Generate a Fernet key locally:

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

For key rotation, the application supports a primary `FERNET_KEY` plus a `FERNET_KEYS` list containing current and previous decryption keys.

Real credentials should always be supplied through environment files or deployment secrets and never committed to the repository.

## Feed ingestion example

```bash
TOKEN=$(python scripts/mint_token.py)
API=http://localhost:8000

curl -H "Authorization: Bearer $TOKEN" \
  -F format=csv \
  -F file=@docs/seed/demo_feed.csv \
  "$API/api/v1/stores/1/feeds/ingest"
```

The ingestion endpoint can also enqueue work asynchronously when the corresponding RQ worker is running.

## WooCommerce integration

The `plugin-woo/` directory contains the WordPress integration. The backend can store an encrypted WordPress Application Password and use the WordPress REST API for store-level operations.

A complete local setup is documented in [`docs/WP-LOCAL.md`](docs/WP-LOCAL.md).

## Demo and documentation

Useful entry points:

- [`docs/DEMO.md`](docs/DEMO.md) — demonstration workflow.
- [`docs/WP-LOCAL.md`](docs/WP-LOCAL.md) — local WordPress integration.
- `docs/seed/` — sample feeds and demo data.
- `docs/issues/` — executable backlog items.
- `scripts/demo.sh` — quick demo automation.
- `scripts/wp_connect.sh` — helper for WordPress connectivity.

## Scope

This repository is an MVP/prototype and intentionally contains demo workflows and local-development infrastructure. It is useful as a systems-design exercise around asynchronous processing, integrations, evidence collection, secure secret handling, and operational tooling rather than as a production-ready Merchant Center compliance guarantee.
