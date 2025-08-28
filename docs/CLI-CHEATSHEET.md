# GMC Shield – CLI Cheatsheet (API + RBAC dev)

Use este guia rápido para testar a API localmente, gerar tokens, rodar o smoke test e depurar problemas comuns.

> Por padrão tudo roda em `localhost`. Se precisar acessar de fora, abra um túnel manual (ex.: `ngrok http http://localhost:8000`).

> Convenções:
>
> - **api** = container FastAPI (`gmc-shield-api-1`)
> - **db** = container Postgres (`gmc-shield-db-1`)
> - Base URL padrão: `http://localhost:8000`
> - Rotas v1 usam prefixo `/api/v1` (aliases legados em `/api` continuam)

---

## 0) Verificar containers e saúde

```bash
docker compose ps
curl http://localhost:8000/healthz   # deve responder {"ok":true}
```

---

## 1) Gerar JWT no container (sem passar pelo /login)

Script em `api/scripts/mint_token.py` (o volume da pasta `api/` monta em `/app` dentro do container).

### Gerar o token e guardar em `TOKEN`

```bash
# gera o token dentro do container (usa SECRET_KEY do container)
TOKEN=$(docker compose exec -T api python /app/scripts/mint_token.py | tr -d '
')
echo "${TOKEN:0:32}..."
```

### Teste rápido com o token

```bash
curl -H "Authorization: Bearer $TOKEN"   http://localhost:8000/api/v1/stores/3/violations
```

> Dica: o script `mint_token.py` usa por padrão:
>
> - EMAIL=`owner@gmcshield.dev`
> - ROLE=`owner`
> - ACCOUNT_ID=`1`
> - SECRET_KEY obtida do container (variável de ambiente).  
>   Para trocar temporariamente:  
>   `docker compose exec -T api bash -lc 'EMAIL=foo@bar.dev ROLE=owner ACCOUNT_ID=1 python /app/scripts/mint_token.py'`

---

## 2) Smoke test completo (RBAC)

O script aceita `TOKEN` vindo do ambiente. Se não houver, ele tenta fazer login (em dev o recomendado é passar o token).

### Modo recomendado (com TOKEN)

```bash
# gera o token dentro do container e passa pro script
TOKEN=$(docker compose exec -T api python /scripts/mint_token.py | tr -d '
') bash scripts/smoke_rbac.sh   --api http://localhost:8000   --store-name "Loja RBAC"   --feed docs/seed/demo_feed.xml
```

### Alternativa em duas linhas

```bash
TOKEN=$(docker compose exec -T api python /app/scripts/mint_token.py | tr -d '
')
bash scripts/smoke_rbac.sh --api http://localhost:8000 --store-name "Loja RBAC" --feed docs/seed/demo_feed.xml
```

Saída esperada (resumida): criação de loja, configuração do feed, scan enfileirado, lista de violações, bloqueio de item e overview.

---

## 3) Sequência manual de chamadas (com TOKEN)

> Substitua `STORE_ID` quando necessário.

```bash
# 3.1 Criar loja
curl -X POST http://localhost:8000/api/v1/stores   -H "Authorization: Bearer $TOKEN"   -H "Content-Type: application/json"   -d '{"name":"Loja RBAC","platform":"woocommerce","base_url":"http://localhost","country":"ES","currency":"EUR","contact_email":"admin@example.com"}'

# 3.2 Configurar feed
curl -X POST http://localhost:8000/api/v1/stores/STORE_ID/feed   -H "Authorization: Bearer $TOKEN"   -H "Content-Type: application/json"   -d '{"source_type":"file","url":"docs/seed/demo_feed.xml","format":"xml"}'

# 3.2b Enviar feed (upload)
curl -H "Authorization: Bearer $TOKEN" \
  -F format=csv -F file=@docs/seed/demo_feed.csv \
  http://localhost:8000/api/v1/stores/STORE_ID/feeds/ingest   # arquivo

curl -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com/feed.csv","format":"csv"}' \
  http://localhost:8000/api/v1/stores/STORE_ID/feeds/ingest   # URL (canonicalize_link)

# opcional: enfileirar ingestão
curl -H "Authorization: Bearer $TOKEN" \
  -F format=csv -F file=@docs/seed/demo_feed.csv \
  "http://localhost:8000/api/v1/stores/STORE_ID/feeds/ingest?async=true"
# worker RQ
docker compose up -d rq-feed

# checar hash e contagem
docker compose exec -T db psql -U postgres -d gmc_shield \
  -c "select id,last_hash,last_item_count,created_at from feeds where store_id=STORE_ID;"

# 3.3 Disparar scan
curl -X POST http://localhost:8000/api/v1/stores/STORE_ID/scan   -H "Authorization: Bearer $TOKEN"   -H "Content-Type: application/json"   -d '{"limit_items":50,"recrawl":false}'

# 3.4 Listar violações
curl http://localhost:8000/api/v1/stores/STORE_ID/violations   -H "Authorization: Bearer $TOKEN"

# 3.5 Bloquear item
curl -X POST http://localhost:8000/api/v1/stores/STORE_ID/blocks   -H "Authorization: Bearer $TOKEN"   -H "Content-Type: application/json"   -d '{"feed_item_id":"SKU-001"}'

# 3.6 Overview
curl http://localhost:8000/api/v1/stores/STORE_ID/overview   -H "Authorization: Bearer $TOKEN"

# 3.7 Outras rotas úteis
curl http://localhost:8000/api/v1/stores/STORE_ID/feeds/versions -H "Authorization: Bearer $TOKEN"
curl http://localhost:8000/api/v1/stores/STORE_ID/notifications -H "Authorization: Bearer $TOKEN"
```

