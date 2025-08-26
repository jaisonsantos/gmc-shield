# GMC Shield — Task Plan (T13–T22)

> Continuação do plano unificado por **Tarefas**. Mesmo padrão de T0–T12: objetivo, escopo, DoD e validações. Não há prazos, só critérios de aceite.

---

## T13 — UI Parity (Feeds, Versions, Scan)

**Escopo — detalhar**

- **Camada de API (`web/src/lib/api.js`)**

  - Novo **prefixo** padrão: `const API = import.meta.env.VITE_API_BASE || 'http://localhost:8000'; const V1 = '/api/v1';`
  - Funções (todas retornam `{data, error}`):

    - `ingestFeed({storeId, file, url, format, isAsync})` → `POST ${API}${V1}/stores/${storeId}/feeds/ingest`

      - Suporta **arquivo** (form-data: `file`, `format`) **ou** **URL** (JSON: `{url, format}`).
      - Trata `200` (retorno sincrono) **e** `202` (queued: `{status:'queued', job_id, feed_id}`).

    - `listFeedVersions({storeId, page=1, limit=20})` → `GET ${API}${V1}/stores/${storeId}/feeds/versions?page=&limit=`

      - Espera: `{ items: [{ id, content_hash, items_count, created_at }], page?, total? }`.

    - `listVersionItems({versionId, page=1, limit=50})` → `GET ${API}${V1}/feeds/versions/${versionId}/items?page=&limit=`

      - Espera: `{ items: [FeedItemOut], page, total }`.

    - `startScan({storeId, limit_items=50, recrawl=false})` → `POST ${API}/api/stores/${storeId}/scan`

      - **Alias v1 opcional**: se `VITE_FORCE_V1_SCAN=true`, usa `POST ${API}${V1}/stores/${storeId}/scan`.
      - Espera: `{ run_id, queued, items_total }`.

    - `listRunSnapshots({storeId, runId, page=1, limit=50})` → `GET ${API}${V1}/stores/${storeId}/runs/${runId}/snapshots?page=&limit=`

      - Mantém fallback para rota legada se 404.

  - **Auth**: reusar bearer atual; anexar `traceparent` (se disponível) para rastreabilidade.

- **Feeds UI (`web/src/pages/Feeds.jsx`)**

  - **Form Ingest** com duas abas: “Arquivo” e “URL”.

    - Arquivo: `<input type="file">` + `<select format>` (`csv|tsv|xml|json`).
    - URL: `<input url>` + `<select format>`.
    - Toggle “Processar em segundo plano” (`isAsync`).
    - Depois do sucesso: toast e **refresh** da lista de versões.
    - Exibir resumo do retorno:

      - `200`: `items_imported`, `items_updated`, `items_count`, `content_hash`.
      - `202`: `status: queued`, `job_id`, `feed_id`.

  - **Lista de versões**

    - Colunas: `created_at` (relative + tooltip UTC), `items_count`, `content_hash` (trunc 10 + copy), ação **“ver itens”**.
    - Paginação server-side (`page`, `limit`).

  - Empty/loading/error states consistentes (skeletons + toasts).

- **Itens por versão (`web/src/pages/Items.jsx`)**

  - Recebe `versionId` via rota (`/feeds/versions/:versionId/items`).
  - Tabela com colunas: `item_id`, `title`, `link_canonical`, `price_cents` (formata em moeda se `currency`), `availability`.
  - Paginação server-side; busca leve por `item_id` (client-side) opcional.

- **Scans (`web/src/pages/Scans.jsx` e `Dashboard.jsx`)**

  - Botão **“Iniciar Scan”** na Scans/Dashboard:

    - Parâmetros: `limit_items`, `recrawl` (switch).
    - Mostra retorno `{run_id, queued, items_total}` e link para visualizar snapshots.

  - Cart/Widget no Dashboard com **último run** (id, dt, items, status básico).
  - Página de snapshots (se já existir): consumir `listRunSnapshots`.

- **Compatibilidade**

  - **Aliases legados** permanecem ativos no backend até a migração completa (flag `VITE_FORCE_V1_ONLY` para forçar).
  - Guardar fallback em `api.js`: se rota v1 **404**, tentar legado e logar warning.

- **Qualidade**

  - ESLint/Prettier ok.
  - **Tests leves** (React Testing Library + MSW):

    - Upload de feed (200 e 202),
    - Lista de versões (pág. 2),
    - Itens por versão (mostra total),
    - Disparar scan e exibir retorno no card.

**DoD — ajustar**

- Feeds: usuário **consegue** ingerir por **arquivo** e por **URL**; vê versões com `content_hash/items_count/created_at` e navega para itens.
- Scans: usuário dispara scan com `limit_items/recrawl` e vê o último `run_id` e link para snapshots.
- UI **não usa** mais rotas legadas quando `VITE_FORCE_V1_ONLY=true`; fallback funciona quando desativado.
- Estados de loading/erro padronizados; toasts para 4xx/5xx.

**Validações — adicionar**

- Manual (contra API local):

  1. Ingerir **CSV** por upload e por URL; verificar:

     - retorno `200` (sincrono) e `202` (assíncrono) em cenários distintos;
     - lista de versões com novo registro.

  2. Abrir **itens** da última versão; confirmar paginação e contagem.
  3. Disparar **scan** com `limit_items=2`; conferir card do último run no Dashboard.

- MSW Tests:

  - **Feeds**: mock `ingest` (200/202), `versions` (3 páginas), `items`.
  - **Scans**: mock `startScan` (payload esperado).

- **Lighthouse (dev)**: A11y ≥ 90 nas páginas Feeds/Items/Scans.
- **Telemetry**: inspecionar network tab e logs do backend assegurando prefixo `/api/v1` nas chamadas.

**Checklist de implementação**

1. `lib/api.js`: adicionar helpers V1 + fallback; tratar 200/202 e paginação.
2. `Feeds.jsx`: formular ingest (arquivo/URL), tabela de versões, toasts, skeletons.
3. `Items.jsx`: rota `/:versionId/items`, tabela com paginação.
4. `Scans.jsx`/`Dashboard.jsx`: botão iniciar scan, card do último run.
5. `.env.local`: `VITE_API_BASE`, `VITE_FORCE_V1_ONLY=true` (em staging), `VITE_FORCE_V1_SCAN=true` opcional.
6. MSW + testes; ESLint/Prettier.
7. Smoke manual end-to-end (upload → versões → itens → scan).

---

## T14 — WooCommerce Sync (Blocks, Policies, Health) (ajustes)

**Escopo — detalhar**

- **Variáveis de ambiente (API)**

  - `WP_TIMEOUT=15` (s) · `WP_MAX_RETRY=3` · `WP_RETRY_BACKOFF_MS=500`
  - (por loja, em DB já existem) `wp_api_base`, `wp_user`, `wp_app_password_enc` (reuso de `crypto.py`).

- **Plugin Woo (`plugin-woo/`)**

  - **Namespace REST**: `gmc-shield/v1`

    - `GET /health` → `{ok:true, plugin_version, wp_version, php_version, site_url}`.
    - `GET /version` → `{plugin_version}` (atalho).

  - **Hooks de visibilidade** (2 estratégias, com toggle no plugin `gmc_shield_mode`):

    - **Mode `catalog_hidden` (padrão)**: ao receber/ler estado bloqueado, seta `_visibility = hidden` ou atual `catalog_visibility` para `hidden` e `_stock_status = outofstock` (sem mudar `post_status`).
      _Pró_: reversível/rápido. _Contra_: tema precisa respeitar visibilidade.
    - **Mode `draft`**: muda `post_status = draft` para SKU bloqueado; desbloqueio volta a `publish`.
      _Pró_: some mesmo. _Contra_: perde URL pública temporariamente.

  - **Reconciliação via WP-Cron**:

    - Job diário `gmc_shield_reconcile_blocks`:

      1. Baixa **suplemental feed** assinado (de T6) **ou** chama API da app (`/api/stores/{id}/blocks/export` se exposto).
      2. Aplica estados localmente com batch (máx. 50 por execução), registra log.

  - **Logs**: `error_log` com prefixo `[gmc-shield]` + JSON (sku, action, result, err?).
    (Mantém scripts já existentes em `plugin-woo/scripts/`)

- **API (FastAPI)**

  - `POST /api/stores/{id}/wp/connect`
    Body: `{base_url, user, app_password}` → valida via `GET {base_url}/wp-json/` e `GET /wc/v3` (se possível).
    Salva enc/atualiza credenciais; **não** logar segredos.
  - `POST /api/stores/{id}/blocks/sync`
    Params: `mode=full|delta` (default `delta`), `limit=500`.
    Ação: enfileira job `wp_sync_blocks:{store_id}` (RQ) que:

    1. Lê blocos ativos da loja.
    2. Resolve SKU→product_id (cache em Redis por 24h, chave `woo:pid:{store}:{sku}`).
    3. Aplica estratégia configurada (via `stores.wp_sync_mode` opcional) chamando Woo REST (`wc/v3/products/{id}`), idempotente.
    4. Atualiza `stores.wp_last_block_sync_at` e `stores.wp_last_block_synced` (contagem aplicada).

  - `GET /api/stores/{id}/wp/health`
    Agrega: alcance ao `wp-json`, versão do plugin (`/wp-json/gmc-shield/v1/health`), latências, `wp_last_*`, contagem pendente de blocos vs. site.

- **DB / Modelos**

  - Confirmar e **usar**: `stores.wp_last_block_sync_at`, `stores.wp_last_block_synced`.
  - (Opcional) `stores.wp_sync_mode ENUM('catalog_hidden','draft') DEFAULT 'catalog_hidden'`.

