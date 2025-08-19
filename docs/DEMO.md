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

5. **Ingestão do feed**
   ```bash
   TOKEN=$(python scripts/mint_token.py)
   API=http://localhost:8000

   # via URL previamente configurada
   curl -H "Authorization: Bearer $TOKEN" \
     -X POST "$API/api/stores/1/feed/ingest"

   # via upload de arquivo
   curl -H "Authorization: Bearer $TOKEN" \
     -F format=csv -F file=@docs/seed/demo_feed.csv \
     "$API/api/stores/1/feed/upload"
   ```

6. **Ver versões**
   `GET /api/stores/{id}/feed/versions`

7. **Checar itens no banco**
   ```sql
   SELECT count(*) FROM feed_items WHERE store_id=1;               -- >= 60
   SELECT item_id, price_cents, currency, link_canonical, availability
     FROM feed_items WHERE store_id=1 LIMIT 10;
   ```

8. **Primeiro Diagnóstico**
   `POST /api/stores/{id}/scan`

9. **Ver violações**
   `GET /api/stores/{id}/violations`

10. **Bloquear item (exemplo)**
    `POST /api/stores/{id}/blocks` com `{ "feed_item_id": "SKU-001" }`

11. **(Quando implementado)** Publicar políticas no WP e gerar Appeal Kit.
