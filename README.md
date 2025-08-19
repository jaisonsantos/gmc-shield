- seção de **FERNET_KEY + rotação (FERNET_KEYS)**
- fluxo “**WP integração**” passo-a-passo (inclui script `scripts/wp_connect.sh`, App Password, dicas de `host.docker.internal`)
- ajustes de variáveis de ambiente e troubleshooting prático

Substitua o conteúdo de `README.md` por este:

```markdown
# GMC Shield — MVP (SaaS + Plugin WooCommerce) para Prevenção de Suspensões no Google Merchant Center

> **GMC Shield** é um SaaS + Plugin (WooCommerce primeiro) que detecta causas de suspensão (especialmente _Misrepresentation_) no **Google Merchant Center**, previne novos bloqueios e gera o **pacote de apelação** com evidências.  
> Este repositório contém o **esqueleto funcional** do MVP, o **backlog executável** e **seeds** para demo.

---

## Sumário

- Visão do Produto
- Arquitetura & Serviços
- Começando Rápido (Docker)
- Dev Local (sem Docker)
- Variáveis de Ambiente
- Banco & Migrações
- Seeds & Demo de 10 minutos
- Fluxos do MVP
- API & Endpoints
- Plugin WooCommerce
  - Integração WordPress (passo a passo)
- UI Web
- Backlog D0–D30 (issues)
- Critérios de Aceite do MVP
- Roadmap D0–D30
- Testes & Qualidade
- Troubleshooting

---

## Visão do Produto

**Módulos chave do MVP:**

1. **Feed Ingestor**: importa XML/CSV/TSV, normaliza preço/moeda, versiona por hash.
2. **Crawler “como o Google vê”** _(sprint)_: Playwright (UA Googlebot e Chrome), coleta HTML/screenshot/redirects/JSON-LD.
3. **Rules Engine (R1–R9)**: compara feed↔página e emite violações com evidências.
4. **Policy Generator (PT/ES)**: cria/publica páginas (Envio, Devolução/Contato/Termos) no WP via REST.
5. **Feed Guard**: bloqueio preventivo por item e/ou **supplemental feed**.
6. **Appeal Kit**: **PDF + ZIP + texto-base** de apelação.
7. **Painel SaaS**: overview, violações, itens, políticas, apelações, agência.
8. **Notificações**: e-mail/Slack (scan diário, novas violações).

---

## Arquitetura & Serviços
```

/api # FastAPI, SQLAlchemy/Alembic, rotas de exemplo (stubs)
/worker # RQ Worker (queues: feed, crawl, rules, reports, notify)
/web # React + Vite
/plugin-woo # Plugin WordPress (REST mínimo, metabox, coluna)
/infra # Dockerfiles, docker-compose, Makefile
/docs # OpenAPI, checklists, backlog, seeds, DEMO, Kanban
/scripts # utilitários (demo script, seed issues, wp_connect, etc.)

````

**Filas (RQ):** `feed`, `crawl`, `rules`, `reports`, `notify`
**Persistência:** Postgres (Docker), Redis (fila), storage local (MVP).

---

## Começando Rápido (Docker)

1. Copie `.env.example` → `.env`
2. Suba DB e Redis:
   ```bash
   docker compose up -d redis db
````

3. Migre o banco:

   ```bash
   docker compose run --rm api alembic upgrade head
   ```

4. Suba API + Worker:

   ```bash
   docker compose up -d api worker
   ```

5. UI (dev local):

   ```bash
   cd web && npm install && npm run dev
   ```

**Docs da API:** [http://localhost:8000/docs](http://localhost:8000/docs)

---

## Dev Local (sem Docker)

```bash
cd api
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Worker:

```bash
python -u ../worker/run_worker.py
```

---

## Variáveis de Ambiente

Veja `.env.example`. Principais:

- `DATABASE_URL` — Postgres
- `REDIS_URL` — Redis (RQ)
- `SECRET_KEY` — sessão/autenticação web
- `CORS_ORIGINS` — origens permitidas (ex.: `http://localhost:5173,http://localhost:4173`)
- `VITE_API` (lado do `web/`) — URL da API (ex.: `http://localhost:8000`)
- `FERNET_KEY` — **obrigatória** para criptografar segredos (ex.: App Password do WP)
- `FERNET_KEYS` — **opcional** (rotação de chaves, ver abaixo)
- `WP_VERIFY_TLS` — `true|false` (default `true`)
- `WP_TIMEOUT_SEC` — timeout de chamadas ao WP (default `10`)

### 🔐 Fernet (segredos) + Rotação de Chaves

Gere uma chave (32 bytes base64) e coloque no `.env`:

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Uso básico:

```env
FERNET_KEY=AAA_BASE64
```

Rotação sem downtime:

```env
# chave nova (primária) — usada para ENCRYPT
FERNET_KEY=NEW_BASE64
# todas aceitas para DECRYPT (nova + antigas, nessa ordem)
FERNET_KEYS=NEW_BASE64,OLD_BASE64
```

> Após alterar `.env`, reinicie a API:
>
> ```bash
> docker compose restart api
> ```

---

## Banco & Migrações

Alembic em `api/alembic/`.

```bash
docker compose run --rm api alembic revision --autogenerate -m "nova tabela"
```

---

## Seeds & Demo de 10 minutos