- **Resiliência**

  - **Retry** com backoff para `429/5xx` e timeouts (`WP_MAX_RETRY`), com **circuit breaker** leve por loja (desarma por 5 min após 5 falhas seguidas).
  - Idempotência: não reaplicar estado igual (comparar `catalog_visibility`, `stock_status`, `status` antes do PATCH).
  - **SKU não encontrado**: coletar em `not_found_skus[]` e registrar; não falhar o lote.

- **Políticas**

  - Reuso do T7: `POST /api/stores/{id}/policies/publish` já escreve via `wp_client`; incluir status desta publicação em `/wp/health` (última data e URLs).

**DoD — ajustar**

- Bloquear/desbloquear na app → refletir no Woo **em ≤60s**:

  - via `POST /blocks/sync` (push manual) **e** via WP-Cron (pull) na próxima janela.

- `/api/stores/{id}/wp/health` retorna **OK** com:

  - `plugin_version`, `latency_ms`, `wp_last_block_sync_at`, `wp_last_block_synced`, `policies_published: true/false`.

- Logs do job mostram **resumo estruturado**: `{applied, skipped_same_state, not_found_skus, retries, duration_ms}`.

**Validações — adicionar**

- **Ambiente WP local** (`docker-compose.wp.yml`):

  1. Criar 3 produtos (`SKU-001..003`).
  2. Bloquear `SKU-001` e `SKU-002`.
  3. Rodar `POST /api/stores/{id}/blocks/sync`.

     - Se `catalog_hidden`: ambos ficam ocultos no catálogo e `_stock_status=outofstock`.
     - Se `draft`: `post_status=draft`.

  4. Desbloquear `SKU-002` → `sync` → volta ao estado visível (`publish` / `catalog_visibility=visible`).

- **Health**: `GET /api/stores/{id}/wp/health` retorna `ok:true`, versão do plugin e `wp_last_block_sync_at` recente.
- **SKU inexistente**: bloquear `SKU-999` (não cadastrado) → `not_found_skus` inclui `SKU-999` e job **não** falha.

**Checklist de implementação**

1. **Plugin**

   - Adicionar rotas `gmc-shield/v1/health` e `version`.
   - Implementar toggles `catalog_hidden`/`draft`; cron `gmc_shield_reconcile_blocks`.
   - Documentar `.env` ou página de settings para **URL do suplemento** e **modo de aplicação**.

2. **API**

   - `wp_client.py`: métodos `get_index()`, `get_products(params)`, `patch_product(product_id, payload)`, `find_product_id_by_sku(sku)` com cache.
   - Rotas `wp.connect`, `blocks.sync`, `wp.health`.
   - Job `wp_sync_blocks` com retry/backoff e logs JSON.

3. **DB/Migrations**

   - (Opcional) `stores.wp_sync_mode` + índices úteis.
   - Garantir criptografia de `app_password` e mascaramento em logs.

4. **Observabilidade**

   - Logs estruturados (`store_id`, `sku`, `action`, `old_state`, `new_state`, `result`, `retry`, `ms`).
   - Métrica contadores: `woo_patch_success_total`, `woo_patch_retry_total`, `woo_not_found_total`.

5. **Docs**

   - `WP-LOCAL.md`: como subir o ambiente, instalar plugin, criar produtos de teste.
   - `CLI-CHEATSHEET.md`: exemplos `wp/connect`, `blocks/sync`, `wp/health`.
   - `README.md`: seção “Integração WooCommerce (Sync de Bloqueios)”.

**Testes — sugeridos**

- **API (mock WC)**:

  - `find_product_id_by_sku` (hit/miss + cache).
  - `patch_product` com retry em 429/500.
  - `blocks.sync` aplica `catalog_hidden` sem repetir patch quando já está oculto.

- **E2E local**: script `plugin-woo/scripts/smoke_woo_sync.sh` que:

  - cria produtos (via CLI WP ou REST),
  - bloqueia, roda sync, valida visibilidade/estado,
  - desbloqueia e valida retorno.

---

## T15 — Structured Data v2 (JSON-LD / Microdata / RDFa)

**Objetivo**

Ampliar o extractor para cobrir JSON-LD, Microdata e RDFa e consolidar um **modelo canônico** de produto, alimentando regras e o Evidence Viewer.

---

### Escopo — detalhar

- **Dependências (API)**

  - Adicionar a `api/requirements.txt`:
    `extruct==0.16.*` · `lxml==5.*` · `w3lib==2.*` · `rdflib==7.*`
    _(mantém BeautifulSoup; `extruct` resolve JSON-LD, Microdata e RDFa de uma vez)._

- **Módulo de extração**

  - Novo arquivo `api/app/services/sd_extract.py`:

    - `extract_sd(html: str, url: str) -> dict`

      - Usa `extruct.extract(html, base_url=url, syntaxes=['json-ld','microdata','rdfa'], uniform=True)`.
      - Constrói `candidates` (lista de objetos `Product` de todas as sintaxes).
      - Normaliza cada candidato com:

        - `normalize_price_currency(value) -> (price_cents, currency)` (reuso de `extract_currency` + conversão p/ centavos).
        - `normalize_availability(value) -> oneof{'InStock','OutOfStock','PreOrder','BackOrder','Discontinued',None}` (mapeando URLs/strings comuns).
        - `normalize_gtin(value)` (reuso de helper existente).
        - `canonicalize_link(url)` (reuso).

      - `choose_best(candidates)`: prioridade **JSON-LD > Microdata > RDFa**, quebrando empates por:

        1. `offers.price` preenchido,
        2. `name/title` não vazio,
        3. `brand` presente.

      - Detecta **conflitos** entre fontes: para cada campo canônico, se valores distintos aparecem em mais de 1 fonte → registra em `conflicts[field]=[...values...]`.
      - **Saída canônica**:

        ```json
        {
          "sources_present": ["jsonld", "microdata"],
          "chosen_source": "jsonld",
          "product": {
            "name": "...",
            "url": "...",
            "image": "...",
            "brand": "...",
            "gtin": "...",
            "mpn": "...",
            "price_cents": 12345,
            "currency": "USD",
            "availability": "InStock"
          },
          "conflicts": { "price_cents": [12345, 12990] },
          "warnings": ["missing_currency"]
        }
        ```

    - Helpers internos: `_from_jsonld`, `_from_microdata`, `_from_rdfa` (cada um transforma a estrutura bruta da sintaxe em um dict “Product” compatível com o normalizador).

  - **Obs.**: se houver múltiplos produtos na página, manter `candidates_all` (para debug) e escolher o _best_ (primeiro) — incluir um `warnings += ["multi_product_page"]`.

- **Integração no crawler**

  - Em `api/app/services/crawler.py` (ou onde salva o snapshot):

    - Após obter `page.html`:

      ```python
      from .sd_extract import extract_sd
      sd = None
      try:
          sd = extract_sd(html, url)
      except Exception as e:
          log.warn("sd_extract_failed", {"err": str(e)})
      extracted.update({"sd": sd})
      ```

    - Não quebrar o job se a extração falhar; somente logar.

- **Armazenamento**

  - **Sem nova migração**: gravar o bloco SD no JSON existente:

    - `page_snapshots.extracted_json` passa a conter a chave `"sd"` no formato acima.

- **Rule Pack (integração com T5)**

  - Nova(s) regra(s):

    - `SD_INCOMPLETE` – dispara se `sd.product` ausente **ou** faltar **qualquer** campo crítico: `name`, `price_cents` **ou** `currency`, `availability`.
    - `SD_CONFLICT` – dispara se `sd.conflicts` contiver pelo menos 1 chave.

  - Severidade sugerida:

    - `SD_INCOMPLETE` → `major` (ou `critical` se também não houver preço na página).
    - `SD_CONFLICT` → `minor|major` conforme o campo (conflito em `price_cents/currency` = `major`; demais = `minor`).

- **UI (Evidence Viewer)**

  - No modal de evidências (T10), adicionar seção **Structured Data**:

    - Badge de fontes `sources_present` (jsonld/microdata/rdfa).
    - JSON pretty de `sd.product`.
    - Lista de conflitos com `field → [values...]`.

- **Observabilidade**

  - Log por snapshot: `sd_sources`, `sd_has_product`, `sd_conflict_count`, `sd_extract_ms`.

---

### DoD

- **Cobertura de 6 cenários** (fixtures sintéticas ou páginas locais):

  1. **JSON-LD only** com `Product` completo → `sd.product` preenchido, `chosen_source=jsonld`.
  2. **Microdata only** → extraído e normalizado.
  3. **RDFa only** → extraído e normalizado.
  4. **Ausente** → `sd=None` **ou** `sd.product` ausente; `SD_INCOMPLETE` dispara.
  5. **Conflitante** (JSON-LD vs Microdata com preços distintos) → `sd.conflicts.price_cents` presente; `SD_CONFLICT` dispara.
  6. **Inválido** (campos malformados) → normalização lida com `None`/warnings; não quebra o job.

- Evidence Viewer exibe SD canônico + conflitos.

- Logs mostram métricas de extração por snapshot.

---

### Validações

- **Unit tests** para:

  - Normalizadores (`normalize_price_currency`, `normalize_availability`, `normalize_gtin`).
  - `extract_sd` por sintaxe e cenários de conflito.

- **Integration (crawler)**:

  - Rodar um scan de 3 páginas de prova (jsonld/microdata/ausente) e verificar `extracted.sd` populado.

- **Rules**:

  - Dataset dispara `SD_INCOMPLETE` e `SD_CONFLICT` conforme esperado.

