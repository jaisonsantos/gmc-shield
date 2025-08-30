# GMC Shield — Task Plan (T0–T12)

> Plano unificado por **Tarefas T\*** (sem datas). Cada tarefa traz **Objetivo**, **Escopo**, **DoD** e **Validações**.

---

## Convenções Globais

- **Monorepo**: `api/`, `worker/`, `web/`, `plugin-woo/`, `infra/`, `docs/`, `ops/`.
- **Prefixo de API**: todas as rotas **novas** em `/api/v1/*`. Manter _aliases_ de compatibilidade quando existirem rotas legadas.
- **Auth**: JWT curto + refresh; **RBAC** por roles (`owner|admin|analyst|viewer`) com `Depends(require_roles(...))` em rotas sensíveis.
- **Artefatos**: HTML/screenshots/PDF em `artifacts/` (MinIO/S3 em produção) com chaves estáveis.
- **Idempotência**: jobs com `dedupe_key` (ex.: `scan:{store_id}:{feed_item_id}:{ua}`) e TTL.
- **Observabilidade**: logs JSON (campos mínimos: `ts`, `level`, `msg`, `trace_id`, `request_id`, `job_id`, `store_id`, `user_id`), métricas/latências, runbooks em `RUNBOOK.md`.
- **OpenAPI**: publicar `OpenAPI.md` no CI; cobrir todas as rotas v1 (incl. OAuth Google).
- **Testes**: `pytest -q` roda **sem Docker** (SQLite/engine em memória). Cobrir helpers, idempotência, OAuth mockado e smoke de API.
- **Qualidade**: ruff/black/mypy no `api/`; eslint/prettier no `web/`; pre-commit.
- **Rate-limit & Auditoria**: aplicar em auth/ingest/scan/OAuth; audit-log mínimo.

---

## Fase 1 — Core MVP (T0–T12)

### T0 — Repo, Infra & CI/CD ✅

**Objetivo**

Base sólida de execução e qualidade (local/CI), com observabilidade mínima e OpenAPI completa (incluindo OAuth/Google MC).

**Escopo**

- **CI único** (`.github/workflows/ci.yml`)

  - **API**: setup Python + cache pip; `ruff --fix --exit-non-zero-on-fix`; `pytest -q`.
  - **Web**: setup Node + cache npm; `npm ci`; `npm run lint`; `npm run build`.
  - **Plugin**: lints básicos (se aplicável).
  - **OpenAPI**: gerar e **publicar** `OpenAPI.md` como artifact.
  - **Gates**:

    - **Drift de OpenAPI**: falhar o job se o `OpenAPI.md` gerado divergir do versionado.
    - **OAuth offline**: testes de OAuth **sem rede** (ex.: `respx`) integrados ao CI.

- **Docker & Compose**

  - `infra/Dockerfile.api` **multi-stage**; imagem final **non-root** (usuário `app`).
  - Instalar Playwright Chromium: `python -m playwright install --with-deps chromium`.
  - `docker-compose.yml` com **healthchecks** para `db`, `redis`, `api` e workers (`rq-feed`, `rq-crawl`).

- **Config/Toggles (Pydantic Settings)**

  - Variáveis essenciais (.env): `REDIS_URL`, `JWT_SECRET`, `CRAWLER_REWRITE_FROM`, `CRAWLER_REWRITE_TO`, `HEADLESS`, etc.
  - **.env.example** atualizado incluindo chaves para OAuth Google (serão usadas no T2/T3):

    - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
      `GOOGLE_OAUTH_REDIRECT_URI`,
      `GOOGLE_OAUTH_SCOPES_BASE="openid email profile"`,
      `GOOGLE_OAUTH_SCOPES_CONTENT="openid email profile https://www.googleapis.com/auth/content"`,
      `GOOGLE_OAUTH_ISSUER="https://accounts.google.com"`,
      `GOOGLE_API_BASE="https://www.googleapis.com"`.

- **OpenAPI (cobertura total)**

  - Garantir que **todas** as rotas novas apareçam:

    - `GET /api/auth/google/start`
    - `GET /api/auth/google/callback`
    - `GET /api/auth/google/start-content`
    - `GET /api/google/mc/accounts`
    - `GET /api/google/mc/{merchant_id}/products`

- **Observabilidade mínima**

  - **Logs JSON estruturados** (API e workers) com: `ts`, `level`, `msg`, `trace_id`, `request_id`, `job_id`, `store_id`, `user_id`.
  - **Propagação de trace**: middleware injeta `trace_id`; repassar para jobs (header → contextvar → log).
  - **Métricas simples** em `/api/ops/metrics`: contadores por status e latências p50/p95 (em memória/rolling window).

- **Dev UX**

  - `infra/Makefile` com alvos `up`, `up-crawl`, `feed-logs`, `crawl-logs`, `test`.

- **Pre-commit**

  - Hooks para format/lint/test rápido (Python e Web).

**DoD**

- `pytest -q` **verde sem Docker** (SQLite/engine in-memory).
- CI verde com:

  - Artifact do `OpenAPI.md` publicado.
  - **Gate de drift** do OpenAPI passando (ou falhando corretamente se houver divergência).
  - **Testes de OAuth offline** passando (mocks de token/userinfo).

- `OpenAPI.md` inclui **todas** as rotas OAuth/MC listadas.
- Logs saem em **JSON** com `trace_id` visível em requests e jobs.
- `/api/ops/metrics` responde com contadores e latências (p50/p95).
- `docker compose up -d` sobe `db`, `redis`, `api`, workers; **healthchecks OK**.
- `.env.example` contém variáveis novas (incl. OAuth) e carrega sem erro no startup.

**Validações**

- **CI/PR**: abrir um PR de teste e verificar jobs verdes; baixar artifact do `OpenAPI.md`.
- **OpenAPI**: inspecionar o arquivo e confirmar presença das rotas OAuth/MC.
- **Health/Ready**: `curl :8000/healthz` e `curl :8000/readyz` retornam `{ "ok": true }`.
- **Métricas**: `curl :8000/api/ops/metrics` exibe contadores e p50/p95.
- **Logs**: efetuar uma request e um job de crawl; confirmar em logs JSON os campos `trace_id`/`job_id`.
- **OAuth offline**: rodar `pytest -q -k oauth` e ver `respx` (ou similar) interceptando chamadas sem rede.

---

### T1 — Feed Ingestor & Versionamento

**Objetivo**

Ingerir feeds por arquivo/URL com normalização e idempotência.

**Escopo**

- **Endpoints (v1)**:
  - `POST /api/v1/stores/{store_id}/feeds/ingest` (arquivo **ou** `{url, format}`).
  - `GET  /api/v1/stores/{store_id}/feeds/versions` (lista versões).
  - `GET  /api/v1/feeds/versions/{version_id}/items` (páginas itens normalizados).
  - **Aliases** de compatibilidade para rotas legadas (não quebrar UI atual).
- **Normalização (helpers)**:
  - `clean_text`, `canonicalize_link` (lowercase scheme/host; strip `utm_*`; path default `/`).
  - `extract_currency` (ISO-4217 3 letras; pode inferir de preço).
  - `normalize_gtin` (apenas dígitos; len 8/12/13/14; mod10; inválido → `None`).
  - `price_*` em **centavos** + `currency` ISO.
- **Versionamento**:
  - Tabela `feed_versions(content_hash, items_count, created_at)`.
  - `content_hash = sha256(raw + origin)`; re-ingest **igual** → não cria versão nova (`items_imported=0`).
  - `feeds.last_item_count` e `feeds.created_at` preenchidos.

**DoD**

- Ingestão de ≥60 itens **por arquivo e por URL** (dataset DoD). Re-ingest do mesmo conteúdo (Duplicar conteúdo) **não** cria versão nova.
- Testes unitários (helpers), idempotência e smoke de API (v1) passando.

**Validações**

- Script de demonstração: ingere arquivo e URL (60+ itens), imprime contagens e `content_hash` iguais p/ duplicata.

---

### T2 — Google Login (OIDC) — Sessão do SaaS

**Objetivo**

Permitir “Continuar com Google” para autenticar o usuário e criar/associar o usuário local usando **OIDC Authorization Code + PKCE**, **sem** solicitar ainda o escopo do Merchant Center.

---

#### Escopo

- **Variáveis de ambiente (validar no startup)**

  - `GOOGLE_CLIENT_ID`
  - `GOOGLE_CLIENT_SECRET`
  - `GOOGLE_OAUTH_REDIRECT_URI` (ex.: `https://app.example.com/api/auth/google/callback`)
  - `GOOGLE_OAUTH_SCOPES_BASE="openid email profile"`
  - `GOOGLE_OAUTH_ISSUER="https://accounts.google.com"`
  - (opcionais úteis) `GOOGLE_TOKEN_ENDPOINT`, `GOOGLE_AUTH_ENDPOINT`, `GOOGLE_USERINFO_ENDPOINT`

    > Default por discovery; sobrescrevíveis para testes.

  - **Obs.**: adicione todos no `.env.example` (T0).

- **PKCE + state (+ nonce)**

  - Gerar `state` **assinado** e salvar em Redis com TTL 5 min: chave `oauth:state:{id}` → payload `{return_to, ts}`.
  - Gerar `code_verifier`/`code_challenge` (S256); salvar `code_verifier` em `oauth:pkce:{id}` (mesmo TTL).
  - (Opcional recomendado) `nonce` salvo em `oauth:nonce:{id}` para validação do `id_token`.
  - Invalidar chaves após uso (idempotência).

- **Modelo de dados (`google_accounts`)**

  - Campos:

    - `id` (PK), `user_id` (FK → users), `sub` (**unique**), `email`, `name`, `picture`
    - `access_token_enc` (opcional), `refresh_token_enc` (opcional), `token_expiry` (UTC)
    - `content_scope_granted BOOLEAN DEFAULT false`
    - `created_at`, `updated_at`

  - **Criptografia**: se `refresh_token` vier, **sempre** criptografar (reuso do `crypto.py`).
  - **Invariantes**:

    - **Nunca** sobrescrever `refresh_token_enc` com `NULL` em renovações.
    - `sub` é a âncora primária da conta Google.
    - `email` pode mudar; sempre confiar em `sub`.

- **Endpoints Backend (FastAPI)**

  - `GET /api/auth/google/start?return_to=/path`

    - Gera `state`+PKCE(+nonce), constrói `auth_url` com **scopes**: `openid email profile`.
    - Resposta: `{ auth_url }`.
    - Rate-limit leve p/ proteção (ex.: 10/min/IP).

  - `GET /api/auth/google/callback?state=...&code=...`

    - Valida `state`/TTL; busca `code_verifier` em Redis.
    - Troca `code`→`tokens` no token endpoint (mockado nos testes).
    - (Opcional) Valida `id_token` (`iss`, `aud`, `exp`, `nonce`).
    - Busca `userinfo` (email, name, picture); cria/associa usuário local.
    - **Emite JWT da app** (curto prazo) + (se usado) cookie HttpOnly; redireciona para `return_to`.
    - Atualiza/insere em `google_accounts`:

      - `sub`, `email`, `name`, `picture`
      - `access_token_enc?`, `refresh_token_enc?`, `token_expiry`
      - `content_scope_granted = false`

    - Limpa chaves Redis (`state`, `pkce`, `nonce`).

