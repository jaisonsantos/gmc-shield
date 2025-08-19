#!/usr/bin/env bash
set -euo pipefail

command -v jq >/dev/null 2>&1 || { echo "Precisa do jq (brew install jq)"; exit 1; }

# One-click: conecta a loja do SaaS ao WordPress local.
# Uso:
#   scripts/wp_connect.sh <STORE_ID> <WP_API_BASE> <WP_BASE_URL> [WP_USER] [WP_APP_PASSWORD]
# Exemplo:
#   scripts/wp_connect.sh 5 http://host.docker.internal:8080/wp-json http://localhost:8080 admin "xxxx xxxx xxxx ..."

if [[ "${1:-}" == "" || "${2:-}" == "" || "${3:-}" == "" ]]; then
  echo "Uso: $0 <STORE_ID> <WP_API_BASE> <WP_BASE_URL> [WP_USER] [WP_APP_PASSWORD]" >&2
  exit 64
fi

STORE_ID="$1"
WP_API_BASE="$2"
WP_BASE_URL="$3"
WP_USER="${4:-admin}"
WP_APP_PASSWORD="${5:-}"

if [[ -z "${TOKEN:-}" ]]; then
  echo "Gerando TOKEN (account_id=1)…"
  TOKEN="$(docker compose exec -T api python - <<'PY'
from app.auth import create_token
print(create_token("owner@gmcshield.dev","owner",1))
PY
)"
fi

curl -sf -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/auth/whoami >/dev/null \
  || { echo "Falha no token (401?). Gere novamente."; exit 1; }

echo "Enviando credenciais para store ${STORE_ID}…"
curl -sS -X POST "http://localhost:8000/api/stores/${STORE_ID}/wp/credentials" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "$(jq -n \
        --arg api "$WP_API_BASE" \
        --arg base "$WP_BASE_URL" \
        --arg user "$WP_USER" \
        --arg pass "$WP_APP_PASSWORD" \
        '{wp_api_base:$api, wp_base_url:$base, wp_user:$user, wp_app_password:$pass}')"

echo
echo "Status atual:"
curl -sS -H "Authorization: Bearer $TOKEN" "http://localhost:8000/api/stores/${STORE_ID}/wp/status" | jq .
echo "✔ Concluído."
