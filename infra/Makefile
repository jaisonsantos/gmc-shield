# infra/Makefile

# --- Containers base ---
up:          ## Sobe api + db + redis + worker
	docker compose up -d

up-crawl:    ## Sobe somente o worker de crawl (RQ)
	docker compose up -d rq-crawl

feed-logs:   ## Logs do worker de feed (RQ)
	docker compose logs -f --tail=200 rq-feed

crawl-logs:  ## Logs do worker de crawl (RQ)
	docker compose logs -f --tail=200 rq-crawl
down:        ## Derruba tudo (com volumes)
	docker compose down -v --remove-orphans
ps:          ## Status dos serviços
	docker compose ps
logs:        ## Logs de todos
	docker compose logs -f --tail=200
api-logs:    ## Logs da API
	docker compose logs -f --tail=200 api
worker-logs: ## Logs do worker
	docker compose logs -f --tail=200 worker
restart:     ## Reinicia API
	docker compose restart api

# --- Banco / Alembic ---
migrate:     ## Alembic upgrade head
	docker compose run --rm api alembic upgrade head
revision:    ## Alembic autogenerate
	docker compose run --rm api alembic revision --autogenerate -m "auto"

# --- Seeds & util ---
seed:        ## Seed de usuários (owner/manager/viewer)
	docker compose exec -T api python -m app.scripts.seed_users
token:       ## Gera JWT local
	docker compose exec -T api python -m app.scripts.mint_token | tr -d '\r'

# --- WordPress opcional ---
wp-up:
	docker compose -f docker-compose.wp.yml up -d
wp-down:
	docker compose -f docker-compose.wp.yml down -v --remove-orphans

# --- Web (dev) ---
web:         ## Vite dev
	cd web && npm install && npm run dev

# --- Smokes ---
smoke:       ## Smoke end-to-end (usa TOKEN gerado)
	TOKEN=$$(docker compose exec -T api python -m app.scripts.mint_token | tr -d '\r') \
	bash scripts/smoke_rbac.sh --api http://localhost:8000 --store-name "Loja RBAC" --feed docs/seed/demo_feed.xml --quiet

# --- Reset total + boot ---
reset:       ## Down + (opcional prune) + up + migrate + seed + smoke
	PRUNE_ALL=false SMOKE=true API_BASE=http://localhost:8000 bash ops/reset_and_boot.sh