- **Sessão/JWT (app)**

  - JWT curto (ex.: 15–30 min) + refresh (se já existir seu fluxo).
  - Cookie **HttpOnly** + `SameSite=Lax` ou `Strict` (se UI no mesmo domínio) **ou** retorno via fragment/query.
  - CORS e redirect **whitelist** (não aceitar `return_to` externo).

- **Frontend (React)**

  - Botão **“Continuar com Google”** no `Login`:

    - Chama `/api/auth/google/start`, recebe `auth_url`, faz `window.location = auth_url`.

  - Callback:

    - Se JWT vier por query: ler, salvar na sessão (ou será cookie HttpOnly).
    - Bootstrap do usuário (chamar `/api/auth/me` ou similar).

  - Manter **fallback** login e-mail/senha (rotas legadas/compatibilidade).

- **Observabilidade (ligação com T0)**

  - Logs JSON com `trace_id`, `request_id`, `user_id` (se houver), `msg`.
  - Marcar eventos: `oauth.start`, `oauth.callback.ok`, `oauth.callback.error`.

---

#### Testes

- **Unitários**

  - Geração/validação de `state` (assinatura, TTL).
  - PKCE: `code_challenge`/`code_verifier` (S256) + armazenamento TTL.
  - (Opcional) Verificação de `nonce`.

- **Integração (mockada, sem rede)**

  - “Caminho feliz”:
    `start → callback` com `code` → mock do token endpoint → mock `userinfo` → criação/associação do usuário → JWT emitido.
  - Casos negativos:

    - `state` inválido/expirado.
    - Erro 4xx/5xx do token endpoint (mock).
    - `id_token` inválido (iss/aud/exp).

  - Garantias:

    - Não sobrescrever `refresh_token_enc` com `NULL`.
    - Registros criados/atualizados corretamente.

---

#### DoD

- Login real no **Google (Testing mode)**:

  - Escolha de conta + consent mínimo (`openid email profile`) → usuário autenticado na UI com JWT local.

- `google_accounts`:

  - Registro criado/atualizado; `content_scope_granted=false`.
  - Se Google **não** retornar `refresh_token`, o fluxo segue normalmente (identidade).

- Segurança & qualidade:

  - Redirect whitelist aplicado; tokens sensíveis **nunca** em localStorage.
  - Rate-limit nas rotas de OAuth.

- Testes:

  - Unitários e integração (mock) **passam no CI offline**.

---

#### Validações

- **Manual (sandbox real)**

  - Executar `/api/auth/google/start` pela UI, completar consent; verificar usuário na UI e no DB (`google_accounts`).
  - Verificar logs JSON marcando eventos e `trace_id`.

- **Banco**

  - Conferir `google_accounts` (`sub` único, `content_scope_granted=false`, `token_expiry` coerente).
  - Se houve `refresh_token`, confirmar que foi **criptografado** e que não é sobrescrito nas atualizações.

- **OpenAPI**

  - Confirmar presença de:

    - `GET /api/auth/google/start`
    - `GET /api/auth/google/callback`

---

**Notas de implementação rápidas**

- Use discovery (`/.well-known/openid-configuration`) para endpoints do Google; permita override por env em testes.
- Prefira **Auth Code + PKCE** (já definido) em vez de implicit.
- Armazene o `return_to` sanitizado (somente paths internos).
- Considere `SameSite=None; Secure` se cookie cruzar domínios (ex.: app em `app.example.com` e API em `api.example.com` via HTTPS).

---

### T3 — Conectar Merchant Center (escopo `content`)

**Objetivo**

Autorizar o acesso à **Google Content API (Merchant Center)** via consent **incremental** e permitir: listar contas acessíveis (`authinfo`), escolher um `merchant_id` e paginar produtos.

---

#### Escopo

- **Variáveis de ambiente (adicionar ao `.env.example` e validar no startup)**

  - `GOOGLE_OAUTH_SCOPES_CONTENT="openid email profile https://www.googleapis.com/auth/content"`
  - `GOOGLE_API_BASE="https://www.googleapis.com"` _(permite override para mocks/tests)_
  - (herdadas do T2) `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI`, `GOOGLE_OAUTH_ISSUER`

- **Consent incremental (reuso de PKCE+state do T2)**

  - `GET /api/auth/google/start-content?return_to=/settings`

    - Gera `state`+PKCE e constrói `auth_url` com **escopos content**.

  - `GET /api/auth/google/callback` (mesmo endpoint do T2)

    - Reaproveita a conta Google existente por `sub`.
    - Persiste **novo** `access_token` e, se vier, **`refresh_token_enc`** (criptografado).
      **Nunca** sobrescrever `refresh_token_enc` por `NULL`.
    - Marca `content_scope_granted = true` em `google_accounts`.

- **Endpoints de MC (Backend FastAPI)**

  - `GET /api/google/mc/accounts`

    - Chama `GET {GOOGLE_API_BASE}/content/v2.1/accounts/authinfo`
    - Retorna contas/afiliações que o token atual pode acessar.

  - `GET /api/google/mc/{merchant_id}/products?maxResults=50&pageToken=`

    - Chama `GET {GOOGLE_API_BASE}/content/v2.1/{merchant_id}/products`
    - Paginação simples por `pageToken`.

  - **Renovação de token automática**
    Antes de cada chamada, se `now >= token_expiry - 60s`:
    → usar `refresh_token_enc` para renovar; atualizar `access_token`/`token_expiry`.
    → se a resposta de refresh **não** trouxer `refresh_token`, **preservar** o antigo.

- **Persistência do Merchant selecionado**

  - **MVP (recomendado)**: coluna `stores.google_merchant_id` para amarrar a loja a um MC.
  - _(Extensível)_: se precisar multi-merchant por usuário/loja no futuro, criar pivô
    `google_accounts_stores(google_account_id, store_id, merchant_id)`.

- **Frontend (React)**

  - Em **Configurações**:

    - Card “Google Merchant Center”

      - Status: **Conectado/Desconectado** + escopo `content` concedido?
      - Botão **“Conectar Merchant Center”** → `/api/auth/google/start-content`.
      - Após retorno: chamar `/api/google/mc/accounts`, exibir lista e **salvar** `merchant_id` (PATCH loja).
      - Tabela de **produtos** (primeira página) chamando `/api/google/mc/{merchant_id}/products`.

- **Segurança & robustez**

  - Tokens criptografados em repouso (reuso de `crypto.py`).
  - Rate-limit leve em `/start-content` e endpoints de MC.
  - Tratar 401/403 da API do Google:

    - 401 por token expirado → tentar **uma** renovação e repetir a chamada.
    - 403/invalid_grant → retornar erro orientando reconectar (re-consent).

  - Sanitizar e **whitelist** de `return_to`.

- **OpenAPI (ligação com T0)**

  - Garantir exposição/documentação de:

    - `GET /api/auth/google/start-content`
    - `GET /api/google/mc/accounts`
    - `GET /api/google/mc/{merchant_id}/products`

---

#### Testes

- **Unit**

  - Serviço de **refresh**: se `token_expiry` ultrapassado, executa refresh e retorna novo `access_token`.
  - Garantia: **não** sobrescrever `refresh_token_enc` quando refresh não retornar `refresh_token`.

- **Integração (mock, sem rede)**

  - `start-content → callback` atualiza `google_accounts.content_scope_granted=true`.
  - `authinfo` mockado retorna contas; `/mc/accounts` propaga corretamente.
  - `products` mockado com `pageToken` → paginação funciona (2 páginas).
  - Caso 401: primeira chamada falha, refresh ocorre, segunda chamada **sucede**.
  - Caso 403/invalid_grant: API responde erro coerente pedindo reconexão.

---

#### DoD

- Botão **“Conectar Merchant Center”** realiza consent incremental; ao voltar:

  - `/api/google/mc/accounts` lista contas acessíveis.
  - Usuário seleciona `merchant_id` e é **persistido** (em `stores.google_merchant_id`).
  - `/api/google/mc/{merchant_id}/products` lista **ao menos 1 página** (com paginação habilitada).

- Renovação de tokens é **transparente**; `refresh_token_enc` **preservado**.
- OpenAPI atualizado com as três rotas.
- Logs JSON mostram eventos `oauth.content.start`, `oauth.content.granted`, `mc.authinfo.ok`, `mc.products.ok`.

---

#### Validações

- **Manual (Testing mode)**

  - Executar o fluxo real de consent; verificar `content_scope_granted=true` em `google_accounts`.
  - Selecionar um `merchant_id`; confirmar que `/products` responde e a UI lista produtos.

- **Banco**

  - `google_accounts`: `sub` único; `content_scope_granted=true`; `token_expiry` coerente.
  - `stores.google_merchant_id` preenchido após a seleção.

- **Logs**

  - Conferir `trace_id` propagado e eventos principais (start/callback/authinfo/products/refresh).

---

**Notas rápidas de implementação**

- Utilize **discovery** OIDC por padrão, mas permita override via env para testes/mocks.
- Extraia um **HttpClient** (ex.: `google_client.py`) com:

  - `get_authinfo()`, `list_products(merchant_id, maxResults, pageToken)`,
  - `ensure_token()` (renova quando necessário).

- Mantenha o **fallback** de login por e-mail/senha intacto (compatibilidade).

---

### T4 — Crawler (Snapshots) + UA Variants

**Objetivo**

Capturar **HTML + screenshot** por item em **duas UAs** (Chrome/Googlebot) com rewrites, resiliência mínima e logs estruturados; expor **aliases v1** sem quebrar legados.

---

#### Escopo

- **Endpoints & Aliases (v1)**

  - **Novo (alias)** `POST /api/v1/stores/{store_id}/scan` → mesmo handler de `/api/stores/{store_id}/scan`.
  - **Novo (alias)** `GET  /api/v1/stores/{store_id}/runs/{run_id}/snapshots` → mesmo handler de `/api/stores/{store_id}/runs/{run_id}/snapshots`.
  - Documentar ambos no **OpenAPI** (ver T0) e manter as rotas antigas ativas.

