# GMC-SHIELD – Runbook de Desenvolvimento

> Guia rápido para subir/derrubar o stack, logar, rodar smoke tests e resolver pepinos.

## Stack (quem é quem)

- **API (FastAPI)**: porta `8000`. Rotas `/api/...`, JWT + RBAC.
- **DB (Postgres 15)**: porta `5432` (só interna ao docker).
- **Redis**: fila/cache (porta `6379`).
- **Worker**: (prototipo) vai processar scans — conectar no Passo 4 do roadmap.
- **Web (Vite/React)**: porta `5173` (dev).
- **WP opcional**: `docker-compose.wp.yml` (WordPress 8080 + phpMyAdmin 8081) para testar o plugin.

> Ambiente pensado para `localhost`. Para acesso externo, use um túnel (ex.: `ngrok`) e ajuste as variáveis manualmente.

## Pré-requisitos

- Docker Desktop atualizado
- Node 18+ (para `web/`)
- `make`, `curl` e (opcional) `jq` instalados

## Primeira vez (setup)

```bash
# 1) Subir containers base
make up

# 2) Rodar migrações
make migrate

# 3) Seed de usuários (owner/manager/viewer) com senha "demo"
make seed

# 4) (Opcional) Subir WordPress para testar plugin
make wp-up

# 5) Web dev (em outro terminal)
make web
```

## Feeds v1 — Idempotência & Erros

- Ingestões repetidas retornam `duplicate: true` e `items_imported=0` quando o `content_hash` já existe.
- Se ocorrer violação de `UNIQUE(feed_id, content_hash)`, revise o arquivo ou remova a versão duplicada antes de reenfileirar.
