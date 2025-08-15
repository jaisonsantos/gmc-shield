#!/usr/bin/env bash
set -euo pipefail

# entra na raiz do repo (independente de onde você chamou)
cd "$(dirname "$0")/.."

echo "==> Down + prune…"
docker compose down -v --remove-orphans || true
docker compose -f docker-compose.wp.yml down -v || true
docker system prune -f
docker builder prune -f || true

echo "==> Build das imagens…"
docker compose build api worker

echo "==> Sobe db + redis e espera ficarem saudáveis…"
docker compose up -d db redis

echo "==> Esperando DB…"
until docker compose exec -T db pg_isready -U postgres -d gmc_shield >/dev/null 2>&1; do
  sleep 1
done

echo "==> Esperando Redis…"
until docker compose exec -T redis redis-cli ping >/dev/null 2>&1; do
  sleep 1
done

echo "==> Sobe API + Worker…"
docker compose up -d api worker

echo "==> Migrações Alembic…"
docker compose run --rm api alembic upgrade head

echo "==> Seed de usuários (owner/manager/viewer @ demo)…"
docker compose exec -T api python -m app.scripts.seed_users || true

echo "==> Smoke rápido…"
curl -sf http://localhost:8000/healthz && echo "healthz OK"

echo
echo "✅ Pronto. Frontend:"
echo "  cd web && npm i && printf 'VITE_API_BASE=http://localhost:8000\n' > .env.local && npm run dev -- --host"
echo
echo "ℹ️ Log da API:  docker compose logs -f api"
echo "ℹ️ Health worker: curl -s http://localhost:8000/api/ops/worker/health | jq ."
