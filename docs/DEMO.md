# DEMO (10–15 min) — GMC Shield MVP

## Pré-requisitos
- Docker e docker-compose
- `.env` copiado de `.env.example`
- Seeds em `docs/seed/`

## Passos

1. **Subir stack**
   ```bash
   docker compose up -d redis db
   docker compose run --rm api alembic upgrade head
   docker compose up -d api worker
   ```

2. **Abrir Swagger**
   http://localhost:8000/docs

3. **Criar loja**
   `POST /api/stores` com body de `docs/seed/demo_store.json` (ou use o exemplo do Swagger).

4. **Configurar feed**
   `POST /api/stores/{id}/feed` usando `docs/seed/demo_feed.xml` (ou CSV).

5. **Primeiro Diagnóstico**
   `POST /api/stores/{id}/scan`

6. **Ver violações**
   `GET /api/stores/{id}/violations`

7. **Bloquear item (exemplo)**
   `POST /api/stores/{id}/blocks` com `{ "feed_item_id": "SKU-001" }`

8. **(Quando implementado)** Publicar políticas no WP e gerar Appeal Kit.
