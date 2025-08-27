#!/usr/bin/env bash
set -euo pipefail

# deprecated: local dev defaults to localhost.
# if you really need a public tunnel, set NGROK_URL explicitly
# and this script will update web/.env.local accordingly.

ROOT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT_DIR"

if [[ -z "${NGROK_URL:-}" ]]; then
  echo "NGROK_URL not set; nothing to do."
  exit 0
fi

ENV_PATH="web/.env.local"
printf "VITE_API_BASE=%s\nVITE_ALLOWED_HOSTS=\nVITE_HMR_HOST=\n" "$NGROK_URL" > "$ENV_PATH"

echo "✓ Updated $ENV_PATH with NGROK_URL"
