# D0 — Repo, Infra & Qualidade
**Tipo:** chore • **Labels:** infra, devx • **Estimativa:** 4h

## Descrição
- Montar monorepo com `api/`, `worker/`, `web/`, `plugin-woo/`, `infra/`, `docs/`.
- Docker Compose com Postgres/Redis.
- Alembic inicial + pipelines locais (Makefile).
- Lint básico (black/ruff) — opcional no MVP.

## Critérios de Aceite
- [ ] `docker compose up api worker` sobe sem erro.
- [ ] `/healthz` responde 200.
- [ ] `alembic upgrade head` cria tabelas base.