- **Worker `rq-crawl` (Playwright/Chromium)**

  - UAs suportadas: `chrome`, `googlebot` (header `User-Agent` e `X-Forwarded-For` opcional).
  - **Rewrites**: `CRAWLER_REWRITE_FROM` → `CRAWLER_REWRITE_TO` (substituição simples antes do `goto`).
  - Artefatos por item/UA:

    ```
    artifacts/store{store_id}/runs/{run_id}/items/{feed_item_id}/{ua}/page.html
    artifacts/store{store_id}/runs/{run_id}/items/{feed_item_id}/{ua}/page.png
    ```

  - Persistir em `page_snapshots(store_id, run_id, feed_item_id, url, http_status, html_path, screenshot_path, extracted_json, fetched_at)`.

- **Resiliência mínima**

  - **Timeout** de navegação: `CRAWLER_NAV_TIMEOUT_MS` (default **30000** ms) com `waitUntil="domcontentloaded"`.
  - **Retry** automático (máx **2** tentativas) com **backoff** crescente (ex.: `500ms`, `1500ms`) para erros transitórios:

    - `ERR_NAME_NOT_RESOLVED`, `ECONNRESET`, `ETIMEDOUT`, `ENETUNREACH` e HTTP 502/503/504.

  - Registrar a **primeira falha** e o **sucesso após retry** (ou falha final).

- **Observabilidade (logs JSON)**

  - Por **job** registrar **um** evento final (e um por tentativa), com:

    ```
    { ts, level, msg="crawl.done", trace_id, job_id, store_id, run_id,
      feed_item_id, ua, url, http_status, duration_ms, attempt, max_attempts, error_code?, error_msg? }
    ```

  - Propagar `trace_id` do request que criou o `run` para cada job (contextvar/Redis).

- **Config (variáveis de ambiente)**

  - `CRAWLER_UAS="chrome,googlebot"`
  - `CRAWLER_REWRITE_FROM`, `CRAWLER_REWRITE_TO`
  - `CRAWLER_NAV_TIMEOUT_MS=30000`
  - `CRAWLER_RETRY_MAX=2`
  - `CRAWLER_RETRY_BACKOFF_MS="500,1500"`
  - `HEADLESS=true`
  - (Reuso) `REDIS_URL`

- **Segurança/boas práticas**

  - Desabilitar downloads/permits desnecessários (Playwright context com permissões mínimas).
  - Sanitizar URL após rewrite; impedir `file://` e hosts fora de allowlist se configurado.
  - Capturar `response.status()` quando disponível; se `goto` falhar antes de resposta, salvar `http_status=null` e `error`.

---

#### Testes

- **API (smoke)**

  - Exercitar **novos aliases v1**:

    - `POST /api/v1/stores/{id}/scan` com `limit_items=2`.
    - `GET  /api/v1/stores/{id}/runs/{run}/snapshots` retorna **4** entradas (2 itens × 2 UAs) com `html_path`/`png` existentes.

- **Worker (unit/integration leve, mock de Playwright)**

  - Retry: na 1ª tentativa lançar `ERR_NAME_NOT_RESOLVED`, 2ª OK → job sucesso; logs mostram `attempt=2`.
  - Timeout: forçar exceder `CRAWLER_NAV_TIMEOUT_MS` → snapshot com `http_status=null` e `error_code="timeout"`.
  - Rewrite: URL `https://demo.../produto/001` vira `http://host.docker.internal:8080/...`.

- **Banco**

  - Verificar inserções em `page_snapshots` com `run_id`, `ua`, `http_status` e caminhos corretos.

---

#### DoD

- Com `limit_items=2` o sistema produz **4 snapshots** (Chrome + Googlebot) com:

  - `http_status` coerente (ex.: 200/404),
  - `html_path` e `screenshot_path` válidos,
  - logs finais por job contendo `duration_ms`, `ua`, `run_id` e `attempt`.

- **Aliases v1** funcionando e documentados sem quebrar rotas legadas.

---

#### Validações

- **CLI/UI** usando **v1**:

  - `POST /api/v1/stores/{id}/scan` → acompanhar com `docker compose logs -f rq-crawl`.
  - `GET  /api/v1/stores/{id}/runs/{run}/snapshots` → checar 4 registros.

- **FS**:

  - `find api/artifacts -path "*/store{id}/runs/{run}/*/page.*"` lista `html` e `png` para as duas UAs.

- **Logs**

  - Conferir entradas `crawl.attempt` e `crawl.done` com os campos definidos e `trace_id` presente.

---

### T5 — Rule Pack v1 (Mínimo Viável)

**Objetivo**

Detectar problemas críticos iniciais a partir de **snapshots** e **itens normalizados**, com regras estáveis, evidências claras e listagem paginada na UI.

---

#### Escopo

- **Regras (mínimas e estáveis)**

  - `PRICE_MISSING`: preço ausente/nao-parsável na página (DOM) **e** nos dados estruturados (fallbacks aceitos).
  - `SD_ABSENT`: não há JSON-LD `@type: Product` (ou está inválido).
  - `TITLE_EMPTY`: título vazio/muito curto após `clean_text` (ex.: `< 3` chars).
  - `LINK_BROKEN`: **último snapshot** do item com HTTP `4xx/5xx` (considerar 2 tentativas falhas se houver).

- **Extrações mínimas**

  - De cada `page.html`:

    - `title_text` (DOM `<title>` ou `h1`),
    - `price_text` (busca por `meta[itemprop=price]`, `data-price`, `Price` em JSON-LD),
    - `ld_product` (bloco `application/ld+json` com `@type Product`, normalizado).

  - Salvar resumo em `page_snapshots.extracted_json`:

    ```json
    {
      "title": "...",
      "price": { "raw": "R$ 9,99", "value": 9.99, "currency": "BRL" },
      "ld_types": ["Product"],
      "detectors": { "found_meta_price": true, "found_ld_product": true }
    }
    ```

- **Modelo & Migração**

  - Tabela `violations` (se já existir, **manter compat**; caso contrário criar):

    ```
    id PK,
    store_id INT NOT NULL,
    feed_item_id TEXT NOT NULL,
    rule_code TEXT NOT NULL, -- estável (ex.: 'PRICE_MISSING')
    severity TEXT NOT NULL,  -- 'critical'|'major'|'minor'
    evidence_json TEXT NOT NULL,
    snapshot_run_id INT,     -- opcional referencia ao run de origem
    snapshot_fetched_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
    ```

  - **Unicidade/idempotência por item/regra**:
    `UNIQUE (store_id, feed_item_id, rule_code)` para manter **apenas a violação ativa mais recente**.
    Ao reprocessar, **upsert** pela chave única atualizando `evidence_json`, `snapshot_*` e `created_at`.
  - Índices úteis:

    - `idx_violations_store_rule (store_id, rule_code)`
    - `idx_violations_store_created (store_id, created_at desc)`

- **Serviço de detecção** (`services/rules_v1.py`)

  - Funções puras por regra: `check_price_missing(snapshot, item)`, `check_sd_absent(snapshot)`, `check_title_empty(snapshot, item)`, `check_link_broken(snapshot)`.
  - Severidades sugeridas:

    - `PRICE_MISSING`: `critical`
    - `SD_ABSENT`: `major`
    - `TITLE_EMPTY`: `minor`
    - `LINK_BROKEN`: `major` (ou `critical` se 5xx repetido)

  - **Evidência** (estrutura padronizada por regra):

    ```json
    {
      "snapshot": {
        "ua": "chrome",
        "url": "...",
        "http_status": 404,
        "html_path": "...",
        "screenshot_path": "..."
      },
      "signals": {
        "title_text": "...",
        "price_raw": "R$ 9,99",
        "ld_types": ["Product"]
      },
      "message": "Price not found in DOM or JSON-LD."
    }
    ```

  - Estratégia de escolha do snapshot: **mais recente** por `(store_id, run_id, feed_item_id, ua='chrome')`; se ausente, usar `googlebot`.
  - Integração com o fluxo: após finalizar um `scan`/`crawl` (ou via tarefa separada `rq-analyze`), rodar `rules_v1.evaluate(store_id, run_id)` que **varre os itens do run** e faz upserts em `violations`.

- **API/UI**

  - **Listagem** (já existe `violations` router): garantir filtros por `rule_code`, `severity`, `feed_item_id`, `since` e paginação (`page`, `limit`).
  - **Detalhe**: incluir `evidence_json` diretamente (UI renderiza snippet + link para screenshot/HTML).
  - **Compat**: não quebrar rotas atuais; se criar novas v1, manter aliases.

---

#### Testes

- **Unit (detectors)**

  - `test_rules_price_missing.py`: páginas com/sem preço em DOM/JSON-LD; moeda e número estranhos → flagged.
  - `test_rules_sd_absent.py`: LD ausente/`@type` errado/JSON inválido.
  - `test_rules_title_empty.py`: `<title>` vazio/whitespace; `h1` fallback.
  - `test_rules_link_broken.py`: snapshot com 404/500; com 200 **não** gera violação.

- **Integration leve (DB + upsert)**

  - `test_violations_upsert.py`: mesmo item/regra rodado 2x atualiza `created_at`/`evidence_json`, sem duplicar linhas.
  - `test_evaluate_run.py`: simular `run_id` com 3 itens cobrindo todas as regras; gerar 4 violações.

- **API (smoke)**

  - `GET /api/stores/{id}/violations?rule_code=...` retorna paginação correta e `evidence_json` com paths existentes.

---

#### DoD

- Dataset sintético de 4–6 páginas **gatilha cada regra** pelo menos uma vez.
- `evaluate(run_id)` produz **violação por regra** conforme esperado e faz **upsert** (sem duplicar).
- UI lista violações com **severidade** e mostra evidence (screenshot/HTML snippet/LD types).
- Consultas paginadas rápidas (índices aplicados).

---

#### Validações

- **SQL**:
  `SELECT rule_code, count(*) FROM violations WHERE store_id=? GROUP BY 1 ORDER BY 2 DESC;`
- **FS**: cada violação aponta para `screenshot_path/html_path` **existentes**.
- **Reprocessamento**: disparar o avaliador duas vezes sobre o mesmo `run_id` → contagem **não aumenta**; `created_at`/evidences atualizam.
- **UI**: filtrar por `rule_code=SD_ABSENT` e abrir modal de evidence; verificar LD ausente e screenshot carregando.

---

### T6 — Blocks (Supplemental Feed)

**Objetivo**

Bloquear/desbloquear itens e expor um **feed suplemental** simples (CSV/XML) consumível pela loja/plataforma (ex.: plugin Woo), com URL **assinada** e idempotência.

---

#### Escopo

- **Modelo & Migração**

  - Tabela `blocks` (se já existir, manter compat e apenas ajustar índices):

    ```
    id PK,
    store_id INT NOT NULL,
    feed_item_id TEXT NOT NULL,
    reason TEXT,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
    ```

  - **Idempotência por item**: manter **um único bloqueio ativo** por `(store_id, feed_item_id)`.

    - Postgres: índice parcial `UNIQUE (store_id, feed_item_id) WHERE active = true`.
    - SQLite (testes): simular com upsert que desativa o anterior antes de inserir/ativar outro.

  - Índices:

    - `idx_blocks_store_active (store_id, active)`
    - `idx_blocks_store_item (store_id, feed_item_id)`

