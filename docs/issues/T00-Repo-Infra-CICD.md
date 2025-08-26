# T0 — Repo, Infra & CI/CD
**Tipo:** chore • **Labels:** infra, ci-cd, devx, openapi, observability • **Prioridade:** P0

## Descrição
Configurar base sólida do projeto: monorepo, Docker/Compose com healthchecks, pipeline de CI/CD (API/Web/Plugin) com geração/validação do `OpenAPI.md`, observabilidade mínima (logs JSON + métricas simples) e variáveis de ambiente consolidadas (incl. OAuth Google).

### Escopo
- CI único (API/Web/Plugin) com caches, lints, testes e **artifact `OpenAPI.md`**; **gate de drift** do OpenAPI; **tests OAuth offline** (mocks).
- Dockerfile multi-stage non-root + Playwright Chromium; compose com healthchecks em `db/redis/api/rq-*`.
- Pydantic Settings + `.env.example` completo, incluindo chaves de OAuth Google.
- Logs JSON com `trace_id` propagado; `/api/ops/metrics` com contadores e p50/p95.
- Makefile dev (`up`, `up-crawl`, `feed-logs`, `crawl-logs`, `test`) e pre-commit.

## Critérios de Aceite
 - [x] `pytest -q` executa com sucesso **sem Docker** (SQLite/in-memory).
 - [x] CI verde em PR de teste; artifact `OpenAPI.md` publicado.
 - [x] Gate de drift do OpenAPI funciona (falha ao divergir do versionado).
 - [x] Testes de OAuth (mockados, sem rede) passam no CI.
 - [x] `docker compose up -d` sobe `db`, `redis`, `api`, `rq-feed`, `rq-crawl`; healthchecks OK.
 - [x] `OpenAPI.md` inclui rotas: `/api/auth/google/start`, `/api/auth/google/callback`, `/api/auth/google/start-content`, `/api/google/mc/accounts`, `/api/google/mc/{merchant_id}/products`.
 - [x] Logs em **JSON** com `trace_id` visível em requests e jobs.
 - [x] `/api/ops/metrics` exibe contadores e latências (p50/p95).
 - [x] `.env.example` contém todas as variáveis (incl. OAuth) e carrega sem erro no startup.

## Evidências (preencher ao concluir)
 - CI run link: (pending)
 - Artifact `OpenAPI.md`: `docs/OpenAPI.md`
 - Trechos de log (JSON com trace_id): `api/app/observability.py`
 - Saída de `/api/ops/metrics`: `curl :8000/api/ops/metrics`
 - Print do compose health: `docker compose ps`

## Notas de Implementação
- Evitar refactors; mudanças mínimas para conformidade.
- Reusar `crypto.py`/logging existentes quando possível.

