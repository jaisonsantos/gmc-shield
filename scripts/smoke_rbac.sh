#!/usr/bin/env bash
set -euo pipefail

# --------- Flags ----------
API="${API:-http://localhost:8000}"
STORE_NAME="${STORE_NAME:-Loja RBAC}"
FEED="${FEED:-docs/seed/demo_feed.xml}"
LIMIT="${LIMIT:-50}"
RECRAWL="${RECRAWL:-false}"
EMAIL="${EMAIL:-owner@gmcshield.dev}"
PASSWORD="${PASSWORD:-demo}"     # hoje o login aceita qualquer senha; deixei por simetria
QUIET="${QUIET:-false}"

usage() {
  cat <<EOF
Uso: $0 [--api URL] [--store-name NOME] [--feed PATH] [--limit N] [--recrawl true|false] [--email E] [--password P] [--quiet]
Ex.: $0 --api http://localhost:8000 --store-name "Loja Beta ES" --feed docs/seed/demo_feed.xml
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
    --email) EMAIL="$2"; shift 2;;
    --password) PASSWORD="$2"; shift 2;;
    --quiet) QUIET="true"; shift 1;;
    -h|--help) usage;;
    *) echo "Opção desconhecida: $1"; usage;;
  esac
done

# --------- UI ----------
if [[ -t 1 ]]; then
  C_RESET="\033[0m"; C_OK="\033[32m"; C_INFO="\033[36m"; C_ERR="\033[31m"; C_BOLD="\033[1m"
else
  C_RESET=""; C_OK=""; C_INFO=""; C_ERR=""; C_BOLD=""
fi
log() { [[ "$QUIET" == "true" ]] || echo -e "${C_INFO}▶${C_RESET} $*"; }
ok()  { [[ "$QUIET" == "true" ]] || echo -e "${C_OK}✓${C_RESET} $*"; }
err() { echo -e "${C_ERR}✗${C_RESET} $*" 1>&2; }

# jq opcional
JQ=""; command -v jq >/dev/null 2>&1 && JQ="jq -r"

log "${C_BOLD}API:${C_RESET} $API"
log "${C_BOLD}Store:${C_RESET} $STORE_NAME"
log "${C_BOLD}Feed:${C_RESET} $FEED"

# --------- 0) /healthz ----------
HEALTH=$(curl -s -m 3 "$API/healthz" || true)
if command -v jq >/dev/null 2>&1; then
  echo "$HEALTH" | jq -e '.ok==true' >/dev/null 2>&1 || { err "API respondeu: $HEALTH"; exit 1; }
else
  [[ "$HEALTH" == *'"ok":true'* || "$HEALTH" == *'"ok": true'* ]] || { err "API respondeu: $HEALTH"; exit 1; }
fi
ok "API ok"

# --------- 1) Login (tenta real; se houver TOKEN no env, usa fallback) ----------
if [[ -n "${TOKEN:-}" ]]; then
  ok "Usando TOKEN fornecido no ambiente"
else
  RESP_LOGIN=$(curl -s -X POST "$API/api/auth/login" -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" || true)
  TOKEN=$(echo "$RESP_LOGIN" | { $JQ '.access_token' 2>/dev/null || true; })
  TOKEN="${TOKEN//\"/}"
  if [[ -z "${TOKEN:-}" || "$TOKEN" == "null" ]]; then
    err "Falha no login. Resposta: $RESP_LOGIN"
    echo "Dica: verifique seed de usuários e SECRET_KEY."
    exit 1
  fi
  ok "Login ok (token obtido)"
fi
AUTH=(-H "Authorization: Bearer $TOKEN")

# --------- 2) Criar loja ----------
PAYLOAD_CREATE=$(cat <<JSON
{ "name":"$STORE_NAME", "platform":"woocommerce", "base_url":"http://localhost",
  "country":"ES", "currency":"EUR", "contact_email":"admin@example.com" }
JSON
)
RESP_CREATE=$(curl -s -X POST "$API/api/stores" "${AUTH[@]}" -H "Content-Type: application/json" -d "$PAYLOAD_CREATE")
STORE_ID=$(echo "$RESP_CREATE" | sed -n 's/.*"id":\s*\([0-9]*\).*/\1/p')
[[ -n "$STORE_ID" ]] || { err "Falha ao criar loja. Resposta: $RESP_CREATE"; exit 1; }
ok "Loja criada (id=$STORE_ID)"

# --------- 3) Configurar feed ----------
FEED_PAYLOAD=$(cat <<JSON
{ "source_type": "file", "url": "$FEED", "format": "${FEED##*.}" }
JSON
)
curl -s -X POST "$API/api/stores/$STORE_ID/feed" "${AUTH[@]}" -H "Content-Type: application/json" -d "$FEED_PAYLOAD" >/dev/null
ok "Feed configurado"

# --------- 4) Primeiro scan ----------
curl -s -X POST "$API/api/stores/$STORE_ID/scan" "${AUTH[@]}" -H "Content-Type: application/json" \
  -d "{\"limit_items\":$LIMIT,\"recrawl\":$RECRAWL}" >/dev/null
ok "Scan enfileirado"

# --------- 5) Violações ----------
VIOL=$(curl -s "$API/api/stores/$STORE_ID/violations" "${AUTH[@]}")
[[ -n "$JQ" ]] && echo "$VIOL" | $JQ '.' || echo "$VIOL"
ok "Violações listadas"

# --------- 6) Bloqueio (exemplo) ----------
BLOCK=$(curl -s -X POST "$API/api/stores/$STORE_ID/blocks" "${AUTH[@]}" -H "Content-Type: application/json" \
  -d '{"feed_item_id":"SKU-001"}')
[[ -n "$JQ" ]] && echo "$BLOCK" | $JQ '.' || echo "$BLOCK"
ok "Item bloqueado"

# --------- 7) Overview ----------
OV=$(curl -s "$API/api/stores/$STORE_ID/overview" "${AUTH[@]}")
[[ -n "$JQ" ]] && echo "$OV" | $JQ '.' || echo "$OV"
ok "Overview ok"

echo -e "${C_BOLD}Fim.${C_RESET} Abra ${C_BOLD}$API/docs${C_RESET}."
