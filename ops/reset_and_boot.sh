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

  echo "▶ Subindo base…"
  docker compose up -d --build

  echo "▶ Aguardando serviços…"
  docker compose ps
  sleep 2

  echo "▶ Rodando migrações Alembic…"
  docker compose exec -T api alembic upgrade head

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

Dica ngrok (UI):
  ngrok http http://localhost:5173

Como o backend já aceita:
  ALLOWED_ORIGINS="$ALLOWED_ORIGINS"
  ALLOWED_ORIGIN_REGEX="$ALLOWED_ORIGIN_REGEX"
não precisa editar a API ao trocar o domínio do ngrok.

EOF
}

confirm && main
