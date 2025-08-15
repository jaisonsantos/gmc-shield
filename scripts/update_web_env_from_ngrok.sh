#!/usr/bin/env bash
set -euo pipefail

# Requer ngrok rodando e o jq instalado (brew install jq)
if ! command -v jq >/dev/null 2>&1; then
  echo "Erro: 'jq' não encontrado. Instale com: brew install jq"
  exit 1
fi

API_URL=$(curl -s http://127.0.0.1:4040/api/tunnels | jq -r '.tunnels[] | select(.config.addr=="http://localhost:8000") | .public_url')
WEB_HOST=$(curl -s http://127.0.0.1:4040/api/tunnels | jq -r '.tunnels[] | select(.config.addr=="http://localhost:5173") | .public_url' | sed -E 's#https?://##')

if [[ -z "$API_URL" || -z "$WEB_HOST" ]]; then
  echo "Não achei túneis ativos em 4040. Certifique-se de rodar: ngrok start api web --config ~/.config/ngrok/ngrok.yml"
  exit 1
fi

cat > web/.env.local <<EOF
VITE_API_BASE=$API_URL
VITE_ALLOWED_HOSTS=$WEB_HOST
VITE_HMR_HOST=$WEB_HOST
EOF

echo "Atualizado web/.env.local:"
cat web/.env.local