---

## 4) Ajuda rápida no banco (psql)

### Conferir contas

```bash
docker compose exec -T db psql -U postgres -d gmc_shield -c "select id,name,type from accounts;"
```

### Garantir usuário OWNER vinculado à conta 1

```bash
docker compose exec -T db psql -U postgres -d gmc_shield -c "INSERT INTO users (account_id,email,password_hash,role)
 VALUES (1,'owner@gmcshield.dev','x','owner')
 ON CONFLICT (email) DO UPDATE SET account_id=EXCLUDED.account_id, role=EXCLUDED.role
 RETURNING id,email,role,account_id;"
```

> Observação: para desenvolvimento, estamos evitando o fluxo de `/login` e usando JWT “mintado” manualmente (se precisar senha real, gere hash bcrypt e atualize `password_hash`).

---

## 5) Troubleshooting

### 401 Unauthorized

- Token expirado ou **SECRET_KEY** divergente.
- Gere novo token **dentro do container**: `docker compose exec -T api python /app/scripts/mint_token.py | tr -d '
'`
- Confira a chave no container (dev):  
  `docker compose exec -T api env | grep SECRET_KEY`  
  Se alterar a `SECRET_KEY` no `.env`/compose, **recrie a API**.

### 422 no /login com e-mail “.local/.test”

- O validador de e-mail (Pydantic) pode bloquear domínios especiais.
- Use `owner@gmcshield.dev` (ou outro domínio válido) **ou** siga com token mintado (recomendado em dev).

### API saudável mas script falha logo no login

- Prefira setar o TOKEN no ambiente e rodar o script (modo recomendado acima).
- Cheque se a hora do host e do container estão corretas (JWT depende do relógio).

### Reciclar a API

```bash
docker compose restart api
docker compose logs -f --tail=200 api
```

---

## 6) Docs interativos (Swagger)

```bash
open http://localhost:8000/docs   # macOS
# ou apenas acesse no navegador
```

---

## 7) Anexos

### `api/scripts/mint_token.py` (referência)

```python
import os, datetime
from jose import jwt

EMAIL = os.getenv("EMAIL", "owner@gmcshield.dev")
ROLE = os.getenv("ROLE", "owner")
ACCOUNT_ID = int(os.getenv("ACCOUNT_ID", "1"))
SECRET_KEY = os.getenv("SECRET_KEY", "change_me")

payload = {
    "sub": EMAIL,
    "role": ROLE,
    "account_id": ACCOUNT_ID,
    "iat": datetime.datetime.utcnow(),
    "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=12),
}
print(jwt.encode(payload, SECRET_KEY, algorithm="HS256"))
```

## D2 Crawler

Suba o worker de crawling:

```bash
docker compose up -d rq-crawl
```

Dispare um scan de até 20 itens:

```bash
TOKEN=...; API=http://localhost:8000; STORE_ID=1
curl -X POST "$API/api/v1/stores/$STORE_ID/scan" \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"limit_items":20}'
```

Artefatos ficam em `api/artifacts/store{STORE_ID}/runs/{RUN_ID}/items/{ITEM_ID}/{ua}/`.

Listar snapshots do run:

```bash
curl "$API/api/v1/stores/$STORE_ID/runs/$RUN_ID/snapshots" \
     -H "Authorization: Bearer $TOKEN"
```

---

## 8) Login com Google (OIDC)

Para testar o fluxo de login com Google em desenvolvimento, configure as variáveis no `.env`:

```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:8000/api/auth/google/callback
# Endpoints customizados para testes offline
GOOGLE_AUTH_ENDPOINT=http://localhost:9999/auth
GOOGLE_TOKEN_ENDPOINT=http://localhost:9999/token
GOOGLE_USERINFO_ENDPOINT=http://localhost:9999/userinfo
```

Inicie o fluxo:

```
curl "http://localhost:8000/api/auth/google/start" | jq
```

Nos testes, use `respx` para mockar os endpoints configurados acima.