- **API (v1 + compat)**

  - **Novo v1**:

    - `POST   /api/v1/stores/{store_id}/blocks` body `{feed_item_id, reason?}` → **upsert** (se já existir ativo, idempotente).
    - `DELETE /api/v1/stores/{store_id}/blocks/{feed_item_id}` → marca `active=false`.
    - `GET    /api/v1/stores/{store_id}/blocks?active=true&page=&limit=` → lista paginada.
    - `GET    /api/v1/stores/{store_id}/blocks/supplemental.csv?token=...&exp=...`
      `GET    /api/v1/stores/{store_id}/blocks/supplemental.xml?token=...&exp=...`

  - **Aliases** para rotas legadas (se já houver em `/api/stores/...`, manter e apontar para mesma lógica).

- **Assinatura de URL (HMAC)**

  - Env: `SUPPLEMENTAL_SIGNING_KEY` (obrigatório em prod), `SUPPLEMENTAL_TTL_SECONDS` (ex.: `604800` = 7 dias).
  - Token: `HMAC_SHA256(base64url, f"{store_id}|{path}|{exp}")`.
    Verificação: confere `exp` (>= now) e HMAC constante‐time.
  - Helper de geração (para UI/CLI):
    `build_signed_url(store_id, path="/api/v1/stores/{id}/blocks/supplemental.csv", ttl=...) -> url_com_token`

- **Geração do suplemento (artefatos)**

  - Ao **bloquear/desbloquear**:

    - Regerar **CSV** e **XML** síncrono ou via job leve `rq-supplemental` (ok manter síncrono no MVP).
    - Caminhos:

      - `artifacts/store{store_id}/supplemental/blocks.csv`
      - `artifacts/store{store_id}/supplemental/blocks.xml`

    - **CSV** (UTF-8, `\n`):
      `id,blocked,reason,updated_at`
      `SKU-001,true,"Manual review",2025-01-02T03:04:05Z`
    - **XML**:

      ```xml
      <items>
        <item>
          <id>SKU-001</id>
          <blocked>true</blocked>
          <reason>Manual review</reason>
          <updated_at>2025-01-02T03:04:05Z</updated_at>
        </item>
      </items>
      ```

    - `ETag`: `sha256` do conteúdo salvo; armazenar junto (ex.: `.etag`) para servir condicional.

  - **Servir** com cabeçalhos:

    - `ETag`, `Content-Type` (`text/csv` ou `application/xml`),
      `Cache-Control: public, max-age=300`, `Last-Modified`.
    - Responder **304** em `If-None-Match`.

- **Consumo (plugin Woo / terceiros)**

  - Consumidor chama a URL **assinada**; plugin deve fazer **cache** local por alguns minutos (evita martelar).
  - O formato é **estável**: `id` = SKU do feed. O integrador decide como aplicar (ocultar produto/pausar anúncio).

- **Observabilidade**

  - Logs JSON em geração e entrega: `{store_id, blocked_count, format, etag, served=1, status}`.

- **RBAC & Segurança**

  - `POST/DELETE/GET (lista)` exigem `owner|admin|analyst` (conforme política do projeto).
  - URLs assinadas **não** exigem JWT (autônomas), mas expiram por `exp` e são HMAC‐validadas.

---

#### Testes

- **Unit (assinatura)**

  - `test_signer_ok`: URL válida com `exp` futuro → **200**.
  - `test_signer_expired`: `exp` passado → **403**.
  - `test_signer_tamper`: token alterado → **403**.

- **Integration (API/artefatos)**

  - `test_block_unblock_csv_xml`:

    1. `POST` bloqueia 2 SKUs → CSV/XML contém ambos;
    2. `DELETE` de 1 SKU → CSV/XML atualiza removendo o SKU.

  - `test_etag_conditional`: 1ª chamada retorna `200` + `ETag`; 2ª com `If-None-Match` → `304`.
  - `test_unique_active`: bloquear o mesmo SKU 2× não duplica; mantém 1 linha `active=true`.

- **Smoke (lista)**

  - `GET /api/v1/stores/{id}/blocks?active=true` pagina correto e retorna `reason/updated_at`.

---

#### DoD

- **Bloquear via UI** → SKU aparece no **CSV/XML** e na listagem; **desbloquear** → removido do CSV/XML e `active=false` no DB.
- URL **assinada** acessível (sem JWT), com **`ETag`** e **`Cache-Control`** corretos.
- **Idempotência** garantida (um ativo por SKU/loja); re‐bloquear não cria duplicado.
- Logs estruturados presentes na geração e no handler de entrega.

---

#### Validações

- **cURL (exemplos)**

  - Bloquear:

    ```bash
    curl -X POST "$API/api/v1/stores/$SID/blocks" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d '{"feed_item_id":"SKU-001","reason":"Manual review"}'
    ```

  - Desbloquear:

    ```bash
    curl -X DELETE "$API/api/v1/stores/$SID/blocks/SKU-001" \
      -H "Authorization: Bearer $TOKEN"
    ```

  - Baixar CSV (URL assinada):

    ```bash
    curl -i "$API/api/v1/stores/$SID/blocks/supplemental.csv?token=...&exp=..."
    ```

  - Verificar 304 com `ETag`:

    ```bash
    ETAG=$(curl -sI "$SIGNED" | awk -F': ' '/^ETag/{print $2}' | tr -d '\r')
    curl -sI -H "If-None-Match: $ETAG" "$SIGNED" | head -n1  # HTTP/1.1 304 Not Modified
    ```

- **SQL**
  `SELECT active, COUNT(*) FROM blocks WHERE store_id=$SID GROUP BY 1;`
- **FS**
  `ls -l artifacts/store$SID/supplemental/` → `blocks.csv`, `blocks.xml` e `.etag` existem e são atualizados.

---

### T7 — Policies Wizard (MVP)

**Objetivo**

Gerar **Refund / Shipping / Privacy** a partir de _templates Jinja2_, com **preview** (Markdown→HTML) e **publicação** em WordPress via `wp_client`, mantendo **versionamento** e **idempotência**.

---

#### Escopo

- **Templates & i18n**

  - Usar `api/templates/policies/*.md.j2` existentes (`privacy.md.j2`, `refund.md.j2`, `shipping.md.j2`).
  - Suporte a `locale` (`pt-BR`, `es-ES`, `en-US`) por placeholders de texto no template (ou var `locale`).
  - Placeholders padrão disponíveis para todos os templates:

    - `store`: `{name, base_url, country, contact_email}`
    - `company`: `{legal_name?, tax_id?, address?}`
    - `policy`: `{return_window_days, support_email, shipping_partner?, processing_time_days?}`

- **Modelos & Migração**

  - Nova tabela `policy_pages`:

    ```
    id PK,
    store_id INT NOT NULL,
    template TEXT NOT NULL CHECK (template IN ('privacy','refund','shipping')),
    locale TEXT NOT NULL,
    title TEXT NOT NULL,
    slug  TEXT NOT NULL,
    content_hash TEXT NOT NULL,         -- sha256(rendered_html canonical)
    markdown_path TEXT,                 -- artifacts/.../index.md
    html_path TEXT,                     -- artifacts/.../index.html
    wp_page_id TEXT,                    -- opcional
    published_url TEXT,                 -- opcional
    published_at TIMESTAMPTZ,           -- opcional
    created_at TIMESTAMPTZ DEFAULT now()
    ```

  - Índices:

    - `idx_policy_pages_store_template (store_id, template, created_at DESC)`
    - `idx_policy_pages_store_hash (store_id, template, content_hash)` (evita duplicar versão idêntica)

  - **Idempotência**: mesma combinação _(store, template, content_hash)_ não cria nova versão nem república.

- **Artefatos**

  - Render salva em:

    ```
    artifacts/store{store_id}/policies/{template}/{content_hash}/index.{md,html}
    ```

  - `content_hash = sha256(markdown_renderizado + locale + slug)`

- **Sanitização**

  - Converter Markdown→HTML e **sanitizar** (whitelist simples: `p, a, ul, ol, li, h1..h4, strong, em, table, thead, tbody, tr, th, td, code, pre, blockquote, br`).
  - Links: `rel="noopener noreferrer"`, `target="_blank"` apenas quando externo.

- **API (v1)**

  - `GET  /api/v1/stores/{store_id}/policies`
    → lista último status por `template` (title, url publicada se houver, `content_hash`, `published_at`).
  - `POST /api/v1/stores/{store_id}/policies/preview`
    body:

    ```json
    {
      "template": "privacy|refund|shipping",
      "locale": "pt-BR",
      "title": "Política de Privacidade",
      "slug": "politica-privacidade",
      "variables": { "store": {...}, "company": {...}, "policy": {...} }
    }
    ```

    resp: `{ html, markdown, content_hash, html_path, markdown_path }` (artefatos gravados).

  - `POST /api/v1/stores/{store_id}/policies/publish`
    body = mesmo do preview. Lógica:

    - Renderiza → calcula `content_hash`;
    - Se **já existir** em `policy_pages` com o **mesmo hash**: **não** republica, apenas retorna o registro (idempotente);
    - Caso contrário: cria **nova versão** e chama `wp_client.publish_page(title, slug, html)`:

      - Se `slug` já existe no WP, faz **update** (mantém URL);
      - Salva `wp_page_id`, `published_url`, `published_at`.

  - **Aliases**: se já existirem rotas legadas, manter compat apontando para as novas.

- **RBAC & Segurança**

  - `preview` → `owner|admin|analyst`.
  - `publish` → `owner|admin`.
  - Inputs validados (slug: `^[a-z0-9-]+$`, normalizar para lower/kebab).
  - Rate-limit leve (ex.: 5/min por `store_id`) nas rotas de publish.

- **Front (UI)**

  - Tela “Policies” com tabs `Privacy/Refund/Shipping`.
  - Form com `locale`, `title`, `slug` e campos das variáveis; **Preview** em painel lateral; botão **Publish**.
  - Lista “Historico de versões” (hash, data, link WP).

---

#### Testes

- **Unit**

  - `test_slug_normalize`: “Política de Devolução” → `politica-de-devolucao`.
  - `test_render_hash_idempotent`: mesmas vars → mesmo `content_hash`.
  - `test_sanitizer_allows_blocklist`: só tags permitidas permanecem; `script` removido.

- **Integration (sem rede)**

  - Mock de `wp_client`:

    - 1º publish (novo) → cria `wp_page_id`, URL setada;
    - 2º publish **idêntico** → **não** chama WP (idempotência).

  - `GET /policies` reflete última publicação por template.