- **UI**:

  - Modal rende `sd.product` em JSON pretty, badges de fonte e lista de conflitos.

---

### Checklist de implementação

1. **Deps**

   - Atualizar `api/requirements.txt` com `extruct`, `lxml`, `w3lib`, `rdflib`.
   - `infra/Dockerfile.api`: garantir `libxml2`, `libxslt` se necessário (já coberto pelo `lxml` wheels; se falhar no slim, `apt-get install -y libxml2 libxslt1.1`).

2. **Código**

   - Criar `services/sd_extract.py` com funções citadas.
   - Integrar chamada a `extract_sd` no fluxo do crawler antes de persistir `extracted_json`.
   - Ajustar Rule Pack para consumir `snapshot.extracted.sd`.

3. **Testes**

   - `api/tests/test_sd_extract_v2.py` cobrindo os 6 cenários.
   - Atualizar `test_extract_structured_data.py` existente para reaproveitar fixtures.
   - Pequeno teste de integração no crawler (mock de HTML) certificando que `extracted.sd` é salvo.

4. **UI**

   - `web/src/pages/Violations.jsx` / modal do Evidence Viewer: nova seção SD.
   - `lib/api.js`: nenhum ajuste de contrato (campo já vem dentro de `extracted`).

5. **Docs**

   - `README.md` → seção “Structured Data v2” (campos suportados; precedência e conflitos).
   - `CLI-CHEATSHEET.md` → comando para abrir o JSON SD de um snapshot (`jq '.extracted.sd'`).

---

### Matriz de testes (esperado)

| Cenário        | sources_present  | chosen    | product.ok | conflicts     | Regras                            |
| -------------- | ---------------- | --------- | ---------- | ------------- | --------------------------------- |
| JSON-LD only   | jsonld           | jsonld    | ✔          | ∅             | —                                 |
| Microdata only | microdata        | microdata | ✔          | ∅             | —                                 |
| RDFa only      | rdfa             | rdfa      | ✔          | ∅             | —                                 |
| Ausente        | ∅                | —         | ✖          | ∅             | `SD_INCOMPLETE`                   |
| Conflito preço | jsonld,microdata | jsonld    | ✔          | `price_cents` | `SD_CONFLICT`                     |
| Inválido       | jsonld           | jsonld    | parcial/✖  | poss.         | `SD_INCOMPLETE` se faltar crítico |

> **Nota**: manter implementação **idempotente** e tolerante a erros; nunca deixar o job falhar por causa de parsing SD.

---

## T16 — Scan Orchestrator & Retention

**Objetivo**

Formalizar **estados** do run, enriquecer metadados de snapshots e implementar **retenção** de artefatos (HTML/PNG), com listagem e resumo de execuções.

---

### Escopo — detalhar

