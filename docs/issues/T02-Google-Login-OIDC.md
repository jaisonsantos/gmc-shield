# T2 — Google Login (OIDC) — Sessão do SaaS
**Tipo:** feature • **Labels:** auth, oidc, oauth, google, security • **Prioridade:** P0

## Descrição
Implementar login “Continuar com Google” usando OIDC Authorization Code + PKCE, sem solicitar o escopo do Merchant Center. Persistir conta Google vinculada ao usuário local, com segurança (criptografia de refresh token) e testes mockados (sem rede). Rotas devem aparecer no OpenAPI.

## Escopo
- Variáveis de ambiente e `.env.example` atualizados (client id/secret, redirect, issuer, scopes base, endpoints overrideáveis).
- PKCE + `state` (+ `nonce` opcional) com TTL em Redis, chaves consumidas após uso.
- Endpoints:
  - `GET /api/auth/google/start?return_to=/path` → `{ auth_url }` (PKCE + state)
  - `GET /api/auth/google/callback?state&code` → cria/associa usuário, emite JWT, upsert `google_accounts`
- Modelo/Migração `google_accounts` (sub único, tokens criptografados, `content_scope_granted=false`).
- Rate-limit leve em start/callback; redirect whitelist; CORS/CSP compatíveis.
- Logs JSON e eventos (`oauth.start`, `oauth.callback.ok|error`).
- OpenAPI inclui as rotas.
- Testes unitários e de integração mockada (`respx`) sem rede.

## Critérios de Aceite
- [x] `/api/auth/google/start` retorna `auth_url` com PKCE + `state` válido (TTL).
- [x] `/api/auth/google/callback` autentica, cria/associa usuário e retorna JWT da app.
- [x] `google_accounts` populado/atualizado; `refresh_token_enc` criptografado (se houver) e nunca sobrescrito por `NULL`.
- [x] Chaves Redis de `state`/`pkce`/`nonce` são expiradas/consumidas corretamente.
- [x] OpenAPI contém as rotas de OAuth.
- [x] Testes offline (mockados) presentes (`respx`) para start/callback.
- [x] Rate-limit e redirect whitelist ativos; nenhum token sensível em localStorage (token fica em memória na UI).
- [x] Logs JSON mostram eventos e `trace_id` (`oauth.start`, `oauth.callback.ok|error`).

## Implementação/Notas

- Rotas implementadas em `api/app/routers/oauth_google.py`.
- PKCE + `state` + `nonce` armazenados no Redis com TTL (300s), consumidos no callback.
- Eventos estruturados via `log_event`: `oauth.start`, `oauth.callback.ok|error` (com `trace_id`).
- `google_accounts` (rev. `0010_google_accounts`) com `sub` único; `access_token_enc`/`refresh_token_enc` criptografados via Fernet.
- `return_to`:
  - UI envia `return_to=/login` ao iniciar o fluxo.
  - Backend infere `return_to` quando ausente usando o header `Origin` (ex.: `http://localhost:5173/login`).
  - Whitelist: URLs absolutas só são aceitas se o host estiver em `ALLOWED_ORIGINS`/`CORS_ORIGINS`.
- Endpoints AnyHttpUrl convertidos para `str` ao usar `httpx` (evita `TypeError: pydantic_core.Url`).
- Rate‑limit leve por IP em start/callback (Redis) com 429 ao exceder.

### Migrações
- `0008a_widen_av`: amplia `alembic_version.version_num` para `VARCHAR(128)` e evita erro em IDs longos.
- `0009_feed_versions_unique_constraint`: passa a depender de `0008a` (cadeia linear).
- `0010_google_accounts`: cria a tabela de contas Google.

### DX / Infra
- Alembic carrega `.env` automaticamente em `api/alembic/env.py`.
- Compose executa `python -m alembic ... && python -m uvicorn ...` (sem depender de binários).
- Dockerfile define `PYTHONPATH=/opt/pydeps/...` para o runtime encontrar dependências.

### Segurança
- URLs & endpoints Google sem aspas no `.env`.
- `FERNET_KEY` obrigatória; use `FERNET_KEYS` apenas para rotação (nova primeiro, antigas depois).
- Cookie `token` `httponly` + `samesite=lax` no callback; token também retornado via querystring para a UI consumi‑lo e armazenar apenas em memória.
- Sessão da app: tempo configurável por `SESSION_TTL_MINUTES` (default 480 = 8h). A UI agora trata 401 com redirecionamento gentil para `/login` em vez de exibir "Invalid token".

## Como testar (dev)

1) Docker: `docker compose up -d db redis api` (ou `worker`/`rq-feed` opcional).
2) Preencha `.env` com `GOOGLE_CLIENT_ID/SECRET` e `GOOGLE_OAUTH_REDIRECT_URI=http://localhost:8000/api/auth/google/callback`.
3) Vite: `cd web && npm i && npm run dev`.
4) Acesse `http://localhost:5173/login` e clique “Continuar com Google”.
5) Após consent, a UI deve receber `?token=...` e navegar para `/app/dashboard`.

## Troubleshooting específico do T2

- `TypeError: Invalid type for url (pydantic_core.Url)`: endpoints AnyHttpUrl precisam ser convertidos para `str` (já ajustado no router).
- `duplicate key value violates unique constraint "accounts_pkey"`: sequência do Postgres ajustada no seed (`setval` após inserir `id=1`).
- `invalid or expired state`: Redis fora/TTL expirado; confirme `REDIS_URL` e health do container.
- 404 após 307 do callback: `return_to` caindo em `/`; UI agora envia `return_to=/login` e backend infere pelo `Origin`.

## Evidências (preencher ao concluir)
- Resposta de `/api/auth/google/start`: contém `auth_url` com `state` e `code_challenge`.
- Resultado do callback (JWT emitido / cookie): `307` para `http://localhost:5173/login?token=...` e cookie `token` `httponly`.
- Dump de `google_accounts` (campos chave): `sub` único, `email`, `name`, `picture`, `access_token_enc`, `refresh_token_enc`, `token_expiry`, `content_scope_granted=false`.
- Saída do `pytest -q` (tests oauth): testes presentes (`api/tests/test_oauth_google_start.py`, `api/tests/test_oauth_google_callback.py`).
- Screenshot do OpenAPI com as rotas: `/api/auth/google/start`, `/api/auth/google/callback` visíveis.
- Link do PR: `feat/google-oauth-fixes`.