Em `docs/seed/`: `demo_store.json`, `demo_feed.xml` (60 itens) e `demo_feed.csv`.

Roteiro: `[docs/DEMO.md](docs/DEMO.md)` ou `bash scripts/demo.sh`.

Exemplo rápido de ingestão do feed via upload:

```bash
TOKEN=$(python scripts/mint_token.py)
API=http://localhost:8000
curl -H "Authorization: Bearer $TOKEN" \
  -F format=csv -F file=@docs/seed/demo_feed.csv \
  "$API/api/stores/1/feed/upload"
```

---

## Fluxos do MVP

Onboarding → Diagnóstico → Publicar Políticas → Bloqueios → Apelação → Notificações.

---

## API & Endpoints

Rotas: auth, stores, feeds, scan, violations (evidence), blocks, policies, appeals, notifications (ver `/docs`).

---

## Plugin WooCommerce

`plugin-woo/` com REST mínimo, bloqueio por SKU e página de settings.
Guia WP local: `docs/WP-LOCAL.md`.

### Integração WordPress (passo a passo)

> **Pré-requisitos**
>
> - `FERNET_KEY` configurada (ver seção acima)
> - WordPress local (vide `docker-compose.wp.yml`), permalinks em “Nome do post”
> - Application Password criada para o usuário admin

0. **GERAR FERNET** (se ainda não tiver) e reiniciar API:

```bash
echo "FERNET_KEY=$(python -c 'from cryptography.fernet import Fernet;print(Fernet.generate_key().decode())')" >> .env
docker compose restart api
```

1. **Subir WordPress local**:

```bash
docker compose -f docker-compose.wp.yml up -d
```

- Ative o plugin **GMC Shield** no WP Admin.
- Em **Configurações → Links permanentes**, selecione **Nome do post**.
- Em **Usuários → Perfil**, crie uma **Application Password** (ex.: `GMC Shield local`).

2. **Gerar TOKEN de API** (para a conta `account_id=1`):

```bash
TOKEN=$(docker compose exec -T api python - <<'PY'
from app.auth import create_token
print(create_token("owner@gmcshield.dev","owner",1))
PY
)
```

3. **Salvar credenciais do WP no backend**:

> **Dica (Docker Desktop no macOS/Windows):** Use `http://host.docker.internal:8080/wp-json` como `wp_api_base`.
> **Linux:** use o IP do host (ex.: `http://172.17.0.1:8080/wp-json`) ou configure `extra_hosts`.

```bash
STORE_ID=1
APP="xxxx xxxx xxxx xxxx xxxx xxxx"  # sua Application Password do WP

curl -X POST "http://localhost:8000/api/stores/$STORE_ID/wp/credentials" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "wp_api_base": "http://host.docker.internal:8080/wp-json",
    "wp_base_url": "http://localhost:8080",
    "wp_user": "admin",
    "wp_app_password": "'"$APP"'"
  }'
```

4. **Verificar status e publicar uma política**:

```bash
# status
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/api/stores/$STORE_ID/wp/status"

# publicar (ex.: refund)
curl -X POST "http://localhost:8000/api/stores/$STORE_ID/wp/policies/publish" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"type":"refund","content_md":"## Devolução em 30 dias","status":"publish"}'
```

5. **(Opcional) Script 1-click**
   Use `scripts/wp_connect.sh` para conectar rápido:

```bash
chmod +x scripts/wp_connect.sh
scripts/wp_connect.sh <STORE_ID> http://host.docker.internal:8080/wp-json http://localhost:8080 admin "xxxx xxxx xxxx ..."
```

---

## UI Web

React+Vite, páginas placeholder (Dashboard, Violations, Items, Policies, Appeals, etc.).

---

## Backlog D0–D30

- Índice: `docs/Backlog-D0-D30.md`
- Issues: `docs/issues/` (D0..D30, uma por entrega).
- Kanban GitHub: `docs/kanban/README.md` + `scripts/seed_issues_from_docs.py`.

---

## Critérios de Aceite do MVP

- 50+ produtos rastreados, 5+ tipos de violações com evidências.
- 3 políticas publicadas no WP (1 clique).
- Bloquear item do feed.
- PDF+ZIP+texto de apelação.
- Notificação diária.
- ≥1 reativação ou redução de warnings.

---

## Automação útil

- **Demo rápida**: `bash scripts/demo.sh`
- **Kanban**: `docs/kanban/README.md` + `scripts/seed_issues_from_docs.py`
- **WordPress local**: `docs/WP-LOCAL.md`

---

## Troubleshooting

- **401 Unauthorized** nas rotas da API
  → Regere o `TOKEN` (ele expira). Teste com `GET /api/auth/whoami`.

- **500 Internal Server Error: `FERNET_KEY not set`**
  → Falta `FERNET_KEY` no `.env`. Gere e `docker compose restart api`.

- **CORS bloqueando o frontend**
  → Ajuste `CORS_ORIGINS` no `.env` para incluir `http://localhost:5173` (e demais portas).

- **`wp_api_base deve apontar para /wp-json`**
  → Use um endpoint que termine exatamente em `/wp-json`.

- **WP dentro do Docker no macOS/Windows**
  → Use `http://host.docker.internal:8080` para o WordPress.

**Preview do Frontend:** veja `docs/PREVIEW.md` e o workflow `.github/workflows/web-preview.yml`. Para Vercel, use `vercel.json` (root `web/`).
