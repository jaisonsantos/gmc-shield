#!/usr/bin/env bash
set -euo pipefail

# Sempre inicializa o array; vazio quando não houver token
declare -a AUTH_HEADER=()

# ---------- CLI FLAGS ----------
API="http://localhost:8000"
STORE_NAME="Loja Demo GMC Shield"
FEED="docs/seed/demo_feed.xml"
LIMIT=50
RECRAWL="false"
QUIET="false"

usage() {
  cat <<EOF
Usage: $0 [options]

Options:
  --api URL               API base (default: $API)
  --store-name NAME       Store name (default: "$STORE_NAME")
  --feed PATH             Feed path or URL (default: $FEED)
  --limit N               Items limit for first scan (default: $LIMIT)
  --recrawl true|false    Force recrawl (default: $RECRAWL)
  --quiet                 Less output
  -h, --help              Show this help
EOF
  exit 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --api) API="$2"; shift 2;;
    --store-name) STORE_NAME="$2"; shift 2;;
    --feed) FEED="$2"; shift 2;;
    --limit) LIMIT="$2"; shift 2;;
    --recrawl) RECRAWL="$2"; shift 2;;
    --quiet) QUIET="true"; shift 1;;
    -h|--help) usage;;
    *) echo "Unknown option: $1"; usage;;
  esac
done

# ---------- Colors ----------
if [[ -t 1 ]]; then
  C_RESET="\033[0m"; C_DIM="\033[2m"; C_OK="\033[32m"; C_INFO="\033[36m"; C_ERR="\033[31m"; C_BOLD="\033[1m"
else
  C_RESET=""; C_DIM=""; C_OK=""; C_INFO=""; C_ERR=""; C_BOLD=""
fi
log() { [[ "$QUIET" == "true" ]] || echo -e "${C_INFO}▶${C_RESET} $*"; }
ok()  { [[ "$QUIET" == "true" ]] || echo -e "${C_OK}✓${C_RESET} $*"; }
err() { echo -e "${C_ERR}✗${C_RESET} $*" 1>&2; }

JQ=""
if command -v jq >/dev/null 2>&1; then JQ="jq -r"; fi

log "${C_BOLD}API:${C_RESET} $API"
log "${C_BOLD}Store:${C_RESET} $STORE_NAME"
log "${C_BOLD}Feed:${C_RESET} $FEED"

# ---------- Optional auth ----------
TOKEN=$(curl -s -X POST "$API/api/auth/login" -H "Content-Type: application/json" \
  -d '{"email":"demo@gmcshield.local","password":"demo"}' | sed -n 's/.*"access_token":"\([^"]*\)".*/\1/p') || true
AUTH_HEADER=()
[[ -n "${TOKEN:-}" ]] && AUTH_HEADER=(-H "Authorization: Bearer $TOKEN")

# ---------- 1) Create store ----------
log "Criando loja…"
CREATE_PAYLOAD=$(cat <<JSON
{ "name":"$STORE_NAME", "platform":"woocommerce", "base_url":"http://localhost", "country":"ES", "currency":"EUR", "contact_email":"admin@example.com" }
JSON
)
RESP=$(curl -s -X POST "$API/api/stores" ${AUTH_HEADER:+${AUTH_HEADER[@]}} -H "Content-Type: application/json" -d "$CREATE_PAYLOAD")
STORE_ID=$(echo "$RESP" | sed -n 's/.*"id":\s*\([0-9]*\).*/\1/p')
[[ -n "$STORE_ID" ]] || { err "Falha ao criar loja: $RESP"; exit 1; }
ok "Loja criada (id=$STORE_ID)"

# ---------- 2) Configure feed ----------
log "Configurando feed…"
FEED_PAYLOAD=$(cat <<JSON
{ "source_type": "file", "url": "$FEED", "format": "${FEED##*.}" }
JSON
)
curl -s -X POST "$API/api/stores/$STORE_ID/feed" ${AUTH_HEADER:+${AUTH_HEADER[@]}} -H "Content-Type: application/json" -d "$FEED_PAYLOAD" > /dev/null
ok "Feed configurado"

# ---------- 3) First scan ----------
log "Rodando Primeiro Diagnóstico (limit=$LIMIT, recrawl=$RECRAWL)…"
curl -s -X POST "$API/api/stores/$STORE_ID/scan" ${AUTH_HEADER:+${AUTH_HEADER[@]}} -H "Content-Type: application/json" \
  -d "{\"limit_items\":$LIMIT,\"recrawl\":$RECRAWL}" > /dev/null
ok "Scan enfileirado"

# ---------- 4) Violations ----------
log "Buscando violações…"
VIOL=$(curl -s "$API/api/stores/$STORE_ID/violations" ${AUTH_HEADER:+${AUTH_HEADER[@]}})
[[ -n "$JQ" ]] && echo "$VIOL" | $JQ '.' || echo "$VIOL"
ok "Violações listadas"

# ---------- 5) Block a sample item ----------
log "Bloqueando SKU-001…"
BLOCK=$(curl -s -X POST "$API/api/stores/$STORE_ID/blocks" ${AUTH_HEADER:+${AUTH_HEADER[@]}} -H "Content-Type: application/json" -d '{"feed_item_id":"SKU-001"}')
[[ -n "$JQ" ]] && echo "$BLOCK" | $JQ '.' || echo "$BLOCK"
ok "Item bloqueado"

echo -e "${C_BOLD}Fim!${C_RESET} Abra ${C_BOLD}$API/docs${C_RESET} e navegue na UI em ${C_BOLD}http://localhost:5173${C_RESET}."