- **Smoke**

  - `preview` gera artefatos `.md` e `.html` nos caminhos esperados.

---

#### DoD

- **Preview** retorna HTML correto, sanitizado e persistido como artefato.
- **Publish** cria/atualiza página no WP, salva `policy_pages` e **evita duplicatas** por `content_hash`.
- UI mostra **URL publicada** e **histórico**; re‐publicar conteúdo **idêntico** é no-op.
- Rotas e OpenAPI documentadas; RBAC aplicado.

---

#### Validações (CLI)

- Preview:

  ```bash
  TOKEN=...
  API=http://localhost:8000
  SID=1
  curl -s -X POST "$API/api/v1/stores/$SID/policies/preview" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d @- <<'JSON' | jq '{hash:.content_hash, html:.html|length}'
  {
    "template": "privacy",
    "locale": "pt-BR",
    "title": "Política de Privacidade",
    "slug": "politica-privacidade",
    "variables": {
      "store": {"name":"Loja X","base_url":"https://lojax.com","country":"BR","contact_email":"suporte@lojax.com"},
      "policy": {"support_email":"suporte@lojax.com"}
    }
  }
  JSON
  ```

- Publish:

  ```bash
  curl -s -X POST "$API/api/v1/stores/$SID/policies/publish" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d '{"template":"privacy","locale":"pt-BR","title":"Política de Privacidade","slug":"politica-privacidade","variables":{"store":{"name":"Loja X","base_url":"https://lojax.com"}}}' \
    | jq '{id, content_hash, published_url}'
  ```

- Listar status:

  ```bash
  curl -s "$API/api/v1/stores/$SID/policies" -H "Authorization: Bearer $TOKEN" | jq .
  ```

- FS:

  ```bash
  ls -l artifacts/store$SID/policies/privacy/
  ```

---

#### Variáveis de Ambiente (complemento do `.env.example`)

- `WP_DEFAULT_STATUS=publish` (ou `draft` para sandbox)
- `WP_TIMEOUT_SECONDS=10`
- `POLICY_SANITIZER_STRICT=true` (ativar/desativar whitelist estrita)

---

> Observação: reaproveite `wp_client.py` atual; adicione método `publish_page(title, slug, html)` que **faz update se slug existir**. Documente exemplos no `README.md`/`CLI-CHEATSHEET.md` e gere/atualize **OpenAPI.md** com as novas rotas.

---

### T8 — Appeal Kit (PDF/ZIP + Texto-base)

**Objetivo**

Acelerar o **recurso (appeal)** ao Merchant Center com um **pacote pronto** gerado a partir das violações/snapshots: carta (PDF), anexos (ZIP) e textos-base multilíngues, com **idempotência** e **expiração**.

---

#### Escopo

- **Templates & i18n**

  - Diretório: `api/templates/appeals/`.
  - Arquivos por idioma: `letter.pt-BR.md.j2`, `letter.es-ES.md.j2`, `letter.en-US.md.j2`.
  - Placeholders:

    - `store`: `{name, base_url, country, contact_email}`
    - `merchant`: `{merchant_id?, website_claimed?}`
    - `case`: `{violations[], total, fixed_count, timeframe, corrective_actions[], evidence_links[]}`
    - `contact`: `{name?, role?, email?}`

  - **Sanitização** de conteúdo (markdown→HTML) antes de gerar PDF.

- **Modelos & Migração**

  - Nova tabela `appeals`:

    ```
    id PK,
    store_id INT NOT NULL,
    locale TEXT NOT NULL,                          -- ex.: 'pt-BR'
    title TEXT NOT NULL,                           -- ex.: "Recurso de Conta — Loja X"
    violations_json TEXT NOT NULL,                 -- [{feed_item_id, rule_code, snapshot_id, fixed?, notes?}, ...]
    template TEXT NOT NULL DEFAULT 'letter',
    content_hash TEXT NOT NULL,                    -- sha256(JSON_canon + template + locale + title)
    html_path TEXT,                                -- artifacts/.../index.html
    pdf_path TEXT,                                 -- artifacts/.../appeal.pdf
    zip_path TEXT,                                 -- artifacts/.../package.zip
    expires_at TIMESTAMPTZ,                        -- TTL (ex.: now()+7d)
    created_by INT,                                -- user_id opcional (auditoria)
    created_at TIMESTAMPTZ DEFAULT now(),
    status TEXT NOT NULL DEFAULT 'ready'           -- ready|expired
    ```

  - Índices:

    - `idx_appeals_store_created (store_id, created_at DESC)`
    - `idx_appeals_hash_unique (store_id, content_hash)` (idempotência).

- **Artefatos & Empacotamento**

  - Estrutura:

    ```
    artifacts/store{store_id}/appeals/{content_hash}/
      index.html              # carta renderizada (HTML sanitizado)
      appeal.pdf              # carta em PDF
      package.zip             # tudo empacotado
      evidence/
        {feed_item_id}/
          page.png
          page.html
          extracted.json      # trecho estruturado (price/title/ld-json) se houver
          notes.txt           # observações do usuário (opcional)
    ```

  - **Coleta de evidências**:

    - Buscar último snapshot do item/UA (priorizar `googlebot`, fallback `chrome`).
    - Incluir `page.png`, `page.html` e um `extracted.json` (já salvo em `page_snapshots.extracted_json`).

  - **PDF engine**: Playwright (`page.pdf`) por padrão; fallback WeasyPrint se Playwright indisponível (configurável).
  - **ZIP**: incluir `index.html`, `appeal.pdf` e pasta `evidence/`.

- **API (v1)**

  - `POST /api/v1/stores/{store_id}/appeals/prepare`
    Corpo:

    ```json
    {
      "locale": "pt-BR",
      "title": "Recurso de Conta — Loja X",
      "violations": [
        {
          "feed_item_id": "SKU-001",
          "rule_code": "PRICE_MISSING",
          "snapshot_id": 123,
          "fixed": true,
          "notes": "Corrigido preço no feed"
        },
        {
          "feed_item_id": "SKU-010",
          "rule_code": "SD_ABSENT",
          "snapshot_id": 124,
          "fixed": false
        }
      ],
      "contact": {
        "name": "Fulano",
        "role": "Owner",
        "email": "owner@lojax.com"
      }
    }
    ```

    Retorna **prévia** com:

    - `content_hash`, `html` (sanitizado), `html_path`, sumário de evidências encontradas.
    - **Não** gera PDF/ZIP ainda.

  - `POST /api/v1/stores/{store_id}/appeals/generate`
    Mesmo payload do `prepare`. Lógica:

    - Calcula `content_hash`.
    - Se já existir `appeals` com **mesmo hash**: **idempotente** → retorna registro existente (não regenera binários).
    - Caso contrário: cria registro, gera `index.html`, `appeal.pdf`, `package.zip`, define `expires_at = now()+APPEALS_TTL_DAYS`.
    - Resposta: `{id, content_hash, html_path, pdf_path, zip_path, expires_at}`.

  - `GET /api/v1/stores/{store_id}/appeals`
    Lista (paginada) dos appeals (id, title, locale, created_at, expires_at, status).
  - `GET /api/v1/stores/{store_id}/appeals/{appeal_id}`
    Metadados + links (se não expirado).

- **Segurança & RBAC**

  - `prepare`/`generate` → `owner|admin|analyst`.
  - `list/get` → `owner|admin|analyst|viewer`.
  - **Rate-limit** leve em `generate` (ex.: 5/min por `store_id`).
  - Sanitizar **toda** entrada livre (ex.: `notes`) para evitar HTML injection no PDF.

- **Retenção & Expiração**

  - Job diário (worker) para **marcar `expired`** e opcionalmente **apagar** artefatos cujo `expires_at < now()` (configurável).
  - Em produção, armazenar em **S3**; local mantém em `artifacts/`.

---

#### Testes

- **Unit**

  - `test_content_hash_idempotent`: mesmo payload → mesmo `content_hash`.
  - `test_markdown_sanitizer`: remove `<script>`, preserva `p/h1/a/ul/...` whitelisted.
  - `test_evidence_selection`: escolhe `googlebot` de preferência, fallback p/ `chrome`.

- **Integration (sem rede)**

  - `prepare`: retorna `html` e grava `index.html`.
  - `generate`:

    - 1ª chamada → cria PDF/ZIP e registro `appeals`.
    - 2ª chamada (payload idêntico) → **no-op** (retorna o mesmo registro/paths).

  - Verificar `zipfile` contém os arquivos esperados e que `pdf` tem tamanho > 0.

- **Smoke**

  - Pipeline local com 2 violações (uma `fixed`, uma `open`) gera pacote e lista em `/appeals`.

---

#### DoD

- `prepare` fornece **prévia HTML** sanitizada e `content_hash`.
- `generate` produz **PDF** e **ZIP** com **evidências reais** (screenshots/HTML/JSON) e TTL aplicado.
- Repetir `generate` com o **mesmo payload** **não** duplica artefatos (idempotência por `content_hash`).
- Rotas documentadas no **OpenAPI.md**; RBAC e rate-limit ativos; logs estruturados por job.

---

#### Validações (CLI)

- **Prepare**:

  ```bash
  TOKEN=...
  API=http://localhost:8000
  SID=1
  curl -s -X POST "$API/api/v1/stores/$SID/appeals/prepare" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d @- <<'JSON' | jq '{hash:.content_hash, html_len:(.html|length)}'
  {
    "locale": "pt-BR",
    "title": "Recurso de Conta — Loja X",
    "violations": [
      {"feed_item_id":"SKU-001","rule_code":"PRICE_MISSING","snapshot_id":123,"fixed":true,"notes":"Corrigido no feed"},
      {"feed_item_id":"SKU-010","rule_code":"SD_ABSENT","snapshot_id":124,"fixed":false}
    ],
    "contact": {"name":"Fulano","role":"Owner","email":"owner@lojax.com"}
  }
  JSON
  ```

- **Generate**:

  ```bash
  curl -s -X POST "$API/api/v1/stores/$SID/appeals/generate" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d @payload.json | jq '{id, content_hash, pdf:.pdf_path, zip:.zip_path, expires_at}'
  ```

- **Listar**:

  ```bash
  curl -s "$API/api/v1/stores/$SID/appeals" -H "Authorization: Bearer $TOKEN" | jq .
  ```

- **FS**:

  ```bash
  HASH=... # do retorno
  ls -l artifacts/store$SID/appeals/$HASH/
  ```

---

#### Variáveis de Ambiente (adicionar ao `.env.example`)

- `APPEALS_TTL_DAYS=7`
- `APPEAL_PDF_ENGINE=playwright` # opções: playwright|weasyprint
- `PLAYWRIGHT_HEADLESS=true`
- `ARTIFACTS_BASE=artifacts` # raiz local (S3 em prod usa vars próprias)
- **Produção (S3, se aplicável)**:

  - `S3_BUCKET=...`
  - `S3_PREFIX=appeals/`
  - `AWS_ACCESS_KEY_ID=...`
  - `AWS_SECRET_ACCESS_KEY=...`
  - `AWS_REGION=...`

