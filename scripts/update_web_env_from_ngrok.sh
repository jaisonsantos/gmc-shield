#!/usr/bin/env bash
set -euo pipefail

# DEBUG=1 ativa trace
if [[ "${DEBUG:-0}" == "1" ]]; then set -x; fi

# 1) Garante que estamos na raiz do repo (para escrever em web/.env.local certo)
ROOT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT_DIR"

echo "→ Raiz do repo: $PWD"

# 2) Pre-reqs
if ! command -v jq >/dev/null 2>&1; then
  echo "Erro: 'jq' não encontrado. Instale com: brew install jq"
  exit 1
fi

# 3) Confere API do ngrok
if ! curl -sSf http://127.0.0.1:4040/api/tunnels >/dev/null 2>&1; then
  echo "Erro: API do ngrok não está respondendo em http://127.0.0.1:4040."
  echo "Dica: ngrok start api web --config ~/.config/ngrok/ngrok.yml"
  exit 1
fi

# 4) Busca URLs (primeiro por nome do túnel, depois por porta como fallback)
JSON="$(curl -s http://127.0.0.1:4040/api/tunnels)"
API_URL="$(printf '%s' "$JSON" | jq -r '.tunnels[] | select(.name=="api") | .public_url')"
WEB_HOST="$(printf '%s' "$JSON" | jq -r '.tunnels[] | select(.name=="web") | .public_url' | sed -E 's#https?://##')"

if [[ -z "${API_URL}" || -z "${WEB_HOST}" ]]; then
  API_URL="$(printf '%s' "$JSON" | jq -r '.tunnels[] | select(.config.addr|test("(:|//)(localhost|127\\.0\\.0\\.1):8000$")) | .public_url')"
  WEB_HOST="$(printf '%s' "$JSON" | jq -r '.tunnels[] | select(.config.addr|test("(:|//)(localhost|127\\.0\\.0\\.1):5173$")) | .public_url' | sed -E 's#https?://##')"
fi

if [[ -z "$API_URL" || -z "$WEB_HOST" ]]; then
  echo "Não achei túneis 'api' e 'web'. Saída do ngrok:"
  printf '%s\n' "$JSON" | jq .
  exit 1
fi

echo "→ Detectado:"
echo "   API_URL  = $API_URL"
echo "   WEB_HOST = $WEB_HOST"

# 5) Escreve web/.env.local
ENV_PATH="web/.env.local"
printf "VITE_API_BASE=%s\nVITE_ALLOWED_HOSTS=%s\nVITE_HMR_HOST=%s\n" \
  "$API_URL" "$WEB_HOST" "$WEB_HOST" > "$ENV_PATH"

echo "✓ Atualizado $ENV_PATH:"
cat "$ENV_PATH"