- **DB / Migração** (`api/alembic/versions/0008_scan_retention.py`)

  - Tabela `scan_runs` — **novos campos**:

    - `state` `ENUM('queued','running','done','failed','partial')` \*\*NOT NULL DEFAULT 'queued'\`.
    - `started_at TIMESTAMPTZ` (setar quando o primeiro job do run inicia).
    - `finished_at TIMESTAMPTZ` (setar quando o run é concluído).

  - Tabela `page_snapshots` — **novos campos**:

    - `ua VARCHAR(16)` (ex.: `chrome`, `googlebot`) — se ainda não há coluna dedicada.
    - `headers_json TEXT NULL` (request/response relevantes).
    - `elapsed_ms INTEGER NULL` (navegação + extração).
    - `html_sha256 CHAR(64) NULL` (hash do HTML bruto para dedupe/diffs).
    - **Opcional recomendado**: `purged_at TIMESTAMPTZ NULL` (marca de retenção aplicada).

  - **Índices**:

    - `scan_runs (store_id, created_at DESC)`.
    - `page_snapshots (store_id, run_id)` e `page_snapshots (run_id, feed_item_id, ua)`.

  - **Backfill**: para runs existentes, `state='done'` e `finished_at=created_at` quando `items_total = count(snapshots) OR não houver jobs pendentes`.

- **Orquestração de estados**

  - No enqueue (`POST /api/stores/{id}/scan` ou alias v1), criar `scan_runs(state='queued')`.
  - **Primeiro job** do run: tentativa **atômica** (UPDATE com `WHERE state='queued'`) para `state='running'` e `started_at=now()`.
  - **Conclusão**: um job “sentinela” (ou checagem no final de cada job) avalia:

    - `done` se `snapshots >= items_total × UAs` **ou** não existem jobs pendentes na fila do run.
    - `partial` se há pelo menos 1 sucesso e 1 falha.
    - `failed` se todos falharam.
    - Sempre setar `finished_at` na transição final.

  - Logs estruturados por transição: `{run_id, prev_state, next_state, items_total, produced, failures}`.

- **API (padronizar + v1 aliases)**

  - **Listagem de runs**
    `GET /api/stores/{store_id}/scan/runs?limit=50&offset=0`
    **Alias novo**: `GET /api/v1/stores/{store_id}/scan/runs`
    Retorna: `[{id, state, items_total, created_at, started_at, finished_at, duration_ms, produced, failed}]`

    - `duration_ms = (finished_at or now) - (started_at or created_at)`.
    - `produced/failed` via agregação rápida em `page_snapshots` por `run_id`.

  - **Resumo do run**
    `GET /api/stores/{store_id}/runs/{run_id}/summary`
    **Alias novo**: `GET /api/v1/stores/{store_id}/runs/{run_id}/summary`
    Retorna:

    ```json
    {
      "run": {
        "id": 37,
        "state": "done",
        "started_at": "...",
        "finished_at": "...",
        "duration_ms": 91234
      },
      "counts": {
        "by_http": { "200": 8, "301": 1, "404": 3, "5xx": 0, "timeout": 1 },
        "by_ua": { "chrome": 6, "googlebot": 7 },
        "total_snapshots": 13
      },
      "violations": [
        { "rule_code": "PRICE_MISSING", "count": 3 },
        { "rule_code": "SD_ABSENT", "count": 5 }
      ],
      "latest_snapshot_at": "...",
      "hashes": { "html_sha256_unique": 11 }
    }
    ```

    - `by_http`: agrupar `http_status` (mapear 500–599 → `5xx`, status `NULL` + erro → `timeout/network`).
    - `violations`: `SELECT rule_code, COUNT(*) FROM violations WHERE run_id=? GROUP BY 1`.

- **Captura de metadados no crawler**

  - Preencher em cada snapshot:

    - `ua` (já usado nas pastas de artifacts).
    - `headers_json` (User-Agent, Accept-Language; response headers relevantes).
    - `elapsed_ms` (tempo da navegação + `page.content()` + extração).
    - `html_sha256 = sha256(html_bytes)`.

  - Log do job (JSON): `{run_id, feed_item_id, ua, url, http_status, elapsed_ms, html_sha256, error?}`.

- **Retention (política e job)**

  - **Config**:

    - `.env`: `RETENTION_DAYS_HTML=30`, `RETENTION_DAYS_SCREENSHOT=30` (padrão).
    - **Opcional por loja**: `stores.artifact_retention_days` (ou JSON `store_settings.retention_days`).

  - **Job diário** (worker `rq-maint` ou em `rq-crawl`):

    - Seleciona snapshots com `fetched_at < now() - interval 'N days'`.
    - Remove **arquivos** referenciados por `html_path` e `screenshot_path` (somente sob `artifacts/`, sem seguir symlinks).
    - Atualiza a linha: `purged_at=now()`, `html_path=NULL`, `screenshot_path=NULL`.

  - **Dry-run**: variável `RETENTION_DRYRUN=true` imprime o plano sem deletar.
  - **Idempotente** e em lotes (ex.: 500 por ciclo) para não travar I/O.

---

### DoD

- `GET /api/v1/stores/{id}/scan/runs` lista runs com **estado e duração** corretos.
- `GET /api/v1/stores/{id}/runs/{run_id}/summary` retorna contagens por HTTP/UA, total de snapshots, violações por regra e `duration_ms`.
- Retenção: com `N=0`, os **arquivos** são removidos, `html_path`/`screenshot_path` ficam `NULL` e `purged_at` preenchido; UI não gera 404 (mostra badge “purged”).
- Logs estruturados exibem transições de estado e métricas de retenção.

---

### Validações

- Rodar um scan com **5 itens × 2 UAs**:

  - Conferir `scan_runs.state` → `running` durante o processamento → `done` ao final.
  - `summary` mostra `total_snapshots = 10` e quebras por HTTP/UA.

- Executar retenção com `N=0`:

  - Arquivos físicos sumiram; DB com `purged_at` e caminhos nulos; UI lista snapshot marcado como purgado.

- Edge-cases:

  - Falhas de rede produzem `partial` (alguns 200, alguns timeouts).
  - Run sem nenhum sucesso → `failed`.

---

### Testes (API/Worker/DB)

- **Unit**

  - Função de transição `maybe_mark_running(run_id)` (condicional por estado).
  - Cálculo de `duration_ms`.
  - Funções de retenção: seleção de expirados, normalização de caminhos, deleção segura.

- **Integração (pytest, sem Docker)**

  - Criar run + 3 snapshots (200/404/timeout) em diretório temporário de `artifacts/`; rodar retenção com `N=0`; assert:

    - arquivos removidos,
    - `purged_at` setado, caminhos nulos,
    - `summary` não quebra (contagens iguais; apenas sem links de arquivo).

  - Testes das rotas:

    - `GET /api/v1/stores/{id}/scan/runs` → paginação/ordenação por `created_at DESC`.
    - `GET /api/v1/stores/{id}/runs/{run_id}/summary` → shape e agregações corretas.

---

### Checklist de implementação

1. **Migração**

   - Criar `0008_scan_retention.py` com enum `state`, timestamps e colunas de snapshot.
   - Backfill `state='done'` onde aplicável.

2. **Modelo/Service**

   - Atualizar `models.ScanRun` e `models.PageSnapshot`.
   - Helpers: `mark_running_if_queued(run_id)`, `maybe_finalize_run(run_id)`.

3. **Crawler**

   - Preencher `ua`, `headers_json`, `elapsed_ms`, `html_sha256`.
   - Em cada job, após persistir snapshot, chamar `maybe_finalize_run(run_id)`.

4. **API**

   - Implementar `GET /api/.../scan/runs` (e **alias v1**).
   - Implementar `GET /api/.../runs/{run_id}/summary` (e **alias v1**).

5. **Retention**

   - Worker `maint` ou tarefa em `rq-crawl` com schedule diário; suportar `DRYRUN`.
   - Segurança de caminho (sanitização) e deleção tolerante a erros.

6. **UI**

   - Em `Scans/RunDetails`, exibir `state`, `duration`, badges de `purged`.

7. **Observabilidade**

   - Logs JSON: transições, métricas por run, contagem de arquivos purgados por ciclo.

---

### Exemplo de respostas

- **Listagem de runs**

```json
{
  "items": [
    {
      "id": 41,
      "state": "done",
      "items_total": 10,
      "created_at": "2025-08-25T13:40:00Z",
      "started_at": "2025-08-25T13:41:02Z",
      "finished_at": "2025-08-25T13:43:10Z",
      "duration_ms": 128000,
      "produced": 20,
      "failed": 0
    }
  ],
  "total": 7
}
```

- **Resumo do run**

```json
{
  "run": {
    "id": 41,
    "state": "partial",
    "started_at": "2025-08-25T13:41:02Z",
    "finished_at": "2025-08-25T13:43:10Z",
    "duration_ms": 128000
  },
  "counts": {
    "by_http": { "200": 14, "404": 4, "5xx": 0, "timeout": 2 },
    "by_ua": { "chrome": 10, "googlebot": 10 },
    "total_snapshots": 20
  },
  "violations": [
    { "rule_code": "PRICE_MISSING", "count": 3 },
    { "rule_code": "SD_ABSENT", "count": 5 }
  ],
  "latest_snapshot_at": "2025-08-25T13:43:09Z",
  "hashes": { "html_sha256_unique": 17 }
}
```

---

## T17 — Evidence Chain & Reprodutibilidade

**Objetivo**

Reforçar a **cadeia de custódia** das evidências: registrar cabeçalhos, HAR, **hashes** e **marca d’água** nos artefatos, além de **download assinado**.

---

### Escopo — detalhar

- **Crawler (Playwright)**

  - Criar o contexto já **gravando HAR** por item/UA:
    `browser.new_context(record_har_path=path_to('page.har'))`

    > (Manter um HAR **por snapshot**; se usar múltiplas navegações no mesmo contexto, isolar por item para evitar “vazamento” de requisições.)

  - Antes de persistir:

    - Calcular `html_sha256` (já em T16), **`screenshot_sha256`** e **`har_sha256`** com SHA-256.
    - Persistir `request_headers` e `response_headers` relevantes (ex.: status, server, cache, etag, content-type).

      - **Onde armazenar**:

        - Adicionar campos dedicados (ver migração) **ou** incluir no `headers_json` já existente (T16) com shape:

          ```json
          {
            "request": { "User-Agent": "...", "Accept-Language": "..." },
            "response": {
              "status": 200,
              "headers": {
                "Content-Type": "text/html; charset=utf-8",
                "...": "..."
              }
            }
          }
          ```

  - **Screenshot com watermark**: após `page.screenshot()`, aplicar pós-processamento para sobrepor texto discreto (canto inferior direito):
    `"{store_id}/{run_id} · {ua} · {timestamp_iso} · {feed_item_id}"`.

    - Recomendado: adicionar `Pillow` ao `requirements.txt` para compor a marca d’água.
    - Manter **duas** imagens? **Não** — substituir o PNG final (o hash refletirá a marca d’água).

  - Artefatos:

    ```
    artifacts/store{store_id}/runs/{run_id}/items/{sku}/{ua}/
      ├─ page.html
      ├─ page.png         (com watermark)
      └─ page.har
    ```

- **DB / Migração** (`api/alembic/versions/0009_evidence_chain.py`)

  - Tabela `page_snapshots` — **novos campos**:

    - `har_path TEXT NULL`
    - `screenshot_sha256 CHAR(64) NULL`
    - `har_sha256 CHAR(64) NULL`

  - Se ainda não existir (T16): `headers_json TEXT NULL`.
  - **Índices auxiliares** (opcional): `(store_id, run_id, feed_item_id, ua)` único para facilitar buscas e garantir 1 snapshot/UA.

- **API / Downloads assinados**

  - Endpoint **novo** (v1):

    - `GET /api/v1/stores/{store_id}/runs/{run_id}/snapshots/{snapshot_id}/download?type=html|png|har&sig=...&exp=...`

  - **Assinatura curta**:

    - Gerar token HMAC/JWT curto (ex.: **5 minutos**) com payload: `{snap: snapshot_id, type, exp}`.
    - Validar `store_id/run_id` ↔ `snapshot_id` e `type` antes de ler o arquivo.
    - Retornar `Content-Type` adequado:

      - `text/html; charset=utf-8`
      - `image/png`
      - `application/json` (HAR)

    - **Headers anti-cache** nos downloads assinados.

- **Segurança & Observabilidade**

  - **Rate-limit** leve no download assinado (ex.: 120/min/IP).
  - Logs JSON por download: `{snapshot_id, type, user_id, ok|err, latency_ms}`.
  - Sanitização de caminhos na leitura de artefatos (não seguir symlinks; restringir root `artifacts/`).

---

### DoD

- Para um snapshot de teste existem:

  - `html_sha256`, `screenshot_sha256`, `har_sha256` **preenchidos**.
  - `page.har` gravado e legível; `headers_json` contém request/response resumidos.
  - `page.png` contém **marca d’água** visível no canto inferior direito.

- O endpoint de **download assinado** entrega HTML/PNG/HAR mediante `sig` válido; tokens expirados retornam 401/403.

---

### Validações

- Rodar um scan de 1 SKU × 2 UAs:

  - Conferir no disco `page.har`, `page.png` (com watermark) e `page.html`.
  - Executar `sha256sum` local nos 3 arquivos e comparar com as colunas do DB.

- Gerar link assinado para cada artefato e baixar via `curl`:

  - `sig` válido → 200 com conteúdo correto.
  - `sig` alterado/expirado → 401/403.

- Mover artefatos para um bucket S3/MinIO e baixar novamente:

  - Hash calculado pós-movimentação **idêntico** ao registrado.

---

### Testes (pytest, sem rede externa)

- **Unit**

  - Função de **assinatura/validação** de tokens de download (expiração e binding ao `snapshot_id`/`type`).
  - Função de **marca d’água** (mock da fonte; assert de bytes diferentes e presença de pixels não-transparentes na região do overlay).
  - Cálculo de SHA-256 dos buffers.

- **Integração**

  - Simular snapshot em dir temporário, gravar `html/png/har`, chamar persistência (DB) e **baixar** via rota com `sig` válido e inválido.
  - Validar `headers_json` com campos esperados.

---

### Checklist de implementação

1. **Deps**

   - `Pillow==10.*` em `api/requirements.txt` (para watermark).

2. **Migração**

   - Criar `0009_evidence_chain.py` com `har_path`, `screenshot_sha256`, `har_sha256` (+ `headers_json` se faltar).

3. **Crawler**

   - Abrir contexto com gravação de HAR por snapshot.
   - Capturar headers/timings resumidos → `headers_json`.
   - Calcular hashes; aplicar watermark; salvar arquivos.

4. **API**

   - Implementar `GET /api/v1/.../download` com validação de `sig`/`exp` e `type`.
   - Definir helper `sign_artifact_link(snapshot_id, type, ttl_s=300)`.

5. **Segurança**

   - Rate-limit no endpoint de download.
   - Sanitização de caminho e bloqueio de path traversal.

6. **Observabilidade**

   - Logar criação de HAR e tamanhos de arquivos; log por download (latência, status).

7. **Docs**

   - `README.md`/`CLI-CHEATSHEET.md`: exemplos de geração de link assinado e verificação de hashes.

---

### Exemplos de uso (CLI)

- **Link assinado (PNG)**

  ```bash
  TOKEN=$(docker compose exec -T api python -m app.scripts.mint_token | tr -d '\r')
  API=http://localhost:8000
  curl -s -H "Authorization: Bearer $TOKEN" \
    "$API/api/v1/stores/1/runs/37/snapshots/123/download?type=png&sig=...&exp=..." \
    -o page.png
  sha256sum page.png
  ```

- **Verificar HAR**

  ```bash
  curl -s -H "Authorization: Bearer $TOKEN" \
    "$API/api/v1/stores/1/runs/37/snapshots/123/download?type=har&sig=...&exp=..." \
    | jq '.log.entries[0].response.status'
  ```

---

## T18 — Multi-Store & Agency View

**Objetivo**

Habilitar contas com **múltiplas lojas** e uma visão **consolidada** para perfis de agência.

---

### Escopo — detalhar

- **RBAC / Modelo**

  - Confirmar relação **accounts(1) ↔ stores(N)** (já existente).
  - Adicionar roles: `agency_admin` e `agency_viewer` (além de `owner|admin|analyst|viewer`).
  - JWT deve carregar `user_id`, `role`, **`account_id`**.

    - Middleware/`Depends` central para **escopo por `account_id`** em rotas de agency.

- **API (v1)**

  - `GET /api/v1/accounts/{account_id}/stores`

    - Lista as lojas do account (id, name, platform, base_url, created_at).

  - `GET /api/v1/accounts/{account_id}/overview?since=ISO&window=7d`

    - Retorna um array por **store** com KPIs:

      - `violations_total`, `violations_by_severity` (`critical|major|minor`)
      - `blocked_active` (qtde de bloqueados ativos)
      - `last_scan` (`state`, `started_at`, `finished_at`)
      - `last_feed_version` (`created_at`, `items_count`)
      - `policies_status` (publicadas? últimas urls/dt, se disponível)

    - Filtro `since`/`window` aplica-se a violações (ex.: últimos 7d).

  - **Escopo obrigatório**: verificar que `account_id (JWT) == account_id (path)` **OU** role elevada com delegação explícita (se aplicável).
  - **Aliases**: não precisa (endpoints novos v1).

- **Consultas / Índices**

  - `violations`: índice em `(store_id, created_at)` para agregações por janela.
  - `blocks`: índice em `(store_id, active)`.
  - `scan_runs`: índice em `(store_id, started_at DESC)`.
  - `feed_versions`: índice existente por `feed_id, created_at`.
  - Todas as queries com **`WHERE stores.account_id = :account_id`**.

- **Web (React)**

  - Página `web/src/pages/Agency.jsx`:

    - **Tabela por loja** com colunas: Loja, Violations (7d), Crit/Maj/Min, Bloqueados, Último Scan (status/duração), Última Versão do Feed (itens, data), Policies.
    - Link “ver detalhes” (leva para páginas de loja: Violations, Scans, Feeds).
    - Filtros rápidos: por severidade > 0, por status do último scan.
    - Paginação (server-side) se houver muitas lojas.

  - `lib/api.js`: clientes `getAccountStores(accountId)` e `getAccountOverview(accountId, {since, window})`.

- **Segurança**

  - `Depends(require_roles("agency_admin","agency_viewer","owner","admin"))` nas rotas de agency **+** verificação de `account_id`.
  - Usuários `viewer/analyst` **não-agência** só enxergam suas lojas (via rotas por store, não por account).
  - Rate-limit leve (ex.: 60 req/min/User) nas rotas de overview.

---

### DoD

- Usuário com role **`agency_viewer`** consegue acessar `/agency` e visualizar **todas as lojas** do seu `account_id`, com KPIs corretos.
- Usuário **de loja** (ex.: `owner`) **não** acessa overview de outro `account_id` (403) e, para o seu account, vê somente suas lojas.
- UI **Agency.jsx** lista pelo menos 2 lojas com dados agregados coerentes; links navegam para telas por loja.

---

### Validações

- **API**

  - Chamar `GET /api/v1/accounts/{account_id}/overview` com token de agência → 200 e array por loja.
  - Mesmo endpoint com token de outro `account_id` → 403.
  - `since`/`window` alterando contagens de violações conforme esperado (testes com dados seed).

- **UI**

  - Abrir a página Agency e validar:

    - KPIs batem com uma verificação via SQL (amostragem).
    - Filtros e paginação funcionam; tempos < 1s com até \~100 lojas.

- **Tests (pytest)**

  - RBAC: agency vs non-agency para `accounts/*`.
  - Agregações: fixtures de violações/bloqueios/run/feed geram KPIs esperados para duas lojas distintas do mesmo account.

---

### Checklist de implementação

1. **RBAC**

   - Incluir `agency_admin`, `agency_viewer` em enum/validação de roles.
   - Garantir `account_id` no JWT e nos contextos (`request.state.user`).

2. **API**

   - Novo router `api/app/routers/accounts.py` (v1) com:

     - `GET /accounts/{account_id}/stores`
     - `GET /accounts/{account_id}/overview`

   - Queries com joins e `GROUP BY store_id`; carregar:

     - `violations` (COUNT e COUNT FILTER por severidade no período)
     - `blocks` ativos
     - `scan_runs` (último por store)
     - `feed_versions` (último por store → via `feeds` da loja)
     - `policies` (se existir tabela/colunas, retornar flag/urls)

3. **Índices**

   - Alembic para índices citados (se faltarem).

4. **Web**

   - Implementar `Agency.jsx` com tabela & filtros; usar endpoints v1.

5. **Segurança/Rate-limit**

   - Aplicar limiter nas rotas `accounts/*`.

6. **Docs**

   - `OpenAPI.md`: documentar novas rotas.
   - `README.md`/`CLI-CHEATSHEET.md`: exemplos de chamadas c/ token de agência.

---

### Notas de performance

- Para muitos stores, considerar **consulta única** com subselects agregados por tabela (violations/blocks) + lateral join para “último scan/feed version”.
- Cache leve (60s) em memória por `account_id` para a visão de overview pode ser habilitado depois (opcional).

---

## T19 — Reports & Exports

**Objetivo**

Permitir **exportar achados** (violations) e **enviar relatórios periódicos** (PDF + CSV) por e-mail, com retenção e histórico.

---

### Escopo — detalhar

- **API (v1)**

  - `GET /api/v1/stores/{store_id}/violations/export.csv`

    - Filtros: `from` (ISO), `to` (ISO), `rule_code`, `severity`, `fixed` (bool), `min_score`, `search` (SKU/title contains).
    - CSV **streaming** (generator + `StreamingResponse`) — **sem** carregar tudo na memória.
    - Colunas mínimas: `store_id, feed_item_id, rule_code, severity, created_at, title, link, evidence_json`.
    - Ordenação: `created_at ASC` por padrão.
    - Rate-limit: 6 req/min/usuário; tamanho máximo lógico (ex.: 250k linhas) com aviso.

  - `GET /api/v1/stores/{store_id}/violations/export.json`

    - Mesmo filtro; **NDJSON** (1 JSON por linha) para grandes volumes.

  - `GET /api/v1/stores/{store_id}/reports`

    - Lista relatórios gerados (`type=weekly|on_demand`, `format=pdf|csv`, `created_at`, `size`, `url_assinada`, `expires_at`).

  - `POST /api/v1/stores/{store_id}/reports/on-demand`

    - Gera **on-demand**: aceita `range` + filtros; produz **PDF** (sumário + gráficos simples) e **CSV** (todos os registros).
    - Retorna `job_id` (assíncrono) e, ao concluir, entra no índice `/reports`.

- **Scheduler (worker)**

  - **Semanal** (ex.: seg 08:00 local da loja): gera **PDF** + **CSV** para a janela da última semana.
  - Envia e-mail (SES/Sendgrid sandbox) com **anexos** pequenos ou **links assinados** p/ arquivos grandes.
  - Persistir em `artifacts/reports/store{store_id}/{YYYY}/{MM}/report_{YYYYMMDD}_{type}.{pdf|csv}`.
  - **Retenção**: TTL configurável (ex.: 90 dias) com job de limpeza.

- **PDF (Playwright/WeasyPrint)**

  - Template `docs/templates/report_weekly.html.j2`
  - Conteúdo:

    - KPIs: `violations_total`, por severidade, **top 5 rules**, **top 10 SKUs** com mais violações.
    - Pequenos gráficos (SVG embutido/inline) — barras/pizza simples (gerados no template).
    - Tabela resumo (primeiras N violações com link para evidence viewer).

  - Cabeçalho/rodapé com nome da loja, período e número da versão do report.

- **Segurança & Acesso**

  - RBAC: `owner|admin|analyst` (viewer pode listar/baixar se habilitado, não gerar on-demand).
  - **Signed URLs** para downloads (token curto; expiração 24h; path-bound).
  - Logs/auditoria: `report_generate`, `report_download`.

- **Web (React)**

  - Nova página **Reports**:

    - **Gerar on-demand**: filtros, período, formatos; mostra status do job; link quando pronto.
    - **Histórico**: tabela com relatórios (tipo, período, formatos, tamanho, criado em, expira em) + ação **Download**.

  - Toasts e estados de carregamento/erro; paginação server-side de histórico.

- **DB / Índices**

  - Se necessário, tabela `reports`:

    - `id, store_id, type, format, from, to, path, size_bytes, created_at, expires_at`

  - Índices: `(store_id, created_at DESC)`.
  - Para export performático: garantir índices em `violations(store_id, created_at)`, `severity`, `rule_code`.

---

### DoD

- `GET .../export.csv` exporta **10k linhas** em **< 5s** (dataset sintético) via **streaming**.
- **E-mail semanal** entregue em sandbox contendo PDF + CSV (anexo ou link assinado).
- Página **Reports** lista relatórios, permite gerar on-demand e baixar; links expiram conforme configuração.
- **Retenção** remove arquivos expirados e mantém o índice coerente (sem links quebrados).

---

### Validações

- **API**

  - Export CSV/NDJSON com filtros distintos; conferir cabeçalhos, timezone (`created_at` em UTC ISO-8601).
  - Verificar que streaming mantém memória estável (picos baixos sob 10k–50k linhas).
  - Tentativa de acesso com role insuficiente → 403.
  - Rate-limit excedido → 429.

- **Worker / Scheduler**

  - Forçar execução semanal (trigger manual) e checar criação de `report_*.pdf/csv`.
  - E-mail aparece no sandbox com links válidos; abrir PDF; CSV abre em planilha sem corromper acentuação (UTF-8, `,` separador).

- **Web**

  - Geração on-demand exibe progresso/estado; histórico pagina corretamente.

- **Retenção**

  - Setar TTL curto (ex.: 0 dias), rodar limpeza e confirmar remoção física + deslistagem.

---

### Checklist de implementação

1. **API**

   - `violations/export`: gerar **query iterativa** (chunk de IDs ou cursor) → **generator** → `StreamingResponse`.
   - `reports` endpoints: listagem + geração assíncrona (enfileirar job RQ).
   - Assinatura de download: token curto (`report:store:{id}:{path}:{exp}`) e verificação em rota de download.

2. **Worker**

   - Job `generate_report(store_id, range, filters)`:

     - Executa consulta agregada → renderiza PDF (template Jinja2 + Playwright/WeasyPrint).
     - Exporta CSV por streaming para arquivo em disco.
     - Salva `reports` (path/tamanho/expiração) e envia e-mail.

3. **Email**

   - Serviço `email.send_report(store, links|attachments)` com fallback para **links** se `size_bytes > N`.

4. **Web**

   - `Reports.jsx` + API client (`getReports`, `requestOnDemandReport`, `downloadReport`).

5. **Índices**

   - Alembic para `reports` (se adotado) + índices em violations.

6. **Segurança**

   - RBAC + rate-limit nas rotas; audit log com `user_id`, `store_id`, `params`, `status`.

7. **Docs**

   - `OpenAPI.md` atualizado; `README/CLI-CHEATSHEET`: exemplos de export e geração on-demand.

---

### Notas de performance

- Preferir **NDJSON** para grandes exports consumidos por pipelines.
- CSV: escrever **linha a linha**; escapar vírgulas/aspas; `evidence_json` **minificado** para reduzir tamanho.
- Caso o volume seja muito grande: passar para **export assíncrono** também no endpoint CSV (responder 202 com `job_id` e notificar quando pronto).

---

## T20 — Observabilidade 2.0 (SLO/OTel)

**Objetivo**

Métricas, tracing e alertas padronizados para operações, cobrindo API e workers, com SLOs explícitos e painéis prontos.

---

### Escopo — detalhar

- **Métricas (Prometheus)**

  - **API** (`fastapi`):

    - Expor `GET /metrics` (Prometheus client) com:

      - `http_requests_total{method,path_template,status}`
      - `http_request_duration_seconds{method,path_template,status}` (Histogram com buckets: `0.05,0.1,0.25,0.5,1,2,5,10`)
      - `rq_enqueues_total{queue}` (Counter) — incrementar quando enfileirar scans/ingests.
      - `db_session_duration_seconds` (Histogram) opcional via middleware.

    - Sanitizar `path_template` (usar rotas com `{id}` em vez do path literal).

  - **Workers** (`rq-feed`, `rq-crawl`):

    - Servir `/metrics` em cada worker (pequeno ASGI/WSGI ou thread HTTP interno) com:

      - `rq_jobs_in_progress{queue}`
      - `rq_job_duration_seconds{queue,job}` (Histogram)
      - `crawl_http_status_total{status,ua}` (Counter)
      - `crawl_errors_total{type}` (Counter: `timeout`, `dns`, `netreset`, `playwright`)
      - `crawl_bytes_total` (soma de HTML+PNG) opcional

  - **Coletores**:

    - `docker-compose.yml`: adicionar Prometheus (local) com scrape de `api:8000/metrics`, `rq-crawl:9000/metrics`, `rq-feed:9001/metrics`.

- **Tracing (OpenTelemetry)**

  - **API**:

    - Instrumentar FastAPI/Starlette, `httpx`, SQLAlchemy.
    - Exportador OTLP (`OTEL_EXPORTER_OTLP_ENDPOINT`), sampling ratio configurável.
    - Propagar `trace_id` no log (contextvar) e no header `traceparent`.

  - **Workers**:

    - Criar **span** por job (`scan_item`, `feed_ingest`), com atributos:

      - `gmc.store_id`, `gmc.run_id`, `gmc.feed_item_id`, `gmc.ua`, `http.url`, `http.status_code`

    - Propagar contexto: ao **enfileirar**, incluir `traceparent` no `job.meta`; no worker, extrair e continuar o trace.
    - Sub-spans no crawler: `page.goto`, `extract.sd`, `screenshot.save`.

- **SLOs / SLIs**

  - **Ingest**: p95 `< 2s` (SLI: `histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{path_template="/api/v1/stores/.*/feeds/ingest"}[5m])) by (le))`)
  - **Scan scheduling**: tempo entre `POST /scan` e **primeiro job iniciado** `< 60s` p95
    (SLI: `histogram_quantile(0.95, sum(rate(scan_schedule_latency_seconds_bucket[5m])) by (le))`)
  - **Erro global**: `< 1%` erro 5xx/4xx críticas (SLI: `sum(rate(http_requests_total{status=~"5..|429"}[5m])) / sum(rate(http_requests_total[5m]))`)
  - **Crawl sucesso**: `> 97%` de `200–399` (por loja e por UA).

