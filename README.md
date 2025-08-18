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
/api           # FastAPI, SQLAlchemy/Alembic, rotas rotas de exemplo (stub)s
/worker        # RQ Worker (queues: feed, crawl, rules, reports, notify)
/web           # React + Vite (páginas placeholder)
/plugin-WooCommerce    # Plugin WordPress (REST mínimo, metabox, coluna)
/infra         # Dockerfiles, docker-compose, Makefile
/docs          # OpenAPI rotas de exemplo (stub), checklists, issues (backlog), seeds, DEMO, Kanban
/scripts       # utilitários (demo script, seed issues)
```

**Filas (RQ):** `feed`, `crawl`, `rules`, `reports`, `notify`  
**Persistência:** Postgres (Docker), Redis (fila), storage local (MVP).

---

## Começando Rápido (Docker)

1. Copie `.env.example` → `.env`
2. Suba DB e Redis:
   ```bash
   docker compose up -d redis db
   ```
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

**Docs da API:** http://localhost:8000/docs

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

Veja `.env.example`. Principais: `DATABASE_URL`, `REDIS_URL`, `SECRET_KEY`, `CORS_ORIGINS`.

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

### Integração WordPress

1. Gere uma **FERNET_KEY** (32 bytes base64) e defina em `.env`:
   ```bash
   python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
   ```
2. No WordPress, crie uma **Application Password** para um usuário admin.
3. Salve as credenciais via API:
   ```bash
   TOKEN=$(python scripts/mint_token.py)
   curl -X POST "$API/api/stores/1/wp/credentials" \
     -H "Authorization: Bearer $TOKEN" -H "content-type: application/json" \
     -d '{"wp_api_base":"http://localhost:8080/wp-json","wp_base_url":"http://localhost:8080","wp_user":"admin","wp_app_password":"XXXX"}'
   ```
4. Publique uma política:
   ```bash
   curl -X POST "$API/api/stores/1/wp/policies/publish" \
     -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' \
     -d '{"type":"refund","content_md":"## Devolução em 30 dias","status":"publish"}'
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

- Verifique `DATABASE_URL`/`REDIS_URL` e serviços no ar (`docker compose ps`).
- CORS: ajuste `CORS_ORIGINS` e `VITE_API`.

**Preview do Frontend:** veja `docs/PREVIEW.md` e o workflow `.github/workflows/web-preview.yml`. Para Vercel, use `vercel.json` (root `web/`).
