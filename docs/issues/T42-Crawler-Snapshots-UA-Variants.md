# T42 — Crawler (Snapshots) + UA Variants
**Tipo:** feature • **Labels:** crawler, snapshots, ua-variants • **Prioridade:** P0

## Descrição
Capturar HTML e screenshot de cada item com user agents Chrome e Googlebot, persistindo snapshots com resiliência mínima e logs estruturados. Expor novos aliases de endpoints `POST /api/v1/stores/{store_id}/scan` e `GET /api/v1/stores/{store_id}/runs/{run_id}/snapshots`.

## Escopo
- Job de crawl salva HTML e screenshot por item em `artifacts/store{store_id}/runs/{run_id}/items/{feed_item_id}/{ua}/`.
- Suporte a dois user agents: Chrome e Googlebot (`UA_CHROME`, `UA_GOOGLEBOT`).
- Endpoint de enqueue scan: `POST /api/stores/{store_id}/scan` e alias `POST /api/v1/stores/{store_id}/scan`.
- Endpoint de listagem de snapshots: `GET /api/stores/{store_id}/runs/{run_id}/snapshots` e alias `GET /api/v1/stores/{store_id}/runs/{run_id}/snapshots`.
- Logs estruturados (`crawl.snapshot.ok|error`) por item/UA.
- OpenAPI atualizado e sem drift no CI.

## Critérios de Aceite
- [ ] Snapshot HTML e screenshot gravados em disco para ambos UAs.
- [ ] `PageSnapshot` persistido com campos principais (status, url final, redirect_chain, extracted).
- [ ] Logs estruturados `crawl.snapshot.*` emitidos.
- [ ] Endpoints disponíveis em `/api/stores/...` e `/api/v1/stores/...`.
- [ ] `OpenAPI.md` atualizado e igual ao `OpenAPI.md.generated`.
- [ ] Testes (`pytest -q`) e lint (`ruff`) passam no CI.

## Evidências (preencher ao concluir)
- Caminho de snapshot gerado (HTML+PNG) para item de exemplo.
- Amostra do log `crawl.snapshot.ok`.
- Respostas de `POST /api/v1/stores/{id}/scan` e `GET /api/v1/stores/{id}/runs/{run_id}/snapshots`.
- Saída do `pre-commit run --files ...`.
- Link do PR.