- **Alertas (Prometheus/Alertmanager)**

  - **SLO breach** (alerta quando a média móvel excede limiar por 15 min):

    - `APIHighLatencyP95` → p95 ingest > 2s
    - `ScanSchedulingSlow` → schedule p95 > 60s
    - `HighErrorRate` → erro > 1% por 10 min
    - `CrawlerErrorSpike` → `crawl_errors_total` anômalo (z-score simples ou taxa > X/min)

  - **Infra**:

    - `NoScrapeAPI` / `NoScrapeWorker` (sem métricas por > 5m)
    - `RQBacklogHigh` (jobs `queued` > N por 10m)

- **Dashboards (Grafana)**

  - Pasta `docs/observability/grafana/` com JSONs:

    - **API Overview**: Throughput, p50/p95/p99, taxa de erro, top rotas lentas, 95º por rota, heatmap.
    - **Crawler**: taxa/histograma de duração por UA, HTTP status mix, erros por tipo, bytes/s, backlog por fila.
    - **SLO Board**: 3 SLOs com gauges e “burn-rate” 5m/1h.

- **Logs estruturados (reforço)**

  - Unificar formato: `{ts, level, msg, trace_id, request_id, job_id, store_id, user_id, path, method, status, dt_ms, error?}`.
  - API ↔ worker: propagar `trace_id` e `job_id` (na criação do RQ job).

