# T1 — Feed Ingestor & Versionamento
**Tipo:** feature • **Labels:** api, feeds, normalization, versioning, tests • **Prioridade:** P0

## Descrição
Implementar ingestão de feeds (arquivo/URL) com normalização de itens e versionamento idempotente. Fornecer endpoints v1 sem quebrar rotas legadas, armazenar `content_hash` e manter `feeds.last_item_count/created_at`. Cobrir com testes (helpers, idempotência e smoke de API) e dataset ≥60 itens.

Nota: a ingestão/scan é totalmente independente de integrações externas (WordPress, GMC). WP é opcional e não é pré‑requisito para executar scans. Opcionalmente, agora também é possível popular itens a partir do Google Merchant Center via `POST /api/google/mc/{merchant_id}/import?store_id=...` (ver T3).

## Escopo
- Endpoints v1:
  - `POST /api/v1/stores/{store_id}/feeds/ingest` (upload **ou** `{url, format}`)
  - `GET  /api/v1/stores/{store_id}/feeds/versions`
  - `GET  /api/v1/feeds/versions/{version_id}/items`
  - Aliases de compatibilidade preservados
- Normalização: `clean_text`, `canonicalize_link`, `extract_currency`, `normalize_gtin`; preço em centavos + ISO
- Versionamento: `feed_versions(content_hash, items_count, created_at)`; `content_hash = sha256(raw + origin)`
- Idempotência: re-ingest igual → `items_imported=0`, sem nova versão
- `feeds.last_item_count` e `feeds.created_at` preenchidos
- Testes: helpers, idempotência, API v1 smoke (sem Docker)
- DoD dataset: ≥60 itens via arquivo e via URL

## Critérios de Aceite
- [x] v1 endpoints funcionam conforme especificação
- [x] Aliases legados preservados (UI atual não quebra)
- [x] Normalização aplicada (link/currency/gtin/text; preço em centavos + ISO)
- [x] `feed_versions.content_hash` populado; idempotência garantida
- [x] `feeds.last_item_count` e `feeds.created_at` definidos
- [x] `pytest -q` verde (sem Docker)
- [x] Demonstração: ingest (arquivo e URL) com ≥60 itens; duplicata → `items_imported=0`
- [x] Documentação/CLI cheatsheet atualizada (exemplos curl e SQL de verificação)

## Evidências (preencher ao concluir)
- Exemplos de respostas dos 3 endpoints v1:
- `content_hash` e contagens:
- Saída do teste de idempotência:
- Saída de `pytest -q`:
- Link do PR (se houve correções):

## Validação rápida

# File ingest (CSV ≥60 linhas)
curl -s -H "Authorization: Bearer $TOKEN" \
  -F format=csv -F file=@docs/seed/demo_feed.csv \
  "$API/api/v1/stores/$STORE_ID/feeds/ingest" | jq .

# URL ingest (servindo o mesmo CSV)
# (cd docs/seed && python -m http.server 9000)  # outra shell
curl -s -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url":"http://localhost:9000/demo_feed.csv","format":"csv"}' \
  "$API/api/v1/stores/$STORE_ID/feeds/ingest" | jq .

# Versions + Items
curl -s -H "Authorization: Bearer $TOKEN" \
  "$API/api/v1/stores/$STORE_ID/feeds/versions" | jq .
VID=$(curl -s -H "Authorization: Bearer $TOKEN" \
  "$API/api/v1/stores/$STORE_ID/feeds/versions" | jq -r '.items[0].id')
curl -s -H "Authorization: Bearer $TOKEN" \
  "$API/api/v1/feeds/versions/$VID/items?limit=5" | jq .

# Idempotência (mesmo arquivo)
curl -s -H "Authorization: Bearer $TOKEN" \
  -F format=csv -F file=@docs/seed/demo_feed.csv \
  "$API/api/v1/stores/$STORE_ID/feeds/ingest" | jq .
