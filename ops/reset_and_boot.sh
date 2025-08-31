# ops/reset_and_boot.sh

#!/usr/bin/env bash
set -euo pipefail

# Carrega o arquivo .env, se existir
if [ -f .env ]; then
    set -a  # Exporta automaticamente todas as variáveis definidas
    source .env
    set +a
else
    echo "Erro: Arquivo .env não encontrado!"
    exit 1
fi

# flags
PRUNE_ALL="${PRUNE_ALL:-false}"  # true => docker system prune -a --volumes
SMOKE="${SMOKE:-true}"           # true => roda smoke ao final
API_BASE="${API_BASE:-http://localhost:8000}"

confirm() {
  read -r -p "Isso vai derrubar containers e apagar volumes do compose. Continuar? [y/N] " ans
  [[ "${ans:-N}" =~ ^[yY]$ ]]
}

main() {
  echo "▶ Resetando ambiente…"
  docker compose down -v --remove-orphans || true

  if [[ "$PRUNE_ALL" == "true" ]]; then
    echo "▶ docker system prune -a --volumes"
    docker system prune -a --volumes -f
  fi

  echo "▶ Subindo db + redis…"
  docker compose up -d --build db redis

  echo "▶ Aguardando saúde do DB e Redis…"
  # wait DB
  db_id=$(docker compose ps -q db)
  if [ -z "$db_id" ]; then echo "Erro: container do DB não encontrado"; docker compose ps; exit 1; fi
  max_wait=60; count=0
  while [ "$(docker inspect -f '{{.State.Health.Status}}' "$db_id" 2>/dev/null)" != "healthy" ]; do
    if [ $count -gt $max_wait ]; then
      echo "Erro: DB não ficou saudável em $max_wait s"; docker compose logs db; exit 1
    fi
    sleep 1; count=$((count+1))
  done
  # wait Redis
  redis_id=$(docker compose ps -q redis)
  if [ -z "$redis_id" ]; then echo "Erro: container do Redis não encontrado"; docker compose ps; exit 1; fi
  max_wait_r=30; count_r=0
  while [ "$(docker inspect -f '{{.State.Health.Status}}' "$redis_id" 2>/dev/null)" != "healthy" ]; do
    if [ $count_r -gt $max_wait_r ]; then
      echo "Erro: Redis não ficou saudável em $max_wait_r s"; docker compose logs redis; exit 1
    fi
    sleep 1; count_r=$((count_r+1))
  done

  echo "▶ Rodando migrações Alembic (run --rm)…"
  docker compose run --rm api alembic upgrade head

  echo "▶ Subindo API + Workers…"
  docker compose up -d api worker rq-feed

  echo "▶ Seed de usuários…"
  docker compose exec -T api python -m app.scripts.seed_users

  echo "▶ Checando API /healthz…"
  curl -s "$API_BASE/healthz" | grep -q '"ok":' && echo "ok"

  if [[ "$SMOKE" == "true" ]]; then
    echo "▶ Smoke RBAC…"
    TOKEN=$(docker compose exec -T api python -m app.scripts.mint_token | tr -d '\r')
    API="$API_BASE" TOKEN="$TOKEN" ./scripts/smoke_rbac.sh --quiet || true
  fi

  cat <<EOF

✓ Ambiente pronto (api, worker e rq-feed em execução).

- API:      $API_BASE/docs
- UI (dev): http://localhost:5173   (rode 'make web' em outro terminal)
- Ops:      http://localhost:5173/ops (após logar)

# se precisar compartilhar o frontend, use um túnel manual (ex.: ngrok)
#   ngrok http http://localhost:5173

EOF
}

confirm && main