---

### Configuração (.env.example)

```env
# Prometheus
PROMETHEUS_ENABLED=true
METRICS_BIND_HOST=0.0.0.0
METRICS_PORT_API=8000
METRICS_PORT_CRAWL=9000
METRICS_PORT_FEED=9001

# OpenTelemetry
OTEL_SERVICE_NAME=gmc-shield-api
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4317
OTEL_TRACES_SAMPLER=traceidratio
OTEL_TRACES_SAMPLER_ARG=0.2
OTEL_RESOURCE_ATTRIBUTES=deployment.environment=dev,service.version=local

# SLO thresholds (para regras/alarme)
SLO_INGEST_P95_SECONDS=2
SLO_SCAN_SCHEDULE_SECONDS=60
SLO_ERROR_RATE=0.01
```

---

### DoD

- **/metrics** disponível e scrapeado por Prometheus para API e **dois** workers.
- Grafana com **três dashboards** prontos e funcionando:

  - API Overview, Crawler, SLO Board.

- **Tracing**: traces completos da cadeia **Request → enqueue → job (crawl) → sub-spans** visíveis (pelo menos 1 exemplo).
- Alertas disparam nas violações (simuladas) e aparecem no Alertmanager (ou webhook de teste).
- SLOs calculados com consultas salvas e anotadas.

---

### Validações

- **Carga leve** (script `locust`/`hey`) em `/feeds/ingest` → painel mostra p95/p99 em tempo real.
- Forçar **erro** (resposta 500 simulada) → `HighErrorRate` dispara.
- Forçar **atraso** de fila (pausar worker) → `ScanSchedulingSlow` e `RQBacklogHigh` disparam.
- Abrir um **trace** no coletor (Jaeger/Tempo/OTel) e confirmar spans de `page.goto` e `screenshot.save`.

---

### Checklist de implementação

1. **API (metrics & tracing)**

   - Adicionar `prometheus_client` e middleware de métricas (latência, status, path_template).
   - Expor `GET /metrics` (usar Starlette `PlainTextResponse`).
   - Integrar OpenTelemetry: `opentelemetry-sdk`, `opentelemetry-instrumentation-fastapi`, `httpx`, `sqlalchemy`.
   - Contextvar para `trace_id` em logs; header `traceparent` de/para chamadas internas.

2. **Workers**

   - Pequeno servidor de métricas (thread `HTTPServer` na porta 9000/9001) registrando `rq_jobs_in_progress`, `rq_job_duration_seconds`, counters de status/erros.
   - OTEL: iniciar tracer, extrair `traceparent` do `job.meta` e criar spans; sub-spans no Playwright.

3. **Prometheus / Grafana**

   - `docker-compose.yml` com serviços `prometheus` e `grafana` (volumes persistentes).
   - `prometheus.yml` com `scrape_configs` para `api:8000/metrics`, `rq-crawl:9000/metrics`, `rq-feed:9001/metrics`.
   - Importar dashboards JSON de `docs/observability/grafana/`.

4. **Alertas**

   - Regras em `prometheus/rules/slo.yml`:

     - `APIHighLatencyP95`, `ScanSchedulingSlow`, `HighErrorRate`, `CrawlerErrorSpike`, `NoScrape*`, `RQBacklogHigh`.

   - Alertmanager com rota de webhook de teste (ou e-mail sandbox).