---

#### Observabilidade

- Log por geração:
  `{store_id, appeal_id?, content_hash, violations_count, duration_ms, pdf_ok, zip_ok, error?}`
- Métrica de contagem/tamanho médio de ZIP/PDF; taxa de acerto de idempotência.

---

> Nota: reutilize sua estrutura de snapshots (T4) e de regras (T5) para preencher `evidence/` e o sumário na carta. Documente exemplos no `README.md`/`CLI-CHEATSHEET.md` e garanta que o **OpenAPI.md** seja atualizado pelo CI.

---

### T9 — Notificações & Scheduler

**Objetivo**

Automatizar **re-scan leve**, **digest de violações** e **atualização do suplemento**, entregando alertas por **e-mail** e **in-app**, com preferências por loja/usuário, **idempotência**, **backoff** e **observabilidade**.

---

#### Escopo

- **Scheduler (worker)**

  - APScheduler (ou cron interno) com 3 jobs:

    1. `daily_rescan(store_id)` — seleciona _N_ itens recentes/afetados e dispara `scan`.
    2. `daily_digest(store_id)` — compila resumo de violações novas/abertas/fechadas nas últimas 24h/7d.
    3. `supplemental_refresh(store_id)` — regenera feed suplemental se `blocks` mudou.

  - Janela por _timezone_ da loja (default global). Jitter de ±5min para evitar thundering herd.
  - **Manual trigger** para testes: `POST /api/v1/ops/scheduler/run-now?job=daily_digest&store_id=...`.

- **Canais**

  - **E-mail** (provedor “console” em dev → grava `.eml` em `artifacts/emails/`; **SES/Sendgrid** em produção).
  - **In-app**: caixa de notificações por usuário.

- **Templates & Conteúdo**

  - Diretório `api/templates/notifications/`:

    - `digest_email.{pt-BR|es-ES|en-US}.md.j2`
    - `digest_inapp.{locale}.md.j2`

  - Placeholders: `store`, `period`, `counts {new, open, fixed}`, `top_rules[]`, `examples[]`, links (dashboard, evidence).

- **Persistência (novas tabelas)**

  - `notification_events`

    ```
    id PK, store_id, user_id NULL, channel TEXT, type TEXT, locale TEXT,
    title TEXT, body_md TEXT, payload_json TEXT,
    dedupe_key TEXT,                -- p/ idempotência (ex.: digest:{store}:{yyyymmdd})
    status TEXT DEFAULT 'queued',   -- queued|sent|failed|skipped
    attempts INT DEFAULT 0,
    next_attempt_at TIMESTAMPTZ,
    last_error TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    sent_at TIMESTAMPTZ
    ```

    Índices: `(store_id, created_at DESC)`, `(dedupe_key UNIQUE)`.

  - `notification_preferences`

    ```
    id PK, store_id, user_id NULL,
    channel TEXT,                   -- email|inapp
    enabled BOOLEAN DEFAULT true,
    quiet_hours JSONB NULL,         -- ex.: {"start":"22:00","end":"07:00","tz":"America/Sao_Paulo"}
    locale TEXT NULL,               -- preferida
    created_at, updated_at
    ```

  - **In-app state** (separado ou na mesma): `notifications_inapp`

    ```
    id PK, store_id, user_id, type, title, body_md, payload_json,
    read_at TIMESTAMPTZ NULL, created_at TIMESTAMPTZ DEFAULT now()
    ```

    Índices: `(user_id, created_at DESC)`, `(store_id, created_at DESC)`.

- **API (v1)**

  - In-app:

    - `GET  /api/v1/notifications?store_id=&page=&limit=` — lista (paginado).
    - `POST /api/v1/notifications/{id}/read` — marca como lida.
    - `POST /api/v1/notifications/read-all` — marca todas como lidas (do usuário, opcional `store_id`).

  - Preferências:

    - `GET  /api/v1/notifications/preferences?store_id=` — retorna preferências efetivas (merge org/loja/usuário).
    - `PUT  /api/v1/notifications/preferences` — altera (ex.: desabilitar e-mail, definir `quiet_hours`).

  - Ops (admin/dev):

    - `POST /api/v1/ops/scheduler/run-now` — dispara job (protegido por RBAC `owner|admin` + rate-limit).

- **Entrega & Backoff**

  - Worker `notifier`:

    - Puxa `notification_events` com `status IN ('queued','failed') AND now() >= next_attempt_at`.
    - Envia por provedor selecionado; atualiza `status`/`sent_at`.
    - Backoff exponencial com jitter: 1m, 5m, 15m, 1h (máx. 5 tentativas).
    - **Idempotência**: `dedupe_key` por (tipo+janela+store) evita múltiplos digests iguais.
    - Respeita `quiet_hours` (defer para `next_attempt_at`).

- **Opt-out / Opt-in**

  - Por _store_ e _channel_ (e-mail/in-app). UI simples no Settings.
  - Defaults habilitados; honor `quiet_hours`.

- **Rate-limit & Segurança**

  - `ops/scheduler/run-now`: 10/min por usuário.
  - E-mail: 60/min global (configurável).
  - Todos os endpoints com RBAC e logs estruturados.

---

#### Testes

- **Unit**

  - `test_digest_dedupe_key`: mesma janela → mesmo `dedupe_key`, não duplica evento.
  - `test_quiet_hours_deferral`: eventos criados em horário silencioso são adiados.
  - `test_backoff_schedule`: `attempts` evolui com `next_attempt_at` correto.
  - `test_preferences_merge`: preferências efetivas respeitam overrides do usuário.

- **Integration (sem rede)**

  - Provedor “console”: gera `.eml` em `artifacts/emails/` e marca `sent`.
  - `run-now` → cria `notification_events` → worker envia → in-app criado e e-mail escrito.

- **Smoke**

  - Scheduler diário (clock avançado) cria 1 digest/loja; UI lista in-app; `.eml` existe.

---

#### DoD

- Jobs **diários** criam:

  - Re-scan leve enfileirado por loja.
  - Digest com contagens reais e exemplos de violações, enviado por **e-mail** (dev: `.eml`; prod: SES/Sendgrid) e **in-app**.
  - Suplemento atualizado quando `blocks` mudar.

- `notification_events` mostra **idempotência** (1 digest por janela/loja) e **backoff**.
- Preferências/quiet hours aplicadas; **opt-out** respeitado.
- Métricas e logs estruturados disponíveis.

---

#### Validações (CLI)

```bash
# Disparar digest manual (dev)
TOKEN=...; API=http://localhost:8000; SID=1
curl -X POST "$API/api/v1/ops/scheduler/run-now" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"job":"daily_digest","store_id":'$SID'}' | jq .

# Ver in-app
curl "$API/api/v1/notifications?store_id=$SID&limit=10" -H "Authorization: Bearer $TOKEN" | jq .

# Ver “envio” de e-mail (provedor console)
ls -l artifacts/emails/ | tail -n 5
```

---

#### Variáveis de Ambiente (adicionar ao `.env.example`)

- **Scheduler**

  - `SCHED_DEFAULT_TZ=America/Sao_Paulo`
  - `SCHED_DAILY_RUN_HOUR=9` # hora local da loja (aproximação)
  - `SCHED_JITTER_MINUTES=5`
  - `DAILY_RESCAN_LIMIT=25`

- **E-mail**

  - `EMAIL_PROVIDER=console` # console|ses|sendgrid
  - `EMAIL_FROM="GMC Shield <no-reply@gmcshield.dev>"`
  - `SES_REGION=...` `SES_ACCESS_KEY_ID=...` `SES_SECRET_ACCESS_KEY=...`
  - `SENDGRID_API_KEY=...`

- **In-app**

  - `INAPP_TTL_DAYS=30`

- **Rate-limits**

  - `RATE_LIMIT_OPS_RUNNOW_PER_MIN=10`
  - `EMAIL_RATE_PER_MIN=60`

---

#### Observabilidade

- **Logs (JSON)** por evento:
  `{ts, level, job, store_id, event_id, channel, type, dedupe_key, attempts, sent, error?}`
- **Métricas (`/api/ops/metrics`)**

  - `notifications_sent_total{channel=...}`
  - `notifications_failed_total{channel=...,reason=...}`
  - `digest_created_total`
  - `rescan_enqueued_total`
  - Latência média de envio por provedor.

---

#### Notas de Implementação

- Provedor de e-mail via **strategy pattern** (`email_provider=console|ses|sendgrid`).
- `dedupe_key` sugerido: `digest:{store_id}:{period_start}:{period_end}`.
- Conteúdo do digest: mostrar **TOP 3 regras** e **até 5 itens exemplo** com links para o viewer (T10).
- `quiet_hours`: se janela atravessa meia-noite, tratar corretamente (comparação por TZ).

---

### T10 — Dashboard & Evidence Viewer

**Objetivo**

Tornar os achados **acionáveis e claros**: KPIs confiáveis, lista de violações rápida (server-side), e **viewer de evidências** (screenshot/HTML/JSON-LD) com ações rápidas.

---

#### Escopo

##### 1) Backend / API (v1)

- **KPIs (cacheáveis)**

  - `GET /api/v1/stores/{store_id}/dashboard/kpis?window=24h|7d`
    Retorna:

    ```json
    {
      "window": "24h",
      "violations": { "new": 12, "open": 87, "fixed": 5 },
      "blocked_items": 14,
      "policies": {
        "privacy": "published|missing",
        "refund": "published|missing",
        "shipping": "published|missing"
      },
      "top_rules": [
        { "rule_code": "SD_ABSENT", "count": 51 },
        { "rule_code": "PRICE_MISSING", "count": 33 }
      ],
      "updated_at": "2025-01-01T12:00:00Z"
    }
    ```

  - Cache em Redis por **60s** (chave: `kpis:{store}:{window}`).

- **Lista de Violações (server-side)**

  - **Alias v1** para não quebrar legado:

    - **Novo**: `GET /api/v1/stores/{store_id}/violations`

      - Query params:
        `page=1&limit=50&sort=created_at.desc&rule=RULE_CODE&severity=critical|major|minor&status=open|fixed&sku=...&q=...&from=&to=`
      - Resposta:

        ```json
        {
          "items": [
            {
              "id": 123,
              "feed_item_id": "SKU-001",
              "rule_code": "SD_ABSENT",
              "severity": "major",
              "created_at": "...",
              "status": "open",
              "title": "Tênis X",
              "url": "https://...",
              "last_http_status": 200
            }
          ],
          "page": 1,
          "limit": 50,
          "total": 5342
        }
        ```

      - **Sem N+1**: JOIN com `feed_items` e subselect do último snapshot.

