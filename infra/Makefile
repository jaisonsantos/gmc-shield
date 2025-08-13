# --- Containers base ---
up:
	docker compose up -d
down:
	docker compose down -v
restart:
	docker compose restart api
ps:
	docker compose ps
logs:
	docker compose logs -f --tail=200
api-logs:
	docker compose logs -f --tail=200 api
worker-logs:
	docker compose logs -f --tail=200 worker

# --- Banco / Alembic ---
migrate:
	docker compose run --rm api alembic upgrade head
revision:
	docker compose run --rm api alembic revision --autogenerate -m "auto"

# --- Seeds & util ---
seed:
	docker compose exec -T api python -m app.scripts.seed_users
token:
	docker compose exec -T api python -m app.scripts.mint_token | tr -d '\r'

# --- WordPress opcional ---
wp-up:
	docker compose -f docker-compose.wp.yml up -d
wp-down:
	docker compose -f docker-compose.wp.yml down -v

# --- Web (dev) ---
web:
	cd web && npm install && npm run dev

# --- Smokes ---
smoke:
	TOKEN=$$(docker compose exec -T api python -m app.scripts.mint_token | tr -d '\r') \
	bash scripts/smoke_rbac.sh --api http://localhost:8000 --store-name "Loja RBAC" --feed docs/seed/demo_feed.xml