5. **SLOs**

   - Criar `docs/observability/SLOs.md` com SLIs, consultas PromQL e critérios de aceitação.
   - Painel “SLO Board” agregando as consultas.

6. **Logs**

   - Padronizar logger (API/worker) com JSON e inclusão de `trace_id`/`job_id`.
   - Validar correlação de logs ↔ traces (mesmo `trace_id`).

7. **Docs & Runbook**

   - `RUNBOOK.md`: como ler painéis, interpretar alertas e primeiros passos de mitigação.
   - `README.md`: seção “Observabilidade 2.0” com `docker compose up prometheus grafana` e credenciais padrão.

---

### Exemplos de regras (trechos)

```yaml
# prometheus/rules/slo.yml
groups:
  - name: api_slos
    rules:
      - record: api:ingest:p95
        expr: histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{path_template="/api/v1/stores/.*/feeds/ingest"}[5m])) by (le))
      - alert: APIHighLatencyP95
        expr: api:ingest:p95 > 2
        for: 15m
        labels: { severity: page }
        annotations:
          summary: "Ingest p95 alto"
          description: "p95 = {{ $value }}s > 2s nos últimos 15m"

  - name: scan_slos
    rules:
      - alert: ScanSchedulingSlow
        expr: histogram_quantile(0.95, sum(rate(scan_schedule_latency_seconds_bucket[5m])) by (le)) > 60
        for: 15m
        labels: { severity: page }
        annotations:
          summary: "Scan scheduling p95 > 60s"

  - name: errors
    rules:
      - alert: HighErrorRate
        expr: (sum(rate(http_requests_total{status=~"5..|429"}[10m])) / sum(rate(http_requests_total[10m]))) > 0.01
        for: 10m
        labels: { severity: warn }
        annotations:
          summary: "Taxa de erro > 1%"
```

---

### Notas práticas

- Em produção, preferir **OTLP → OTel Collector → Tempo/Jaeger + Prometheus** (em vez de exportar direto para Grafana Cloud).
- Se houver múltiplos workers por processo, considerar `prometheus_client` **multiprocess** ou expor métricas por processo e agregar no Prometheus.
- Não instrumentar rotas sensíveis com labels de alta cardinalidade (ex.: `user_id` no label) — use campos no **log**, não no **label**.

---

## T21 — Hardening & Prod Readiness

**Objetivo**

Endurecer a stack e padronizar operação para produção (segurança, artefatos, backups, recuperação e runbooks).

---

### Escopo — detalhar

#### 1) Containers & Runtime

- **Usuário não-root** em todas as imagens; `USER app`.
- **FS imutável**: `readOnlyRootFilesystem: true`; criar/montar apenas:

  - `/tmp`, `/var/tmp`, `/app/artifacts` (quando _local_) como `rw`.

- **Capacidades mínimas**: `drop: ["ALL"]`, `noNewPrivileges: true`, seccomp/apparmor padrão.
- **Limites de recursos**:

  - Compose: `deploy.resources.limits.cpus`, `memory`; equivalente em K8s (`resources.requests/limits`).

- **Health/Readiness**:

  - `GET /healthz` (liveness), `GET /readyz` (readiness: DB/Redis OK).
  - Probes configuradas no orquestrador (intervalos e timeouts explícitos).

- **Network/TLS**:

  - Reverso (Traefik/Nginx) **com TLS** (Let’s Encrypt) + **HSTS** (preload opcional).
  - CORS **estrito** (domínios de produção), `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`.

#### 2) Segredos & Config

- **Secrets via gerenciador** (AWS Secrets Manager / SSM / Doppler). Nada de segredos em git.
- **Rotação**:

  - `FERNET_KEYS` em **lista** (nova,antiga) — rotação sem downtime.
  - `JWT_SECRET` com `kid` no header (aceitar chave antiga até expirar).
  - Credenciais DB/Redis/Google com janela de sobreposição.

- **Fail-fast**: validação de env no startup (Pydantic Settings) — falhar se faltar crítico.

#### 3) Artefatos → S3/MinIO + Presign

- **Escrita**: substituir FS local por S3/MinIO em `services/artifacts.py` (put/get, delete).
- **URLs**: gerar **presigned URL** com expiração (ex.: 7 dias) para HTML/PNG/PDF/ZIP/HAR.
- **Lifecycle**:

  - Bucket com `lifecycle` (ex.: expira `snapshots/` em 30–90 dias; `reports/` em 365).
  - **Versioning** habilitado (opcional) + bloqueio de _public ACLs_.

- **Migração**: script `ops/migrate_artifacts_to_s3.py` (rsync → put; valida hashing).

#### 4) Backups & Restore

- **Postgres**:

  - **Backup diário** (`pg_dump` ou `pgbackrest`) criptografado (AES/GPG) para S3 dedicado (`gmcshield-db-backups/YYYY/MM/DD/*.sql.gz`).
  - **Retenção**: 7 dias (curto) + 30 dias (mensal) — políticas separadas.
  - **Checksum** + inventário (`backups/index.json`).

- **Artefatos**:

  - Confiar na durabilidade do S3; se crítico, **enable versioning** + _replication_ cross-region.

- **Restore** (documentado e **testado**):

  - Provisionar DB vazio → `pg_restore -d ...` → `alembic upgrade head` → validações SQL de contagem.

#### 5) Observabilidade & Operação

- Logs **JSON estruturado** (API/Workers) → stdout (coleta centralizada).
- **/metrics** scrapeado (Prometheus) — p95/p99, erros, backlog.
- **RUNBOOK.md**:

  - “Como rodar restore”, “Rotacionar chaves”, “Resgatar artefatos”, “Responder a incidentes”.

- **Check pós-deploy** automatizado (`ops/post_deploy_check.sh`): health, tags de versão, migrações aplicadas, permissões do bucket.

#### 6) Supply-chain & Compliance

- **Pin de dependências**: `requirements.txt` + `constraints.txt`; `npm ci` + `package-lock.json`.
- **Scanning** no CI:

  - **SBOM** (`syft`) e **vulns** (`trivy`/`grype`) para imagens e deps — _fail on high_.

- **Builds reprodutíveis**: imagens slim, sem ferramentas extras; `pip install --no-cache-dir --require-hashes`.
- **Política de dados**: minimizar PII; limpeza sob solicitação; logs sem dados sensíveis.

---

### .env.example (novos/ajustados)

```env
# Core
APP_ENV=production
API_BASE_URL=https://app.example.com
ALLOWED_ORIGINS=https://app.example.com
JWT_SECRET=base64:kid1:...
FERNET_KEYS=base64:new,base64:old

# DB/Cache
DATABASE_URL=postgresql+psycopg2://user:pass@db:5432/gmc_shield
REDIS_URL=redis://redis:6379/0

# Google OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_OAUTH_REDIRECT_URI=https://app.example.com/api/auth/google/callback
GOOGLE_OAUTH_SCOPES_BASE=openid email profile
GOOGLE_OAUTH_SCOPES_CONTENT=openid email profile https://www.googleapis.com/auth/content
GOOGLE_OAUTH_ISSUER=https://accounts.google.com

# Artifacts (S3/MinIO)
S3_ENDPOINT=https://s3.amazonaws.com
S3_REGION=us-east-1
S3_BUCKET=gmcshield-artifacts
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_PRESIGN_EXPIRES=604800  # 7 dias

# Backups
BACKUP_BUCKET=gmcshield-db-backups
BACKUP_CRON=0 3 * * *      # diário 03:00 UTC
BACKUP_GPG_PUBLIC_KEY_BASE64=
```

---

### DoD

- **Imagens** executam como **não-root**, FS **read-only**, health/readiness configurados.
- **Segredos** fora do repositório; rotação documentada e testada (FERNET/JWT).
- Artefatos **em S3/MinIO** com presign funcionando e lifecycle ativo.
- **Backup diário** armazenado e **restore testado** com sucesso (procedimento versionado).
- **RUNBOOK.md** e `ops/full_rebuild.sh` atualizados; _post-deploy check_ automatizado **PASS**.
- CI falha em vulnerabilidades **high/critical** e gera **SBOM**.

---

### Validações

- Rodar `ops/verify_prod_readiness.sh`:

  - Checagens: usuário do processo, FS de somente leitura, probes OK, CORS/headers, TLS válido.

- **Simulação de desastre**:

  - Subir ambiente novo → restaurar DB do último backup → apontar app → smoke de login, ingest, scan e download de artefatos (presign).

- **Teste de rotação**:

  - Adicionar nova FERNET em `FERNET_KEYS` (como primeira), reprocessar segredo de teste; remover chave antiga — nada quebra.

- **Scanning**:

  - Verificar job CI de `trivy`/`grype` e SBOM (`sbom.json`) arquivado.

---

### Itens práticos (checklist de implementação)

1. **Docker/K8s**: aplicar `USER`, volumes `rw` mínimos, `readOnlyRootFilesystem`, caps/drop, probes e limites.
2. **Artifacts**: trocar backend de FS → S3 (adapter); presign + lifecycle.
3. **Backups**: container `backup` com `pg_dump`→S3, criptografia e inventário; `restore.md` com comando exato.
4. **Secrets**: wire no entrypoint (Secrets Manager/SSM). Falha se não existirem.
5. **CI**: etapas `syft sbom`, `trivy image`, `pip --require-hashes`; **fail on high**.
6. **RUNBOOK** e **scripts** em `ops/` (post-deploy, migrate_artifacts, restore DB).
7. **TLS/Headers**: ajustar proxy; HSTS e CSP (whitelist Google OAuth conforme T2/T3).
8. **Testes**: smoke end-to-end pós-restore + verificação de presign/expiração.