- **Viewer de Evidências**

  - `GET /api/v1/stores/{store_id}/violations/{id}` → detalhes + último snapshot:

    ```json
    {
      "violation":{"id":123,"rule_code":"SD_ABSENT","severity":"major","status":"open","created_at":"..."},
      "item":{"feed_item_id":"SKU-001","title":"Tênis X","url":"https://..."},
      "snapshot":{
        "fetched_at":"...","http_status":200,
        "screenshot_url":"https://signed-url/png","html_url":"https://signed-url/html",
        "html_snippet":"<h1>...</h1>",
        "structured_data":{"@type":"Product", ...}
      }
    }
    ```

  - `GET /api/v1/stores/{store_id}/items/{feed_item_id}/timeline?limit=10` → últimos snapshots (para histórico).
  - **URLs de artefato** sempre **assinadas** (S3/minio) com TTL (ex.: 10 min).

- **Ações rápidas**

  - `POST /api/v1/stores/{store_id}/violations/{id}/mark-fixed`
  - `POST /api/v1/stores/{store_id}/blocks` `{feed_item_id, reason?}`
  - **RBAC**: `owner|admin|analyst` pode agir; `viewer` só leitura.

##### 2) Banco / Índices

- `violations`

  - Índices:
    `(store_id, created_at DESC)`, `(store_id, rule_code, created_at DESC)`, `(store_id, severity, created_at DESC)`, `(store_id, feed_item_id, created_at DESC)`.

- `page_snapshots`

  - Índices: `(store_id, feed_item_id, fetched_at DESC)`, `(store_id, run_id)`.
  - **Último snapshot por item** via subselect:

    ```sql
    SELECT DISTINCT ON (feed_item_id) *
    FROM page_snapshots
    WHERE store_id = :sid
    ORDER BY feed_item_id, fetched_at DESC;
    ```

- `feed_items`

  - Garantir `INDEX (store_id, item_id)` e `INDEX (store_id, title)` para `q` básico.

##### 3) Performance & Cache

- KPIs: Redis **60s**.
- Lista: `LIMIT/OFFSET` com índices acima → alvo **≤1s** para **5k** linhas.
  Futuro (>50k): avaliar **keyset pagination**.
- **Campos projetados**: só o necessário na listagem; detalhes no endpoint do viewer.
- **Evitar N+1**: subqueries e JOINs bem indexados.

##### 4) Frontend (React)

- **Dashboard.jsx**

  - **Cards**: `Violations 24h/7d`, `Blocked`, `Policies`.
  - **Top Rules**: bar list simples com link aplicando filtro na tabela.
  - **Auto refresh** leve (60s) com “Updated Xs ago”.

- **Violations.jsx**

  - **Filtro** (rule, severity, status, date range, SKU, q).
  - **Tabela**:

    - Server-side pagination (`page,limit,sort`).
    - **Virtualização** (react-window) para fluidez.
    - Colunas: Rule ⟂ Sev ⟂ SKU ⟂ Title ⟂ HTTP ⟂ Created ⟂ Ações.
    - Clique abre **Evidence Modal**.

  - **Empty/Erro** states claros; **skeleton loading**.

- **Evidence Modal**

  - Abas: **Screenshot** (img responsiva), **HTML snippet** (code viewer), **JSON-LD** (pretty).
  - Links: **Abrir página**, **Baixar HTML**, **Ver imagem original** (presigned).
  - Ações: **Mark as fixed**, **Block item**, **Open policies**.
  - **Teclado**: `Esc` fecha; foco retorna à linha.

- **A11y & i18n**

  - Roles/aria em modal e tabela, contraste, focus ring.
  - Textos via i18n (pt-BR/es-ES/en-US).

##### 5) Segurança

- **URLs presign** com TTL curto, **scoped** ao store.
- **CSP** restrita no viewer (sem inline).
- **RBAC** rigoroso nas ações; **rate-limit** suave no viewer.
- **Audit log** para ações (fix/block) com `user_id`.

##### 6) Observabilidade

- Logs **JSON**:

  - `kpi.query_ms`, `violations.query_ms`, `viewer.presign_ms`, `store_id`, `user_id`, `page`, `limit`.

- `/api/ops/metrics`:

  - `dashboard_kpi_requests_total`, `violations_list_requests_total`, `evidence_presign_total`, histogram de duração.

##### 7) Variáveis (.env.example)

- `DASHBOARD_KPI_CACHE_TTL=60`
- `DASHBOARD_DEFAULT_WINDOW=24h`
- `VIOLATIONS_DEFAULT_PAGE_SIZE=50`
- `ARTIFACTS_PRESIGN_TTL=600` # segundos
- `ARTIFACTS_PUBLIC_BASE=` # se servir direto (dev)
- `S3_BUCKET=... S3_REGION=...` # se presign S3/minio

---

#### DoD

- **KPIs** retornam em <300ms com cache quente; exibidos na UI.
- **Lista** de violações responde **≤1s** com **5k** registros; filtros e ordenação funcionam.
- **Viewer** mostra screenshot/HTML/JSON-LD com URLs assinadas e ações rápidas operando (RBAC ok).
- **Logs/Métricas** coletam latências e contadores principais.

---

#### Validações (CLI)

```bash
API=http://localhost:8000; TOKEN=...

# KPIs
curl -s "$API/api/v1/stores/1/dashboard/kpis?window=24h" -H "Authorization: Bearer $TOKEN" | jq .

# Lista (página 1)
curl -s "$API/api/v1/stores/1/violations?limit=50&sort=created_at.desc" -H "Authorization: Bearer $TOKEN" | jq '.total,.items[0]'

# Detalhe + evidências (troque :id)
curl -s "$API/api/v1/stores/1/violations/123" -H "Authorization: Bearer $TOKEN" | jq '.snapshot | {http_status, screenshot_url, html_url}'
```

---

#### Testes

- **Unit (API)**

  - `test_kpis_cache_key_and_ttl`
  - `test_violations_filters_and_sort`
  - `test_viewer_presign_ttl_and_scope`

- **Query perf (integração)**

  - Seed 5k violações → medição de `query_ms` ≤1s.

- **Web (e2e leve)**

  - Abrir Dashboard → ver cards.
  - Filtrar violações → abrir modal → checar abas e botões.

---

### T11 — Crawler Performance & Resiliência

**Objetivo**

Escalar o crawling **sem sobrecarregar hosts** e com **estabilidade** (limites por domínio, retry com backoff, breaker e cache condicional).

---

#### Escopo

##### 1) Rate-limit por **domínio** (token bucket em Redis) + filas por host

- **Bucket** (Redis):

  - Chave: `rl:{host}` → `{tokens:int, refill_rate:float, last_refill_ts}`.
  - Variáveis:

    - `CRAWL_RL_TOKENS_PER_HOST=5` (cap máx por domínio).
    - `CRAWL_RL_REFILL_PER_SEC=1.0` (ex.: 1 req/s/host).

  - Algoritmo:

    1. `now = time()` → repõe `tokens += (now - last_refill_ts) * refill_rate` (clamp a `TOKENS_PER_HOST`).
    2. Se `tokens >= 1` → consome `1` e **permite**; senão, **retentar** depois de `ceil((1 - tokens)/refill_rate)` ms.

- **Filas por host** (RQ):

  - Nome da fila: `crawl:{host}` além de `crawl` global (ou roteamento por host).
  - **Máx concorrência** por host: 1–2 workers (controlado via mapeamento host→fila ou via semáforo Redis `sema:{host}`).

- **Hard cap** de páginas ativas por processo:

  - `CRAWL_MAX_PAGES=4` (Playwright contexts/abas simultâneas).

##### 2) Retry com **backoff exponencial + jitter**

- Tentar **até 3** vezes para erros transitórios: `ECONNRESET`, `ETIMEDOUT`, DNS `ERR_NAME_NOT_RESOLVED` (1º pedido pode falhar em dev), 5xx.
- Backoff: `base=0.5s`, `max=15s`, `jitter=uniform(0,0.3s)` → `sleep = min(base*2^n + jitter, max)`.
- **RQ requeue**: preferir retry no **próprio job** (sem criar novas filas) para manter dedupe e métricas do mesmo `job_id`.

##### 3) **Circuit breaker** por host

- Estados: `CLOSED` → `OPEN` → `HALF_OPEN`.
- Redis:

  - `cb:{host}` → `{state, fail_count, last_fail_ts, opened_ts}`.
  - Abrir (`OPEN`) se **≥ N falhas** em **M segundos** (`CRAWL_CB_FAILS=5`, `CRAWL_CB_WINDOW=60s`).
  - `HALF_OPEN` após `CRAWL_CB_COOLDOWN=120s` (permite **K** tentativas de _probe_, ex.: `K=1..3`).
  - Fecha (CLOSED) se probe **sucede**; volta a abrir se **falha**.

- Ao detectar `OPEN`: **pular** jobs do host com status `skipped="circuit_open"`, re-enfileirar para `+cooldown`.

##### 4) **Cache** 24h por URL (condicional por ETag/Last-Modified)

- Metadados (Redis):

  - `mc:{ua}:{url}` → `{etag, last_mod, last_ok_ts, artifact_ptr}` (p/ reutilizar snapshot).
  - TTL de metadados: `CRAWL_CACHE_TTL=86400`.

- **Pré-checagem HEAD** com `httpx` (barata):

  - Se temos `etag/last_mod` → mandar `If-None-Match` / `If-Modified-Since`.
  - Se **304** → **reusar** último snapshot (`artifact_ptr`) e gravar `page_snapshots` com `from_cache=true` (sem abrir browser).
  - Se **200** (mudou) → seguir com Playwright.
  - Se o host **não** manda `etag/last-modified`:

    - Respeitar TTL mínimo (`min_ttl_per_url`, ex.: 6h) para não recapturar com muita frequência (a menos que `recrawl=true`).

- **Escopo por UA**: chave inclui `ua` (chrome/googlebot) para evitar erro de conteúdo diferenciado.

##### 5) **Timeouts** e **orçamentos** (budget)

- `CRAWL_NAV_TIMEOUT_MS=30000` (Playwright `goto(waitUntil="domcontentloaded")`).
- **Budget por job**: `CRAWL_JOB_BUDGET_MS=45000` (soma navegação + extrações). Se exceder → **cancelar** com razão `budget_exceeded`.
- **Abort controller**: cancelar interceptores e requests de assets pesados (vídeo, fontes, analytics) para acelerar.

##### 6) **Dedupe** & ordenação

- **Dedupe key** por job: `crawl:{store_id}:{run_id}:{feed_item_id}:{ua}` com TTL (evita duplicados).
- Ordenar itens por host → intercalar hosts diferentes (fair scheduling).

##### 7) Observabilidade & métricas

- **Logs JSON** por job:

  ```json
  {
    "ts": "...",
    "level": "info",
    "msg": "crawl.done",
    "store_id": 5,
    "run_id": 37,
    "feed_item_id": "SKU-001",
    "ua": "googlebot",
    "host": "example.com",
    "url": "https://...",
    "http_status": 200,
    "duration_ms": 1432,
    "retries": 1,
    "from_cache": false,
    "circuit": "CLOSED"
  }
  ```

- `/api/ops/metrics` (contadores/histogramas):

  - `crawl_requests_total{host,ua,status}`
  - `crawl_retry_total{reason}`
  - `crawl_circuit_open{host}`
  - `crawl_cache_hits_total{ua}`
  - `crawl_duration_ms_bucket`

- **Dash interno** (simples): top hosts com mais falhas/tempo médio.

##### 8) Segurança / Boas práticas

- Respeitar `robots.txt` **opcional/flag** (`CRAWL_RESPECT_ROBOTS=true`) com _allowlist_ interna para domínios de teste.
- Identificar UA verdade (não se passar por Googlebot em produção).
- Rate-limit conservador por padrão; configurações por host (override via DB/Redis se necessário).

##### 9) Variáveis (.env.example)

```ini
CRAWL_RL_TOKENS_PER_HOST=5
CRAWL_RL_REFILL_PER_SEC=1.0
CRAWL_MAX_PAGES=4

CRAWL_RETRY_MAX=3
CRAWL_RETRY_BASE=0.5
CRAWL_RETRY_MAX_SLEEP=15

CRAWL_CB_FAILS=5
CRAWL_CB_WINDOW_SEC=60
CRAWL_CB_COOLDOWN_SEC=120
CRAWL_CB_PROBES=2

CRAWL_CACHE_TTL=86400
CRAWL_MIN_TTL_NO_VALIDATORS_SEC=21600

CRAWL_NAV_TIMEOUT_MS=30000
CRAWL_JOB_BUDGET_MS=45000

CRAWL_RESPECT_ROBOTS=false
```

---

#### DoD

- **Carga 100 URLs** do **mesmo domínio**:

  - **Sem rajada**: taxa real ≈ `refill_rate` (1 req/s/host de exemplo).
  - **Sem 429/ban** visível nos logs.

- **Falhas intermitentes** → driver faz **retry** (até 3) com backoff + jitter (e logs).
- **Breaker**: após N falhas em M s, host entra `OPEN`; depois `HALF_OPEN` e **fecha** ao primeiro sucesso.
- **Cache**:

  - URLs com `ETag/Last-Modified` retornam **304** e o job **reusa snapshot** (contabiliza `from_cache=true`).
  - Para URLs sem validadores, não recrawlear antes do TTL mínimo salvo `recrawl=true`.

---

#### Validações (CLI / prática)

```bash
# 1) Semear 100 URLs do mesmo domínio na fila (mock ou host local)
STORE=5; RUN=$(date +%s)
# (use sua rota de scan com limit=100; certifique-se que apontam para o mesmo host)

# 2) Acompanhar logs: ver consumo do bucket e ausência de rajadas
docker compose logs -f rq-crawl | grep -E 'crawl\.(allowed|wait_rl|done|retry|circuit)'

# 3) Métricas (se expostas em /api/ops/metrics)
curl -s http://localhost:8000/api/ops/metrics | grep crawl_

# 4) Cache: primeiro run → hit baixo; segundo run imediato → ver 'from_cache=true' crescer
# (ou conferir Redis: keys mc:{ua}:{url})

# 5) Breaker: forçar erros (host off) → observar 'circuit=OPEN'; religar → ver 'HALF_OPEN' → 'CLOSED'
```

---

#### Testes

- **Unit**

  - `test_token_bucket_refill_and_consume()` (simula avanço de tempo).
  - `test_backoff_with_jitter_bounds()` (limites e monotonicidade).
  - `test_circuit_transitions_closed_open_halfopen_closed()`.
  - `test_cache_headers_304_reuse_snapshot()` e `test_cache_ttl_no_validators()`.

- **Integração (mock/fixture de host)**

  - 100 URLs / mesmo host → medir throughput respeitando `refill`.
  - Induzir `ECONNRESET` aleatório (p.ex. 20%) → verificar retries e sucesso final ≥80%.
  - Desligar host por 2 min → `OPEN`; religar → `HALF_OPEN` e fechamento.

- **Regressão**

  - Garantir que dedupe por `(store,run,item,ua)` impede duplicidade de snapshots.
  - Budget: simular página lenta (>budget) → job aborta com `budget_exceeded`.

---

#### Notas de implementação

- **Pré-HEAD condicional** com `httpx` antes do Playwright reduz custo; se **304**, não abrir o navegador.
- **Interceptores Playwright**: bloquear assets pesados (`.mp4`, fonts, trackers) para reduzir tempo/CPU.
- **Persistência de metadados** (ETag/LM/ptr) pode morar no Redis; ponte com DB: gravar `page_snapshots` com flag `from_cache`.
- **Operacional**: flags por host (overrides) via `ops` simples (ex.: `redis hset host:{host} rl_refill 0.5`).

---

### T12 — Segurança Base + RBAC

**Objetivo**

Endurecer a superfície do SaaS antes de integrações externas e GTM, cobrindo **RBAC**, **rate-limit (incl. OAuth/Google)**, **auditoria** e **headers de segurança**.

---

#### Escopo

##### 1) RBAC completo

- Aplicar `Depends(require_roles(...))` em rotas sensíveis:

  - Feeds/scan/blocks/policies/violations.
  - **Google MC**: `/api/google/mc/*` exigem **usuário autenticado** e, quando aplicável, **loja vinculada** (checar `store_id` ou vínculo na conta).

- Perfis: `owner|admin|analyst|viewer` (leitura/escrita conforme já definido).
- Rotas de **OAuth start/callback** são públicas, mas auditadas e com rate-limit.

##### 2) Rate-limit (inclui OAuth/Google)

- Implementar limiter (ex.: `slowapi` ou middleware próprio com Redis sliding window) com chaves e limites:

  - `GET /api/auth/google/start*` e `/api/auth/google/callback`
    **10 req/min por IP** (`key = ip`).
  - `GET /api/google/mc/*`
    **60 req/min por User+Store** (`key = f"{user_id}:{store_id or '-'}"`).
  - Manter limites existentes em `auth/ingest/scan` (mín. 10–30 req/min por usuário).

- Resposta em excesso: **HTTP 429** com `Retry-After`.

##### 3) Audit log (inclui eventos OAuth)

- Registrar em **log estruturado** (e/ou tabela `audit_logs`) os eventos:

  - `oauth_start`, `oauth_callback`, `mc_accounts`, `mc_products`.

- Campos mínimos: `event`, `route`, `status`, `user_id?`, `ip`, `dt`, `request_id`, `trace_id`, `errors?`, `extras?` (ex.: `state_id`, `merchant_id`).
- **Nunca** logar tokens ou `code`/`refresh_token` em texto claro.

##### 4) Headers & cookies de segurança

- **CORS**: `allow_origins` estrito (domínios da sua UI); `allow_credentials=true` somente se necessário.
- **CSP** (exemplo mínimo; ajustar conforme a UI):

  ```
  default-src 'self';
  connect-src 'self' https://www.googleapis.com https://oauth2.googleapis.com;
  img-src 'self' https://*.googleusercontent.com data:;
  frame-ancestors 'none';
  frame-src https://accounts.google.com;
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  ```

- **Cookies** (se JWT em cookie): `HttpOnly`, `Secure`; `SameSite=Lax` (ou `None` + `Secure` para cenários cross-site).
- Outros: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`.

##### 5) Operacional & segredos

- `.env.example` atualizado com chaves de limites e política de segurança (ver abaixo).
- Rotação periódica de chaves (JWT/fernet).
- Sanitização de logs (nada de PII sensível/tokens).

---

#### Variáveis de ambiente (adicionar ao `.env.example`)

```ini
# Rate-limit
RATE_LIMIT_OAUTH_START=ip:10/m
RATE_LIMIT_OAUTH_CALLBACK=ip:10/m
RATE_LIMIT_GOOGLE_MC=user_store:60/m
RATE_LIMIT_AUTH_PASSWORD=ip:10/m

# Security headers
SECURITY_CSP="default-src 'self'; connect-src 'self' https://www.googleapis.com https://oauth2.googleapis.com; img-src 'self' https://*.googleusercontent.com data:; frame-ancestors 'none'; frame-src https://accounts.google.com; script-src 'self'; style-src 'self' 'unsafe-inline';"
SECURITY_XFO=DENY
SECURITY_REFERRER=strict-origin-when-cross-origin

# Cookies (se usar cookie p/ JWT)
SESSION_COOKIE_SECURE=true
SESSION_COOKIE_SAMESITE=Lax
```

---

#### DoD

- Exceder limites em:

  - `/api/auth/google/start*` e `/callback` → **429** consistente por IP.
  - `/api/google/mc/*` → **429** por **User+Store**.

- Usuário **sem permissão** não acessa rotas protegidas (403/401 conforme caso).
- **Audit log** mostra trilha completa: `oauth_start` → `oauth_callback` → `mc_accounts`/`mc_products` (com `request_id/trace_id`).
- **Headers** de segurança presentes nas respostas (CSP/CORS/XFO/etc.).
- Nenhum token sensível em logs.

---

#### Testes

- **Unit/integration (sem rede)**:

  - Rate-limit: simular estouro → verificar **429** e `Retry-After`.
  - RBAC: tabelar cenários (viewer/analyst/admin) em `/api/google/mc/*`.
  - Audit: asserts de presença de eventos com campos mínimos.
  - Headers: validar CSP/CORS/XFO em responses de rotas públicas e autenticadas.

- **Smoke manual**:

  - Rodar `hey`/`ab` contra `/api/auth/google/start` acima do limite → 429.
  - Acessar `/api/google/mc/accounts` sem JWT → 401; com JWT mas sem loja → 403; com loja → 200.

---

#### Cross-cutting (rápidos)

- **Migrations**: (se ainda não feitas) criar `google_accounts` e pivô (se multi-merchant por usuário).
- **Crypto**: reutilizar `crypto.py` para `access_token_enc`/`refresh_token_enc`.
- **Docs**:

  - Atualizar `README.md` e `CLI-CHEATSHEET.md` com endpoints OAuth/MC e notas de rate-limit.
  - Seção “Variáveis de ambiente (OAuth/Google & Segurança)” com tabela/descrição.

---

> Próximo arquivo: **T13–T20** (Fase 2 — Confiabilidade & Produto).

### T4 — Rules Engine & Policy Mapping

Consumo e avaliação de regras de conformidade (parcialmente simuladas hoje). Detalhes e critérios em `docs/issues/T04-Rules-Engine-Policy-Mapping.md`.