---

## T22 — Public API, Webhooks & SDKs

**Objetivo**

Abrir integrações externas com **API Keys**, **webhooks assinados** e SDKs oficiais (Python/JS) — com segurança, idempotência e observabilidade.

---

### Escopo — detalhar

#### 1) Public API (com API Key)

- **Autenticação**

  - Novo esquema **API Key**: header `Authorization: Bearer <api_key>` (prefixos `gsk_test_` / `gsk_live_`).
  - Armazenar **hash** da chave (ex.: `sha256`) em `api_keys.token_hash` (nunca plaintext).
  - Escopos por chave (ex.: `violations:read`, `scan:write`, `blocks:write`, `feeds:read`).
  - Limite por **token** (ex.: 60 req/min) + por **IP** (burst control).

- **Rotas públicas (v1)** — espelham recursos já existentes, respeitando escopos:

  - `GET  /api/v1/public/stores/{store_id}/violations` — filtros `rule`, `severity`, `date_from`, `date_to`, paginação.
  - `POST /api/v1/public/stores/{store_id}/scan` — corpo mínimo `{limit_items?, recrawl?}` (se `scan:write`).
  - `GET  /api/v1/public/stores/{store_id}/scans` — listar runs (paginação).
  - `POST /api/v1/public/stores/{store_id}/blocks` — `{feed_item_id, reason?}` (se `blocks:write`).
  - `DELETE /api/v1/public/stores/{store_id}/blocks/{feed_item_id}` — (se `blocks:write`).
  - (Opcional e seguro) `GET /api/v1/public/stores/{store_id}/feeds/versions` (somente leitura).

- **Gestão de chaves (autenticado via JWT, não via API Key)**

  - `POST /api/v1/account/api-keys` → cria chave (retorna **uma vez** o valor claro).
  - `GET  /api/v1/account/api-keys` → lista (mas **nunca** exibe a chave).
  - `DELETE /api/v1/account/api-keys/{id}` → revoga.
  - Campos: `id`, `account_id`, `store_id?`, `name`, `scopes[]`, `prefix`, `token_hash`, `created_at`, `last_used_at`, `revoked_at`.

- **Segurança/observabilidade**

  - Dependency `require_api_key(scope=...)` com _lookups_ por hash e `revoked_at is null`.
  - Rate-limit por token; audit com `user_id?`=null e `api_key_id`.
  - Logs JSON incluem `api_key_prefix`, `scope_hit`, `store_id`.

---

#### 2) Webhooks (eventos assíncronos)

- **Eventos suportados**

  - `violations.created` (batelada ou um-a-um),
  - `item.blocked`, `item.unblocked`,
  - `scan.completed`.

- **Configuração** (autenticado via JWT)

  - `POST /api/v1/webhooks/endpoints` → `{url, events[], secret?}` (gera `secret` se omitido).
  - `GET  /api/v1/webhooks/endpoints` / `DELETE /{id}` / `POST /{id}/rotate-secret`.
  - Tabela `webhook_endpoints(id, store_id, url, secret_enc, events_json, enabled, created_at, updated_at)`.

- **Entrega & Retentativas**

  - Worker `webhook-dispatcher` publica `POST {url}` com payload:

    ```json
    {
      "id": "evt_123",
      "type": "violations.created",
      "created_at": "2025-01-01T12:00:00Z",
      "store_id": 1,
      "data": { ...domain object... }
    }
    ```

  - **Assinatura HMAC-SHA256** com `secret`: header
    `GMC-Signature: t=<unix_ts>, v1=<hex(hmac_sha256(secret, t + "." + body))>`
    e `GMC-Event-Id: evt_123`.
  - **Proteção replay**: rejeitar `t` fora da janela (ex.: 5 min).
  - **Retentativas**: backoff exponencial com jitter (ex.: 0s, 30s, 2m, 10m, 1h; máx 5).
  - Persistir em `webhook_deliveries(id, webhook_id, event_id, type, attempt, status, http_code, latency_ms, error, next_attempt_at, created_at)`.

- **Ferramentas**

  - `POST /api/v1/webhooks/test` → dispara evento sintético para um endpoint.
  - Reentrega manual: `POST /api/v1/webhooks/deliveries/{id}/retry`.

- **Requisitos do endpoint do cliente**

  - `HTTPS` obrigatório (exceto em `APP_ENV=development`).
  - Responder `2xx` para ack; `5xx/timeout` conta como falha; `4xx` **não** reententa (exceto 429 com `Retry-After`).

---

#### 3) SDKs oficiais

- **Python (`sdks/python/`)**

  - `gmcshield.Client(base_url, api_key)` (sync com `requests` ou `httpx` sync).
  - Métodos:
    `list_violations(store_id, **filters)`,
    `create_scan(store_id, **opts)`,
    `list_scans(store_id, **page)`,
    `block_item(store_id, feed_item_id, reason=None)`,
    `unblock_item(store_id, feed_item_id)`.
  - Utilitário: `verify_webhook_signature(raw_body, header, secret, tolerance=300)`.
  - **CLI** (`gmcshield` via `click`):
    `gmcshield violations --store 1`, `gmcshield scan --store 1 --limit 20`.

- **JavaScript/TypeScript (`sdks/js/`)**

  - ESM: `import { GMCShield } from 'gmcshield'`.
  - Node (fetch/undici) e browser.
  - Métodos equivalentes aos do Python.
  - Util `verifyWebhookSignature(rawBody, signatureHeader, secret, toleranceSec)` (Node).

- **Empacotamento**

  - Python: `pyproject.toml`, `poetry`/`setuptools`; publish local (editable) → futuro PyPI.
  - JS: `package.json`, `types`, build `tsup/rollup`; publish local (link) → futuro npm.

---

#### 4) OpenAPI & Docs

- **OpenAPI**: adicionar **securityScheme** `apiKey` (bearer) e anotar rotas `public/*` com escopos.
- **Webhooks**: seção com **esquema de payload**, exemplo de headers e **exemplo de verificação** (Python/Node).
- **Exemplos**: cURL e snippets dos SDKs.
- **Página “Integrations”** na webapp: gerar/rotacionar chave, configurar webhooks, enviar evento de teste.

---

### .env.example (novos)

```env
# Public API
API_KEYS_PREFIX=gsk
API_RATE_LIMIT_PER_TOKEN_PER_MIN=60

# Webhooks
WEBHOOK_TIMEOUT_MS=5000
WEBHOOK_MAX_RETRIES=5
WEBHOOK_USER_AGENT=gmcshield-webhook/1.0
WEBHOOK_TOLERANCE_SEC=300
```

---

### Modelo de dados (Alembic)

- `api_keys`:

  - `id`, `account_id`, `store_id?`, `name`, `scopes_json`, `prefix`, `token_hash`,
    `created_at`, `last_used_at`, `revoked_at`.
  - Índices: `(token_hash) unique`, `(account_id)`, `(store_id)`.

- `webhook_endpoints`:

  - `id`, `store_id`, `url`, `secret_enc`, `events_json`, `enabled`,
    `created_at`, `updated_at`.

- `webhook_deliveries`:

  - `id`, `webhook_id`, `event_id`, `type`, `attempt`, `status`,
    `http_code`, `latency_ms`, `error`, `next_attempt_at`, `created_at`.
  - Índices por `webhook_id`, `created_at`, `status`.

---

### Segurança & Boas práticas

- **Chaves**: mostrar **apenas uma vez** no create; permitir “reveal” **não** (só rotacionar).
- **Scopes** mínimos; negar por padrão.
- **Rate-limit** por token + por IP (burst control); 429 com `Retry-After`.
- **Assinatura**: HMAC com `secret` **por endpoint** (não global); rotate sem downtime (aceitar _active_ + _previous_ por 24h).
- **Idempotência**: `GMC-Event-Id` + dedupe 24h para o consumidor.
- **Auditoria**: logar `api_key_id`, `webhook_id`, `event_id`, `attempt`.

---

### DoD

- **Webhooks** entregues para um endpoint público (ngrok) com `GMC-Signature` válido; retentativas e DLQ funcionam.
- **Public API** acessível com **API Key** e escopos; rate-limit efetivo.
- **SDKs** (Python/JS) conseguem: listar violações, abrir scan e verificar assinatura de webhook.
- **OpenAPI** documenta security scheme, exemplos e seção de webhooks.

---

### Validações

1. **API Key**

   - `POST /api/v1/account/api-keys` → copiar chave; `GET /api/v1/public/stores/1/violations` com `Authorization: Bearer`.
   - Forçar >60 req/min → receber `429`.

2. **Webhooks**

   - Criar endpoint em `https://<ngrok>/hooks/gmc`.
   - `POST /api/v1/webhooks/endpoints` com `{url, events:["scan.completed"]}`.
   - Disparar `POST /api/stores/1/scan` → receber evento; verificar HMAC com util do SDK.
   - Forçar `500` no receptor → observar **retentativas** (logs + `webhook_deliveries`).

3. **SDKs**

   - Python: `pip install -e sdks/python`, `gmcshield violations --store 1` → saída OK.
   - JS: `node examples/list-violations.mjs` com `GMC_API_KEY` configurada.

---

### Observações finais

- Cada tarefa é incremental e usa as estruturas já presentes (`api/app/routers/*`, `services/*`, `plugin-woo/`, `web/src/*`).
- Toda migração de DB vem com script Alembic e teste básico.
- Testes **sem Docker**; workers/app com Docker quando necessário.
