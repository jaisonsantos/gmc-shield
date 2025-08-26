# GMC Shield — Task Plan (T23–T37)

> Fase 3 — Escala, Compliance & Ecossistema. Continuação incremental dos blocos T0–T22 (mesmo padrão: Objetivo, Escopo, DoD, Validações). Sem estimativas de prazo.

---

### T23 — Internacionalização (i18n) & Localização (l10n) v1

**Objetivo**
Tornar o produto utilizável em **PT/EN/ES** com formatação regional consistente (datas, números, moeda) e seleção/perfil de idioma persistente.

---

### Escopo — detalhar

#### 1) Web (React) — i18next + Intl

- **Infra de i18n**

  - Adicionar `i18next`, `react-i18next`, `i18next-browser-languagedetector`.
  - Pasta: `web/src/i18n/`

    - `index.js` (setup, fallbackLng=`en`, detection: localStorage → navigator → query).
    - Dicionários: `locales/en/common.json`, `locales/pt/common.json`, `locales/es/common.json`.

  - **Provider**: em `web/src/main.jsx`, envolver app com `<I18nextProvider>` e `<Suspense>` (lazy-load de bundles).
  - **Lint**: regra opcional `i18next/no-literal-string` para evitar strings “cruas” nos componentes (excluir placeholders/IDs).

- **Uso nos componentes**

  - Substituir strings em `web/src/pages/*.jsx` e `components/*.jsx` por `t('chave')`.
  - Padronizar chaves: `nav.login`, `feeds.title`, `scans.start`, `violations.empty`, etc.
  - **Pluralização**: usar `{{count}}` e `t('itens', { count })`.

- **Seleção de idioma**

  - Componente `LanguageSwitcher` (ex.: no `AppShell.jsx`) com PT/EN/ES.
  - Persistir escolha em **localStorage** e, quando logado, sincronizar com perfil (`/api/v1/me/preferences`).

- **Formatação local**

  - Datas/números/moeda com **Intl API**:

    - `formatCurrency(cents, currency, locale)`: `new Intl.NumberFormat(locale, { style: 'currency', currency }).format(cents/100)`.
    - `formatDate(dt, locale)`: `new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' })`.

  - Criar helpers em `web/src/lib/format.js` e **não** repetir lógica nas páginas.

#### 2) API (FastAPI) — negotiation + Babel

- **Locale negotiation**

  - Middleware/Dependência `get_locale()`:

    - ordem: `user.locale` (se autenticado) → `store.default_locale?` → header `Accept-Language` → `settings.DEFAULT_LOCALE` (`en_US`).

  - Injetar `locale` no contexto de request (contextvar) para logs e formatação.

- **Formatação**

  - Adicionar `Babel` (`babel` Python):

    - `format_currency(value/100, currency, locale)`, `format_datetime`, `format_decimal`.

  - Em respostas “human-friendly” (e-mails, PDFs, relatórios), usar Babel; em respostas de API **técnicas**, manter valores crus e incluir `display_*` opcional (ex.: `display_price`).

- **Preferências do usuário**

  - **Nova rota**: `GET/PUT /api/v1/me/preferences` com payload `{ locale: "pt_BR"|"en_US"|"es_ES" }`.
  - **Migração**: coluna `users.locale VARCHAR(10)` (nullable), default `NULL`.

- **Templates (Jinja2)**

  - Estrutura:

    ```
    api/templates/
      policies/
        privacy.en.md.j2
        privacy.pt.md.j2
        privacy.es.md.j2
        refund.en.md.j2
        refund.pt.md.j2
        refund.es.md.j2
        shipping.en.md.j2
        shipping.pt.md.j2
        shipping.es.md.j2
      appeals/
        base.en.md.j2
        base.pt.md.j2
        base.es.md.j2
    ```

  - **Chaves comuns** nos contextos: `store`, `contact`, `country`, `currency`, `today`, etc.
  - Função helper: `render_template(name, locale, ctx)` resolve automaticamente o sufixo (`.pt.`/`.es.`/fallback `.en.`).

#### 3) Web + API — E-mails/Relatórios/PDF

- **E-mails** (notificações, convites): seleccionar template por `user.locale`/negociação; assinar com o mesmo estilo de data/moeda.
- **Relatórios/PDF (Appeal Kit)**: campo `locale` no request/rota; default = negotiation. Formatadores integrados.

#### 4) Catálogo de chaves e processo de tradução

- **Catálogo**

  - `scripts/i18n/extract.js` (ou usar `i18next-parser`) para extrair chaves do `web/src/**`.
  - Geração de `locales/*/missing.json` no CI (falhar se >0 chaves faltando em produção).

- **Guia de tradução**

  - Documento curto em `docs/i18n.md` (convenções de chaves, pluralização, placeholders, review).

---

### .env.example (novos)

```env
DEFAULT_LOCALE=en_US
SUPPORTED_LOCALES=en_US,pt_BR,es_ES
```

---

### Migrações (Alembic)

- `0008_user_locale.py`

  - `ALTER TABLE users ADD COLUMN locale VARCHAR(10);`
  - Índice opcional por consultas agregadas não necessário.

---

### Testes

- **Web**

  - Snapshot tests de componentes principais em 3 idiomas (mocks de `t`/i18next).
  - Teste do `LanguageSwitcher`: troca sem reload e persistência em localStorage.
  - Teste de helpers `formatCurrency`, `formatDate` (EN/PT/ES).

- **API**

  - Unit: `get_locale()` com combinações (user.pref, Accept-Language, fallback).
  - Unit: `render_template()` seleciona arquivo correto; fallback para `en` quando ausente.
  - Integração: `GET /api/v1/me/preferences` round-trip; `PUT` salva e afeta renderização subsequente.

- **Templates**

  - Snapshot de `policies`/`appeals` (render com contexto fixo) nos 3 idiomas; verificar placeholders preenchidos.

---

### DoD

- Usuário alterna idioma na UI, preferência persiste (localStorage + conta quando logado).
- Páginas principais (Login, Dashboard, Feeds, Items, Scans, Violations, Policies, Appeals, Settings) sem strings “cruas”.
- Políticas e textos de apelação gerados em **PT/EN/ES**, com datas/moedas localizadas.
- API respeita `Accept-Language` quando `user.locale` não estiver definida.
- CI falha se houver chaves faltantes em ambientes de release.

---

### Validações

- **Checklist de telas**: percorrer todas e confirmar tradução/sem truncamentos.
- **Smoke i18n**:

  - Definir `es_ES` em `/me/preferences` → UI/relatórios em ES.
  - Enviar `Accept-Language: pt-BR` sem preferência do usuário → respostas/templatização em PT.

- **QA de formatação**:

  - `price_cents=123456`, `currency=EUR`:

    - EN: `€1,234.56`
    - PT: `€ 1.234,56`
    - ES: `1.234,56 €`

---

### Notas de Implementação

- **Fallbacks**: `en` sempre presente; se um arquivo `{locale}` estiver faltando, usar `en` e logar aviso.
- **Não duplicar lógica**: valores “de negócios” permanecem crus no payload; exibições localizadas apenas em campos `display_*` ou no front.
- **SEO/URLs**: sem i18n por rota agora (não necessário para app SPA autenticada).
- **Acessibilidade**: trocar `lang` no `<html>` dinamicamente (`document.documentElement.lang = 'pt'|'en'|'es'`).

---

### T24 — Extração de Structured Data (SD) Avançada

**Objetivo**

Extrair e normalizar **JSON-LD/Microdata/RDFa** para `Product`/`Offer`/`AggregateOffer` com _fallback_ e **modelo canônico** único que alimente regras (T23) e a UI (viewer).

---

## Escopo — detalhar

### 1) Pipeline & Dependências

- **Entrada**: HTML bruto do snapshot (`page.html`) já persistido em `artifacts/…`.
- **Bibliotecas**:

  - Adicionar no `api/requirements.txt`:
    `extruct>=0.17`, `w3lib>=2.1`, `html5lib>=1.1` (parser robusto para JSON-LD/Microdata/RDFa).

- **Execução**:

  - Novo módulo `api/app/services/sd_extract.py` com:

    - `extract_all(html:str, base_url:str) -> SDExtractResult`
    - `canonicalize_sd(sd:SDExtractResult) -> CanonicalProduct`

  - Consumido pelo crawler no ponto onde já salvamos o HTML (T2/T15):

    - Carrega HTML → `extruct.extract(html, base_url=...)` (sources: `json-ld`, `microdata`, `rdfa`).
    - Normaliza e _mergeia_ objetos relevantes.

### 2) Escopo de dados & Resolução de fontes

- **Ordem de prioridade**: `JSON-LD > Microdata > RDFa`.
- **Seleção de nós**:

  - Filtrar objetos com `@type` contendo `Product` (direto ou em `@graph`/lista).
  - Encontrar `Offer`/`AggregateOffer` **associados** ao `Product`:

    - Por campos `offers`, `hasOfferCatalog`, ou _sibling_ no mesmo bloco.

- **Deduplicação de produtos**:

  - Chave de _merge_: `sku` ou `gtin*` (GTIN-14/13/12/8) ou `url` (normalizada).
  - Se múltiplos _candidatos_: preferir aquele cujo `url` bate com a URL canônica da página; senão o que tiver mais campos válidos (score simples).

### 3) Mapeamento Canônico (modelo alvo)

Estrutura final (armazenada dentro de `page_snapshots.extracted.sd`):

```json
{
  "version": "t24.v1",
  "source": "jsonld|microdata|rdfa|mixed",
  "product": {
    "name": "…",
    "description": "…",
    "brand": "…",
    "sku": "…",
    "gtin": "…",
    "mpn": "…",
    "url": "…",
    "image": ["…"],
    "offers": {
      "type": "Offer|AggregateOffer",
      "price_cents": 12345,
      "currency": "USD",
      "availability": "in_stock|out_of_stock|preorder|backorder|limited|discontinued|unknown",
      "low_price_cents": 10000,
      "high_price_cents": 15000
    }
  },
  "raw": {
    "jsonld": [...],
    "microdata": [...],
    "rdfa": [...]
  },
  "conflicts": [
    {"field":"price","values":[{"src":"jsonld","value":"19.99 USD"},{"src":"microdata","value":"R$ 99,90"}]}
  ]
}
```

### 4) Normalizações

- **Preço & Moeda**:

  - Extrair `price`/`priceCurrency` de `Offer` **ou** `AggregateOffer.lowPrice|highPrice`.
  - Converter preço → **centavos** (`int`) com detecção de locale (vírgula/ponto).
  - `currency`: 3 letras **ISO-4217** (upper). Se ausente:

    - Tentar deduzir do texto do preço ou _locale_ da loja; senão `None`.

- **Disponibilidade**:

  - Mapear URLs schema.org → enum interno:

    - `InStock`→`in_stock`, `OutOfStock`→`out_of_stock`, `PreOrder`→`preorder`,
      `PreSale`→`preorder`, `BackOrder`→`backorder`, `Discontinued`→`discontinued`,
      `LimitedAvailability`→`limited`, desconhecido→`unknown`.

- **Identificadores**:

  - **GTIN**: usar `normalize_gtin` existente (T1); aceitar `gtin`, `gtin8`, `gtin12`, `gtin13`, `gtin14`.
  - **SKU/MPN**: `clean_text` e `strip`.

- **Links/Imagens**:

  - `canonicalize_link` para `url`; `image` sempre lista (dedupe + absolutizar com `w3lib.url.urljoin`).

- **Conflitos**:

  - Se fontes divergirem (ex.: `price`), registrar em `conflicts` e escolher valor pela prioridade (JSON-LD primeiro).
  - Sinalizar `SD_CONFLICT` (T15) com _evidence_.

### 5) Persistência & Versionamento

- **Onde gravar**: `page_snapshots.extracted` (JSON) ganha subcampo `sd` com a estrutura acima.
- **Hash**:

  - Calcular `sd_hash = sha256(json.dumps(sd.product, sort_keys=True))` e gravar (campo novo opcional: `sd_hash`).
  - Se `html_sha256` não mudou (T16), pular reprocessamento de SD (cache leve).

### 6) Performance & Resiliência

- `extruct` com `syntaxes=["json-ld","microdata","rdfa"]`, parser `html5lib` (mais tolerante).
- **Timeout** de parsing (soft) e _try/except_ por fonte — uma falha em RDFa não bloqueia JSON-LD.
- Log estruturado por snapshot: `{store_id, run_id, ua, sd_source, fields_found, conflicts}`.

---

## DoD (Definition of Done)

- Páginas demo (ao menos 4 casos):

  1. **Product + Offer** (JSON-LD) → `price_cents/currency/availability` preenchidos.
  2. **AggregateOffer** → `low_price_cents/high_price_cents` preenchidos.
  3. **Microdata only** → produto canônico preenchido via fallback.
  4. **Conflitante** (JSON-LD vs Microdata) → `conflicts` populado e valor canônico vindo da prioridade.

- `page_snapshots.extracted.sd` presente com `version="t24.v1"`; `source` correto.
- UI (viewer de evidências do T8) exibe bloco **SD** (pretty JSON) e _badge_ com fonte.

---

## Validações

- **Unit tests** (`api/tests/test_sd_extract.py`):

  - Fixtures de HTML: `product_offer_ld.json`, `aggregate_offer_ld.json`, `microdata_only.html`, `conflicting.html`.
  - Asserts:

    - Mapeamento de `availability` para enum interno.
    - `price_cents/currency` corretos com vírgula e ponto.
    - `gtin` normalizado (8/12/13/14) e inválidos → `None`.
    - `conflicts` preenchido quando divergirem valores.

- **Integração**:

  - Rodar um scan pequeno (2 itens × 2 UAs) e verificar `extracted.sd` presente.
  - Confirmar _cache_: reaplicar SD quando `html_sha256` **mudar**; manter quando igual.

---

## Mudanças no Código (pontos de integração)

- **Novo** `api/app/services/sd_extract.py`

  - Funções: `extract_all`, `canonicalize_sd`, `map_availability`, `parse_price_currency`.

- **Ajuste** `api/app/services/crawler.py`

  - Após salvar `page.html`, carregar conteúdo e chamar SD extractor; inserir `sd` em `extracted_json`.

- **Schemas** (se expor via API)

  - Opcional: rota `GET /api/stores/{id}/runs/{run_id}/snapshots?...` incluir `extracted.sd.product` resumido (ocultar `raw` por padrão).

- **Requirements**

  - Adicionar `extruct`, `w3lib`, `html5lib`.

---

## Anotações de Implementação

- **Robustez em JSON-LD**: lidar com `@graph`, listas dentro de `script[type="application/ld+json"]`, objetos aninhados e _compacted/expanded_ context.
- **AggregateOffer**:

  - Se `offers` contiver `AggregateOffer`, preencher `low/high price`; se houver também `Offer` simples, priorizar `Offer` quando SKU único.

- **Moeda ausente**:

  - Tentar: `priceCurrency` → símbolo no `price` (`R$`, `$`, `€`) → _hint_ da loja (`store.currency`) → `None`.

- **Disponibilidade em texto**:

  - _Fallback_ heurístico (último recurso): “em estoque”, “esgotado”, “pre-venda” por idioma (PT/EN/ES) se SD não trouxer enum.

---

## .env.example (adições)

```env
SD_EXTRACT_ENABLED=true
SD_EXTRACT_PARSER=html5lib
```

---

Com isso, T24 **estende** o T15: troca o parser ad-hoc por uma extração **unificada e robusta**, entrega um **modelo canônico** estável, registra **conflitos** e prepara terreno para regras avançadas (T23) e para o **Evidence Viewer** exibir SD com confiança.

---

### T25 — Rule Pack v2 (Cobertura & Calibração)

**Objetivo**
Ampliar **cobertura** de detecções, reduzir **falsos positivos** e permitir **tuning** por loja/regra/sku.

---

## Escopo — detalhar

### 1) Novas regras & lógica de detecção

Implementar em `api/app/services/rules_v2.py` (ou evoluir módulo atual de regras) com saída padronizada:

```py
Violation(
  rule_code:str, severity:str,  # critical|major|minor
  feed_item_id:str, store_id:int, run_id:int|None,
  evidence:dict,               # campos mínimos abaixo por regra
)
```

Gravar em `violations` (já existente) e **não duplicar**: dedupe por `(store_id, feed_item_id, rule_code, hash(evidence_core))` no run atual.

- **GTIN_INVALID**
  Critério: `normalize_gtin(gtin)` retorna `None` **ou** falha em mod10.
  Evidência: `{gtin_raw, reason:"mod10|length|chars"}`.
  Fonte: `feed_items.gtin` **ou** SD (T24).

- **MPN_MISSING**
  Critério: `mpn` ausente se **loja exigir** (flag/override).
  Evidência: `{required: true, found: false}`.
  Fonte: feed item / SD.

- **CURRENCY_MISMATCH**
  Critério: `currency` em SD/DOM ≠ `store.currency` **e** ≠ `feed_items.currency`.
  Evidência: `{seen:"USD", expected:["BRL","…"], price_source:"sd|dom|feed"}`.

- **CANONICAL_MISMATCH**
  Critério: `<link rel="canonical">` (normalizado) difere de `feed_items.link_canonical`.
  Evidência: `{canonical_html, canonical_feed}`.
  Fonte: HTML + helper `canonicalize_link`.

- **ROBOTS_NOINDEX**
  Critério: `meta[name="robots"~="noindex"]` **ou** header `X-Robots-Tag: noindex`.
  Evidência: `{meta:"noindex", header:false}`.
  Fonte: `page_snapshots.headers_json` (T16) + HTML.

- **SD_CONFLICT**
  Critério: `extracted.sd.conflicts` **não vazio** (T24).
  Evidência: `{conflicts:[{field,values:[{src,value}...]}]}`.

- **TITLE_LENGTH_OUT_OF_RANGE**
  Critério: `len(clean_text(title))` fora de `[min_len, max_len]` (defaults 5..150; override por loja).
  Evidência: `{length, min, max, title_sample}`.

- **IMG_TOO_SMALL_OR_MISSING_ALT** (heurística leve, sem baixar imagens)
  Critério: primeira imagem “principal” (`img[itemprop=image]` ou `og:image` fallback):

  - `width|height` (attr ou style inline) < `min_px` (default 300) **ou**
  - `alt` vazio/ausente em imagens do produto.
    Evidência: `{img_src, width, height, alt_present, min_px}`.

- **PRICE_INVISIBLE_OR_OBSCURED** (heurística)
  Critério: SD/Offer tem `price`, mas **DOM visível** não possui padrão de preço na _viewport_:

  - Buscar texto com regex de preço (`R$|€|\$|\d[.,]\d{2}`) em nós visíveis (excluir `display:none`, `visibility:hidden`, `opacity:0` via inspeção de atributos inline/classe simples).
    Evidência: `{sd_price_cents, found_in_dom:false, selectors_checked:n}`.
    _(Se precisar refino posterior: marcar **experimental** e permitir desligar por loja.)_

> Severidade sugerida (defaults):
> `GTIN_INVALID, ROBOTS_NOINDEX` → **major**;
> `CURRENCY_MISMATCH, CANONICAL_MISMATCH, SD_CONFLICT, PRICE_INVISIBLE_OR_OBSCURED` → **major**;
> `MPN_MISSING, TITLE_LENGTH_OUT_OF_RANGE, IMG_TOO_SMALL_OR_MISSING_ALT` → **minor**.

---

### 2) Configuração por loja (thresholds & toggles)

- **Tabela nova** `store_rule_overrides`:

  ```
  (id, store_id, rule_code, enabled BOOLEAN DEFAULT true,
   severity ENUM('critical','major','minor') NULL,
   params_json JSONB NULL,  -- ex.: {"min_title_len":7,"max_title_len":120,"min_img_px":400}
   updated_at)
  ```

- **Resolução de config**: `effective = defaults.merge(overrides_by_store.get(rule_code, {}))`.
- **Defaults globais** em `api/app/services/rules_defaults.py` (constante).

---

### 3) Waivers & Falsos positivos

- **Tabela nova** `violation_overrides`:

  ```
  (id, store_id, feed_item_id, rule_code,
   status ENUM('waived','fp'), note TEXT, expires_at TIMESTAMPTZ NULL,
   by_user_id, created_at)
  ```

- **Aplicação**:

  - Listagens **excluem** por padrão violação com override ativo (não expirado).
  - Filtros: `include_waived=true|false`, `include_fp=true|false`.

- **Efeitos**:

  - KPIs/contagens ignoram `waived/fp` por padrão; UI mostra _badge_ e opção de reverter.

---

### 4) Pipeline & execução

- **Quando rodar**: após cada snapshot (T2/T16), um _job_ `rules:evaluate` em lote por `run_id` **ou** incremental por `feed_item_id`.
- **Idempotência**: dedupe por `(store, item, rule_code, run_id)` + hash de evidência essencial.
- **Reprocessamento**: endpoint `POST /api/stores/{id}/violations/recalculate?since=` (admin) para recalibrar após mudança de config.

---

### 5) API

- `GET  /api/v1/stores/{id}/rules/config` → configs efetivas + overrides.
- `PUT  /api/v1/stores/{id}/rules/config/{rule_code}` → salvar override (enabled/severity/params).
- `POST /api/v1/stores/{id}/violations/{violation_id}/override` body: `{status:'waived'|'fp', note?, expires_at?}`.
- Listagens existentes de violações:

  - Novos filtros: `rule_code[]`, `severity[]`, `include_waived`, `include_fp`.
  - Campos extras: `override_status`, `override_expires_at`.

---

### 6) UI (ajustes mínimos)

- **Violations.jsx**:

  - Colunas: `Rule`, `Severity`, `Override` (none/waived/fp), `Actions` (Waive/Mark FP/Undo).
  - Filtros por `rule_code`/`severity`; _toggle_ “mostrar waived/fp”.

- **Settings → Rules**:

  - Lista de regras com `enabled`, `severity`, `params` editáveis (min/max title, min img px, exigir MPN etc.).

---

### 7) Migrações & índices

- Alembic:

  - `store_rule_overrides` (idx por `store_id`, `rule_code`).
  - `violation_overrides` (idx por `store_id`, `feed_item_id`, `rule_code`, `expires_at`).
  - `violations` adicionar índice composto `idx_violations_store_item_rule_created`.

---

## DoD

- Dataset sintético cobre todas as novas regras:

  - páginas/itens com GTIN inválido; título curto/long; robots noindex; canonical divergente; moeda divergente; SD conflitante; imagem pequena/sem alt; preço só no SD.

- UI exibe severidade, filtros e estado **waived/fp**; ação **Waive/Mark FP** aplica override imediato.
- Overrides impactam KPIs e listagens (exclusão por padrão), preservando trilha de auditoria.

---

## Validações

- **Unit tests** por regra (`api/tests/rules_v2/`), cobrindo:

  - GTIN mod10/len; parser de `<link rel=canonical>`; parse de `meta robots`; conflitos SD (T24 fixtures).
  - Heurísticas de imagem/alt e preço visível (fixtures de HTML).

- **Integração**:

  - Rodar avaliação em lote sobre snapshots reais de demo; checar dedupe e severidade.

- **Tuning**:

  - Alterar `min_title_len` por loja → reprocessar → ver impacto na contagem.

- **Waivers**:

  - Marcar uma violação como `waived` e outra como `fp`; confirmar que somem das contagens por padrão, mas aparecem quando “mostrar waived/fp” está ativo.

---

## Notas de implementação

- Para `PRICE_INVISIBLE_OR_OBSCURED`, manter **fallback simples** (texto visível) e marcar a regra como **experimental** no config (permite desligar se gerar FP).
- Para `IMG_TOO_SMALL_OR_MISSING_ALT`, confiar em `width/height`/`style`/`srcset` no HTML quando presentes; caso não existam, **não** disparar (evitar FP).
- `CURRENCY_MISMATCH`: tolerar símbolos equivalentes (`R$`↔`BRL`), e normalizar antes de comparar.

---

## .env.example (adições)

```env
RULES_V2_ENABLED=true
RULES_EXPERIMENTAL_PRICE_VISIBILITY=false
```

Com isso, o Rule Pack v2 entrega **cobertura ampliada**, **configurabilidade por loja**, e um fluxo claro de **waiver/false-positive**, reduzindo ruído e mantendo rastreabilidade.

---

### T26 — Performance & Custo do Crawler

**Objetivo**
Otimizar **throughput** e **custos** (rede/CPU/armazenamento) do crawler, mantendo limites por host e por plano.

---

## Escopo — detalhar

### 1) Concorrência + filas por host (token bucket)

- **Pool Playwright**: abrir **1 browser** e `WORKER_MAX_CONTEXTS` contexts (env, default `4`); 1 página por contexto.
- **Fila por host** em Redis:

  - Chaves: `crawl:host:{host}:tokens`, `crawl:host:{host}:last_refill`.
  - Parâmetros (env): `CRAWL_PER_HOST_QPS` (default `0.5`), `CRAWL_GLOBAL_QPS` (default `3`).
  - **Token bucket**: antes de navegar, adquirir 1 token (host + global). Se sem token, aguardar **backoff exponencial** com jitter (max 3s).

- **Timeouts/orçamentos**:

  - `CRAWL_NAV_TIMEOUT_MS=25000` (Playwright).
  - `CRAWL_PAGE_BUDGET_MS=40000` (orçamento total de job; abort se exceder).
  - Retry até **2x** para `ECONNRESET`, `ERR_NAME_NOT_RESOLVED`, `ETIMEDOUT`.

### 2) Cache HTTP (24h) com **ETag/Last-Modified** + dedupe por hash

- Tabela `page_snapshots` (T16) — **adicionar colunas** via Alembic:

  - `cache_status ENUM('miss','revalidated','hit_samehash','bypass')`
  - `reused_from_snapshot_id INT NULL`
  - `bytes_html INT NULL`, `bytes_png INT NULL`

- **Tabela/kv de cache** (Redis) por URL+UA+store:

  - `crawl:cache:{store_id}:{ua}:{url_hash} → {etag,last_modified,html_sha256,last_snapshot_id,bytes_html,bytes_png,ts}`

- **Fluxo**:

  1. Se entrada presente e `ts` < `CACHE_TTL_DEFAULT_H` (env; default 24h), enviar `If-None-Match/If-Modified-Since`.
  2. **304** → snapshot “leve”: `cache_status='revalidated'`, **reusar** `html_path/screenshot_path` do `last_snapshot_id` (preencher `reused_from_snapshot_id`).
  3. **200** → calcular `sha256(html)`:

     - Igual ao `html_sha256` → `cache_status='hit_samehash'`, reusar artefatos (não salvar novos bytes).
     - Diferente → `cache_status='miss'`, salvar artefatos e atualizar entrada de cache.

- **Observação**: se `no-store`/`private` em headers → `cache_status='bypass'` (não cachear).

### 3) Retenção orientada a custo

- Job diário `retention:gc` (comando no worker):

  - `RETENTION_DAYS_FULL=7` (HTML+PNG), `RETENTION_DAYS_META=30` (apenas metadados).
  - **Regras por plano** (ver §4): planos menores: `RETENTION_DAYS_FULL=3`.
  - Ao migrar para “meta”: remover `page.html/page.png` e manter `html_sha256`, `bytes_*`, `screenshot_sha256`.

- **Downsampling** opcional de PNG (se `KEEP_SCREENSHOTS_DOWNSAMPLED=true`): substituir `page.png` por versão JPEG 70% > 30 dias.

### 4) Limites por plano (itens/dia, MB/dia, tempo/página)

- **Tabelas**:

  - `plans(id, code, name, max_items_per_day, max_mb_per_day, max_page_time_ms, retention_full_days, retention_meta_days)`
  - `store_plans(store_id, plan_id, assigned_at)`
  - **Rollup diário** `usage_daily(store_id, date, items, bytes_downloaded, page_time_ms, screenshots_stored)`

- **Contadores em Redis** (reset 00:00 UTC):

  - `quota:{store_id}:items:{YYYYMMDD}`, `quota:{store_id}:mb:{YYYYMMDD}`, `quota:{store_id}:ms:{YYYYMMDD}`

- **Aplicação**:

  - Antes do job: verificar cotas; se excedidas → marcar job como `skipped_over_quota` e pausar fila da loja (status do run `partial`).
  - Durante o job: acumular `bytes_downloaded`, `elapsed_ms` reais e abortar se extrapolar `max_page_time_ms`.

### 5) Métricas & logs (+ benchmarks)

- **Prometheus** (ou endpoint simples em `/api/ops/metrics`):

  - `crawl_page_duration_ms_bucket`, `crawl_cache_hit_ratio`, `crawl_bytes_downloaded_total`, `crawl_tokens_wait_ms`, `crawl_quota_exceeded_total`, `crawl_host_queue_depth`.

- **Logs JSON** por job (já em T0): `{store_id, run_id, ua, host, url, http_status, cache_status, duration_ms, retry, bytes_html, bytes_png, quota_hit?}`.
- **Bench script** `ops/bench_crawl.py`:

  - Lê uma lista de 5k URLs (mesmo host) e roda com/sem cache; exporta CSV `results_{ts}.csv` (p50/p95, hit ratio, MB).

### 6) Variáveis `.env.example` (adições)

```env
WORKER_MAX_CONTEXTS=4
CRAWL_PER_HOST_QPS=0.5
CRAWL_GLOBAL_QPS=3
CRAWL_NAV_TIMEOUT_MS=25000
CRAWL_PAGE_BUDGET_MS=40000
CACHE_TTL_DEFAULT_H=24
RETENTION_DAYS_FULL=7
RETENTION_DAYS_META=30
KEEP_SCREENSHOTS_DOWNSAMPLED=false
PLAN_DEFAULT=basic
```

### 7) Testes

- **Unit**:

  - Token bucket (refil/consumo, contenção), decisões de cache (304, 200=mesmo hash, bypass).
  - Cálculo de cotas (mb/time) e abort por `max_page_time_ms`.

- **Integração** (sem rede externa):

  - Servidor HTTP local de teste que retorna `ETag/Last-Modified` (variante: 304, 200 same/diff).
  - Varredura de 50 URLs de um host → verificar respeito a `CRAWL_PER_HOST_QPS` (medindo intervalos).

- **Retenção**:

  - Criar N snapshots com datas antigas, rodar GC com `RETENTION_DAYS_FULL=0` → verificar remoção apenas dos blobs.

---

## DoD

- Processar **5k URLs** de um único host respeitando `CRAWL_PER_HOST_QPS` e `CRAWL_GLOBAL_QPS` (sem 429/ban), com **queda ≥30%** em **tempo total** e **bytes armazenados** versus baseline **sem cache**.
- **Cache hit ratio** ≥60% em segunda execução (mesmo dataset) e **MB/dia** reduzidos no relatório `usage_daily`.
- **Retenção** remove/downsampa artefatos antigos sem quebrar a UI (links continuam com `reused_from_snapshot_id` quando aplicável).
- **Cotas**: exceder limites do plano pausa novos jobs e rotula run como `partial`/`skipped_over_quota`.

---

## Validações

- **Bench controlado** com `ops/bench_crawl.py`:

  - Rodar **baseline** (cache off) e **otimizado** (cache on) no mesmo set; gerar CSV e comparar p95/MB.

- **Métricas**:

  - Consultar `crawl_cache_hit_ratio`, `crawl_page_duration_ms_p95`, `crawl_quota_exceeded_total`.

- **Amostragem manual**:

  - Verificar snapshots `cache_status` (`revalidated` e `hit_samehash`) e `reused_from_snapshot_id`.
  - Ultrapassar cota propositalmente e observar bloqueio/429 de novos scans da loja.

---

### T27 — UX/Acessibilidade & Polimento Web

**Objetivo**
Elevar a eficiência de uso e a acessibilidade (alvo **WCAG 2.2 AA**), com listas grandes fluídas, atalhos de teclado, foco previsível e feedback consistente.

---

## Escopo — detalhar

### 1) Virtualização de listas/tabelas grandes

- **Componentes novos** em `web/src/components/`:

  - `DataGridVirtual.jsx` (baseado em `react-window`): suporta **row virtualization**, seleção, sort client-side, sticky header.
  - `SROnly.jsx` (utilitário de texto “somente leitor de tela”).

- **Páginas migradas**:

  - `pages/Items.jsx`, `pages/Violations.jsx`, `pages/Scans.jsx` → usar `DataGridVirtual` quando `total > 200`.

- **Ajustes de UX**:

  - Loading incremental (skeleton por linha).
  - Altura de linha acessível (≥44px hit target).
  - Scroll restoration ao voltar da modal de evidência.

### 2) Acessibilidade (WCAG) & navegação por teclado

- **Estrutura semântica**:

  - Em `Layout.jsx`: adicionar _skip link_ (`<a href="#main" class="sr-only-focusable">Pular para conteúdo</a>`), landmark roles (`header`, `nav`, `main`, `footer`).
  - `Page.jsx`: garantir `<h1>` único por tela.

- **Foco previsível**:

  - Focus **visible** (outline alto contraste); primeiro campo recebe foco ao abrir modais (Evidence Viewer, Upload).
  - **Focus trap** em modais; fechar com `Esc`.
  - Restaurar foco no botão que abriu a modal.

- **Atalhos de teclado (acessíveis e documentados)**:

  - `/` → focar busca na tabela atual.
  - `g d` → Dashboard, `g f` → Feeds, `g v` → Violations, `g s` → Scans.
  - `?` → abre “Ajuda de Atalhos” (dialog).
  - Habilitar/desabilitar com toggle em “Preferências”.

- **Leitores de tela**:

  - Labels e `aria-*` nos botões de ação (ex.: “Abrir evidências de {SKU}”).
  - `aria-live="polite"` para toasts e contagens (ex.: “3 violações filtradas”).
  - Tooltips **não** como única fonte de informação.

### 3) Feedback consistente (skeletons, toasts, errors)

- **Skeletons**: `components/SkeletonRow.jsx` para listas; mostrar 8–12 linhas durante carregamento.
- **Error Boundaries**:

  - `components/ErrorBoundary.jsx` (React 18) com fallback amigável e botão **Tentar novamente**.
  - Usar em alto nível (AppShell) e nas páginas com fetch pesado.

- **Toasts** (`lib/toast.jsx`):

  - Padrões uniformes: success/neutral/warn/error, com rótulos e auto-dismiss **não agressivo**.
  - Mensagens curtas + ação (ex.: “Export iniciado — Ver progresso”).

### 4) Contraste, tema e movimento reduzido

- **Contraste**: garantir **AA** (≥4.5:1) para texto normal; ajustar tokens de cor no `global.css`.
- **Preferências do usuário**:

  - Respeitar `prefers-reduced-motion`; desativar animações ao true.
  - Toggle “Alto contraste” (classe `hc-mode` no `body`).

- **Estados de controle**: foco/hover/disabled com indicadores visuais consistentes.

### 5) Performance de UI e rede

- **Debounce** (300ms) em filtros/busca.
- **Paginação server-side** já existente → manter; pré-buscar próxima página ao aproximar do final (opcional).
- **Memorização** com `React.memo`/`useMemo` em `DataGridVirtual` para linhas.

### 6) QA de acessibilidade automatizado

- Adicionar **axe-core** (jest-axe) para smoke de acessibilidade em:

  - `Login.jsx`, `Dashboard.jsx`, `Feeds.jsx`, `Violations.jsx` (estado vazio, carregando, com dados).

- Checagens:

  - Elemento `main` único, `h1` presente, labels em inputs, roles válidos, sem `tabindex` indevido, sem contraste baixo.

### 7) Documentação rápida

- Página **“Ajuda & Atalhos”** em `pages/Help.jsx`: lista de atalhos e como ativar “alto contraste” e “reduzir movimento”.
- `README.md (web)` seção “Acessibilidade”: como rodar testes de a11y e checklist.

---

## DoD

- **Lighthouse A11y ≥ 90** nas páginas principais (Login, Dashboard, Feeds, Items, Violations, Scans).
- Navegação **sem mouse** cobre: login → dashboard → abrir violação → ver evidência → bloquear item → voltar.
- Tabelas com **10k+ linhas** continuam fluídas (scroll suave) via `DataGridVirtual`.
- Modais com **focus trap**, `Esc` para fechar e retorno de foco ao elemento de origem.
- Atalhos `/`, `g d/f/v/s`, `?` funcionam e são anunciados (documentados no Help).

---

## Validações

- **Automatizado**:

  - `npm run test:a11y` (jest-axe) sem violações críticas.
  - `npm run lint` e `npm run build` verdes.

- **Manual**:

  - Verificação com **tab**/**shift+tab**: ordem de foco coerente; skip link funcional.
  - **Reader test** (NVDA/VoiceOver): botões e links com nomes acessíveis, toasts anunciados (`aria-live`).
  - **Tema/contraste**: checar pares de cor com ferramenta (AA).

- **Performance**:

  - Abrir `Violations.jsx` com dataset grande; CPU < 60% em scroll; sem jank perceptível.

- **Erros**:

  - Forçar falha de rede → ErrorBoundary aplica fallback e “Tentar novamente”.

---

## Mudanças no repo

- `web/src/components/DataGridVirtual.jsx`, `SROnly.jsx`, `SkeletonRow.jsx`, `ErrorBoundary.jsx`, `ShortcutsHelp.jsx`.
- Atualizações em `Layout.jsx`, `Page.jsx`, `global.css`, `lib/api.js` (debounce), `lib/toast.jsx` (aria-live).
- Testes: `__tests__/a11y/*.test.jsx` com jest-axe.
- Docs: `docs/WEB-ACCESSIBILITY.md` e seção no `README.md` (web).

---

### T28 — Auditoria & Cadeia de Custódia

**Objetivo**
Rastrear ações sensíveis (quem fez o quê, quando, de onde) e garantir a integridade de evidências (HTML/PNG/HAR) com verificação reproduzível.

---

## Escopo — detalhar

### 1) Audit log (append-only e pesquisável)

- **Tabela** `audit_events` (Alembic):

  - `id BIGSERIAL PK`
  - `ts TIMESTAMPTZ NOT NULL DEFAULT now()`
  - `account_id INT NULL`, `store_id INT NULL`, `actor_user_id INT NULL`
  - `event TEXT NOT NULL` (enum lógico: `login`, `ingest.start`, `ingest.finish`, `scan.start`, `scan.finish`, `block.create`, `block.delete`, `policy.publish`, `appeal.export`, `oauth.start`, `oauth.callback`, …)
  - `target_type TEXT NULL`, `target_id TEXT NULL` (ex.: `feed_item`, `scan_run`, `violation`)
  - `ip INET NULL`, `user_agent TEXT NULL`, `trace_id TEXT NULL`, `request_id TEXT NULL`
  - `metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb`
  - **cadeia**: `prev_hash BYTEA NULL`, `event_hash BYTEA NOT NULL`

    > `event_hash = sha256(json_canonizado_do_evento || prev_hash)` para **prova de não-repúdio**; índice por `(store_id, ts)`.

- **Serviço** `services/audit.py`:

  - Função `audit(event, *, actor, store_id, target, metadata)` que calcula `event_hash` com o último `event_hash` gravado (por `store_id` ou global).
  - API **somente append** (sem updates/deletes); expor método de **verificação** que recalcula a cadeia.

- **Middleware**:

  - Preenche `trace_id`/`request_id` e injeta em `audit()`.

- **Cobertura de eventos**:

  - Login/OAuth, ingest (start/finish), scan (start/finish), block/unblock, policy publish/update, appeal export, download de evidência (opcional: amostrar).

### 2) Hashes de evidências + manifesto/recibo por run

- **Hashes por arquivo** (já avançado no T17, reforçar):

  - Em `page_snapshots`: `html_sha256`, `screenshot_sha256`, `har_sha256` (quando existir).
  - Worker `rq-crawl` calcula e persiste após salvar arquivos.

- **Manifesto do run**:

  - Arquivo: `artifacts/store{sid}/runs/{run_id}/manifest.json` com:

    ```json
    {
      "run_id": 123,
      "store_id": 5,
      "created_at": "2025-08-25T13:49:30Z",
      "files": [
        { "path": "items/SKU-001/chrome/page.html", "sha256": "..." },
        { "path": "items/SKU-001/chrome/page.png", "sha256": "..." },
        {
          "path": "items/SKU-001/chrome/page.har",
          "sha256": "...",
          "optional": true
        }
      ],
      "algo": "sha256",
      "merkle_root": "<opcional>"
    }
    ```

  - **Assinatura do recibo** (`manifest.sig`):

    - HMAC-SHA256 do conteúdo **bytes** de `manifest.json` com `AUDIT_HMAC_SECRET`.
    - Guardar também `receipt.json` com: `hmac="base64"`, `key_id="v1"`, `issued_at`.

- **API de verificação**:

  - `GET  /api/v1/stores/{id}/runs/{run_id}/receipt` → retorna `manifest.json` + `receipt.json`.
  - `POST /api/v1/verify-receipt` (body: manifest+receipt) → valida HMAC e re-calcula hashes **on-disk** (ou em S3) quando possível; retorna relatório por arquivo.

### 3) Export de auditoria

- **Listagem/consulta**:

  - `GET /api/v1/stores/{id}/audit?event=&actor=&from=&to=&limit=&cursor=`
  - Filtro por `event`, intervalo de tempo, `actor_user_id`; paginação cursor.

- **Export**:

  - `GET /api/v1/stores/{id}/audit/export.csv?from=&to=&event=`
  - `GET /api/v1/stores/{id}/audit/export.json?...`

- **Verificação da cadeia**:

  - `GET /api/v1/stores/{id}/audit/verify-chain?from=&to=` → recalcula `event_hash` sequencialmente e reporta o primeiro ponto de quebra (se houver).

### 4) Segurança e configurações

- **Env vars**:

  - `AUDIT_HMAC_SECRET` (obrigatória em prod; gerar forte; **rotacionável** via `key_id`).
  - `AUDIT_LOG_CHAIN=true|false` (habilita `prev_hash`/`event_hash`).

- **Permissões**:

  - Export/consulta audit restrita a `owner|admin` (ou `agency_admin` em visão consolidada).
  - Receipts públicos? **Não**. Usar **presigned URL**/token curto para compartilhar externamente se preciso.

- **Observabilidade**:

  - Logs estruturados de verificação (`verify_receipt`): `{run_id, files_checked, ok, failed}`.
  - Métrica: `% evidências íntegras` por run.

---

## DoD

- Toda ação crítica gera **audit_event** com `actor`, `ip`, `user_agent`, `trace_id`; tabela **append-only** com cadeia (`prev_hash`/`event_hash`) verificável.
- Cada run possui `manifest.json` + `manifest.sig` (recibo) com HMAC válido.
- Endpoint `verify-receipt` identifica **qualquer** alteração em arquivos (hash mismatch) e reporta.
- Export CSV/JSON de auditoria por período funcionando e filtrável.

---

## Validações

1. **Happy path**

   - Executar ingest + scan com 2 itens → gerar manifesto/recibo.
   - `GET /runs/{run_id}/receipt` baixa o par (manifest + receipt).
   - `POST /verify-receipt` com o par retorna `ok: true` e `files_all_ok: true`.

2. **Fraude simulada**

   - Alterar `page.html` de um item (1 byte).
   - Rodar `POST /verify-receipt` → `ok: false` com `files_failed=[...]` apontando o arquivo adulterado.

3. **Cadeia de auditoria**

   - `GET /audit/verify-chain?from=&to=` → `chain_ok: true`.
   - Remover/alterar uma linha manualmente no DB (em dev) → `chain_ok: false` e indicação do `id` onde quebrou.

4. **Export**

   - `GET /audit/export.csv` em janela de 7 dias → arquivo com colunas (`ts,event,actor,store_id,target,ip,user_agent,trace_id`…); abrir em planilha sem problemas de separador.

---

## Mudanças no repo

- **API/Modelos**

  - Alembic: `000X_audit_events_and_receipts.py` (tabela `audit_events`, índices).
  - `api/app/services/audit.py` (writer + verificador de cadeia).
  - `api/app/routers/audit.py`:

    - `GET /api/v1/stores/{id}/audit`
    - `GET /api/v1/stores/{id}/audit/export.(csv|json)`
    - `GET /api/v1/stores/{id}/audit/verify-chain`
    - `GET /api/v1/stores/{id}/runs/{run_id}/receipt`
    - `POST /api/v1/verify-receipt`

- **Workers**

  - Em `rq-crawl`: calcular SHA-256 ao salvar arquivos; escrever/atualizar `manifest.json`; gerar `manifest.sig` com `AUDIT_HMAC_SECRET`.
  - Emitir `audit()` em `scan.start` e `scan.finish` (com `{run_id, items_total, items_ok, items_failed}`).

- **Utilitários**

  - `api/app/services/crypto.py`: HMAC helper (`sign_receipt`, `verify_receipt`) com `key_id`.

- **Docs**

  - `docs/AUDIT_AND_EVIDENCE_CHAIN.md`: formato do manifesto, como verificar offline (script exemplo), rotação de chave HMAC, política de retenção.

- **Testes**

  - Unit: cálculo de `event_hash` com cadeia; HMAC receipt round-trip.
  - Integração: gerar run, validar manifesto; adulterar arquivo → verificação falha; export CSV.

---

### T29 — Billing & Planos v1

**Objetivo**
Monetizar o produto com **planos Free/Pro/Agency**, limites de uso aplicados no backend e integração Stripe (checkout, portal e webhooks).

---

## Escopo — detalhar

### 1) Variáveis de ambiente (documentar em `.env.example`)

- Stripe:

  - `STRIPE_SECRET_KEY=sk_test_...`
  - `STRIPE_PUBLISHABLE_KEY=pk_test_...` (usada no Web)
  - `STRIPE_PRICE_PRO=price_...`
  - `STRIPE_PRICE_AGENCY=price_...`
  - `STRIPE_WEBHOOK_SECRET=whsec_...`
  - `STRIPE_CHECKOUT_SUCCESS_URL=https://app.example.com/billing/success`
  - `STRIPE_CHECKOUT_CANCEL_URL=https://app.example.com/billing/cancel`
  - `STRIPE_PORTAL_RETURN_URL=https://app.example.com/settings/billing`

- Limites (defaults, overrideáveis):

  - `PLAN_FREE_STORES=1`
  - `PLAN_FREE_SCAN_ITEMS_MONTH=500`
  - `PLAN_FREE_INGEST_ITEMS_MONTH=1000`
  - `PLAN_FREE_ARTIFACTS_BYTES=262144000` (250MB)
  - `PLAN_FREE_SCANS_DAY=5`
  - `PLAN_PRO_*` / `PLAN_AGENCY_*` (valores maiores conforme tabela abaixo)

> Tabela sugerida (defaults):
>
> - **Free**: 1 loja, 500 scan items/mês, 1k ingest items/mês, 250MB artefatos, 5 scans/dia
> - **Pro**: 5 lojas, 20k scan items/mês, 50k ingest items/mês, 10GB artefatos, 200 scans/dia
> - **Agency**: 50 lojas, 500k scan items/mês, 1M ingest items/mês, 200GB artefatos, 2000 scans/dia

---

### 2) Modelo & Migrações (Alembic)

- **accounts** (ou tabela dedicada `account_plans`):

  - `plan TEXT NOT NULL DEFAULT 'free'` (`free|pro|agency`)
  - `plan_status TEXT NOT NULL DEFAULT 'active'` (`active|trialing|past_due|canceled`)
  - `stripe_customer_id TEXT NULL`
  - `stripe_subscription_id TEXT NULL`
  - `plan_started_at TIMESTAMPTZ NULL`
  - `plan_current_period_start TIMESTAMPTZ NULL`
  - `plan_current_period_end TIMESTAMPTZ NULL`

- **usage_counters** (janela mensal/dia):

  - `id PK`, `account_id FK`
  - `period_month DATE NOT NULL` (primeiro dia UTC do mês)
  - `scan_items INT NOT NULL DEFAULT 0`
  - `ingest_items INT NOT NULL DEFAULT 0`
  - `artifacts_bytes BIGINT NOT NULL DEFAULT 0`
  - `scans_day INT NOT NULL DEFAULT 0`
  - Índices: `(account_id, period_month)` único; e **materializar** também “janela diária” (campo `day DATE`) **ou** manter `scans_day` em Redis (ver abaixo).

- (Opcional) **daily_counters** para `scans_day` (se preferir DB puro): `(account_id, day, scans INT DEFAULT 0)` único.

---

### 3) Backend (FastAPI)

**Rotas de billing**

- `POST /api/v1/billing/checkout-session`
  **body**: `{ plan: "pro"|"agency" }`
  **ret**: `{ id, url }` (URL do Stripe Checkout)

  - Cria Customer se não existir (`stripe_customer_id`).
  - Inicia **subscription** com o `price` do plano selecionado.

- `POST /api/v1/billing/portal-session`
  **ret**: `{ url }` (Stripe Customer Portal)

  - Requer `stripe_customer_id`.

- `POST /api/v1/billing/webhook`

  - Verifica assinatura (`STRIPE_WEBHOOK_SECRET`).
  - Trata eventos principais:

    - `checkout.session.completed` → set `stripe_customer_id`, `stripe_subscription_id`, `plan=pro/agency`, status inicial.
    - `customer.subscription.updated` → sincroniza `plan_status`, `current_period_start/end`.
    - `customer.subscription.deleted` / `invoice.payment_failed` → `plan_status='past_due'`/`'canceled'` e **downgrade para free** quando aplicável.

- `GET /api/v1/accounts/me/billing`
  **ret**: `{ plan, plan_status, period_start, period_end, usage: {...}, limits: {...} }`

**Aplicação de limites (guards)**

- Helper `get_limits_for(account)` lê env defaults → retorna objeto `Limits`.
- Serviço `usage.py`:

  - `get_period_month(now_utc) -> date`
  - `ensure_usage_row(account_id, period_month)`
  - `check_and_consume(account_id, metric, amount, *, dry_run=False) -> ok|error`

    - `metric ∈ {scan_items, ingest_items, scans_day, artifacts_bytes}`
    - Implementação DB: `SELECT ... FOR UPDATE` + `UPDATE` com verificação de teto; **não ultrapassa**.
    - Alternativa para `scans_day`: manter contador diário em Redis com TTL até o fim do dia UTC (`billing:scans_day:{account_id}:{YYYYMMDD}`).

- **Pontos de aplicação**:

  - **Criar loja** → valida `stores_count < limit` (consulta rápida).
  - **Ingest** (`/feeds/ingest`) → fazer **pre-contagem** (parse leve) e `check_and_consume(..., ingest_items, N)`.
  - **Scan** (`/scan`) → consumir `scans_day` (+1) e `scan_items` (+`limit_items` solicitado ou quantidade real enfileirada).
  - **Crawler** → após salvar arquivos, somar tamanho dos artefatos: `check_and_consume(..., artifacts_bytes, total)`; se estourar, **marcar run como parcial** e parar enfileiramento.

- **Near-limit warnings**:

  - Se uso ≥ 80% do limite → adicionar header `X-Plan-Warning: near-limit:{metric}` e campo `plan_warning` no JSON da resposta.

- **Mensagens claras** (`HTTP 402/403`):

  - Ex.: `{"error":"plan_limit_reached","metric":"scan_items","plan":"free","limit":500,"used":500,"upgrade_url":"/settings/billing"}`

**Segurança/Autorização**

- Todas as rotas exigem usuário autenticado; webhooks **sem auth** mas com assinatura Stripe.
- RBAC: leitura de billing apenas pelo dono/admin da conta.

---

### 4) Web (React)

- Página **Billing.jsx**:

  - Mostra **plano atual**, `plan_status`, período corrente e **barras de uso** (scan items, ingest items, storage, scans/day).
  - Botões:

    - **Upgrade para Pro** / **Upgrade para Agency** → chama `POST /billing/checkout-session` e redireciona para `url`.
    - **Gerenciar cobrança** → `POST /billing/portal-session` e redireciona.

  - Warnings (toast/banner) quando `near-limit`.

- Integrações nas telas que consomem limites:

  - Ao tentar iniciar scan/ingest além do limite → exibir modal com call-to-action **Upgrade**.

- Usar `STRIPE_PUBLISHABLE_KEY` apenas se for embutir elementos Stripe (não obrigatório no Checkout hospedado).

---

### 5) Webhooks & Estados

- Mapear `subscription.status` → `plan_status`:

  - `active|trialing|past_due|canceled|incomplete`

- Em `checkout.session.completed`:

  - Identificar `account_id` (via `client_reference_id` / `metadata.account_id`) enviado na criação da sessão.
  - Definir `plan` pelo `price.id` **assincronamente**.

- **Downgrade**:

  - Ao `canceled`/`past_due` prolongado → set `plan='free'`, manter contadores (não apagar histórico).
  - Se `free` e uso corrente excede limites, **bloquear novas operações** e exibir mensagem de ajuste/retenção.

---

### 6) Observabilidade

- Logs JSON para `billing_checkout_session`, `billing_portal_session`, `billing_webhook`, `plan_guard_denied`.
- Métricas (Prometheus):

  - `billing_plan_guard_denied_total{metric,plan}`
  - `billing_stripe_webhook_errors_total{type}`

---

### 7) Testes (sem rede, mock de Stripe)

- Unit:

  - `check_and_consume()` (casos: sucesso, near-limit, excesso).
  - Cálculo de período (`period_month`), janela diária.

- Integração:

  - Mock de `stripe.checkout.sessions.create`, `billing_portal.sessions.create`.
  - Webhook assinado (replay local com payload fixo; validar verificação e mudança de `plan`).
  - Fluxo de bloqueio: atingir limite Free → tentar novo scan/ingest → 403/402 com mensagem.

---

## DoD

- **Checkout** e **Portal** funcionam em modo **Stripe test**; plano e status sincronizados via webhooks.
- Limites **enforçados** em:

  - criação de loja (stores),
  - ingest (itens/mês),
  - scan (scans/dia e itens/mês),
  - armazenamento de artefatos (bytes totais).

- UI mostra plano, uso e botões de upgrade/portal; exibe **near-limit** e bloqueios com mensagens claras.
- Testes (com mocks) cobrindo webhooks e guards aprovados.

---

## Validações

1. **Fluxo de upgrade**

   - Em conta Free, abrir Billing.jsx → “Upgrade Pro” → redirecionar ao Checkout.
   - Após `checkout.session.completed` (webhook), `plan='pro'`, `plan_status='active'`, limites alterados na resposta do `/accounts/me/billing`.

2. **Aplicação de limite**

   - Forçar ingest para exceder `ingest_items` Free → resposta 402/403 com motivo e `upgrade_url`.
   - Rodar 6 scans no mesmo dia com Free (`scans_day=5`) → o 6º falha com erro de limite.

3. **Armazenamento**

   - Simular upload/artefatos até exceder `artifacts_bytes` → novo scan bloqueado; UI sugere limpeza/upgrade.

4. **Webhook**

   - Simular `customer.subscription.deleted` → conta regride para Free; tentar scan grande e confirmar bloqueio.

---

## Mudanças no repo (resumo)

- **API**

  - `api/app/routers/billing.py`: rotas de checkout/portal/webhook/billing status.
  - `api/app/services/stripe_client.py`: wrapper fino (injeção/mocks).
  - `api/app/services/usage.py`: counters e guards.

- **DB/Migrations**

  - Alembic para campos em `accounts` e tabela `usage_counters` (e opcional `daily_counters`).

- **Web**

  - `web/src/pages/Billing.jsx`; ajustes em `lib/api.js` e toasts/modals nos fluxos de scan/ingest.

- **Docs**

  - `README.md` / `CLI-CHEATSHEET.md` → seção **Billing** (envs, endpoints, como testar em modo Stripe test).

- **CI**

  - Testes com mocks (sem rede); checar drift de OpenAPI (novas rotas).

---

### T30 — API Pública & Webhooks

**Objetivo**
Integrar com o ecossistema externo com **API Keys** escopadas e **webhooks** assinados (HMAC), mantendo limites, auditoria e DX (SDKs e exemplos).

---

## Escopo — detalhar

### 1) Variáveis de ambiente (`.env.example`)

- **API pública**

  - `PUBLIC_API_RATE_PER_TOKEN_PER_MIN=120`
  - `PUBLIC_API_ENABLE=true`

- **Webhooks**

  - `WEBHOOK_MAX_RETRIES=8`
  - `WEBHOOK_BACKOFF_BASE_MS=500`
  - `WEBHOOK_SIGNATURE_TOLERANCE_SEC=300` # tolerância contra replay
  - `WEBHOOK_SIGNING_SCHEME=HMAC-SHA256`

---

### 2) Modelos & Migrações (Alembic)

- `api_keys`
  `id PK`, `account_id FK`, `store_id FK NULL`, `name`, `token_hash CHAR(64) UNIQUE`, `scopes TEXT[]`, `created_at`, `last_used_at`, `revoked_at NULL`.

  > **Observação**: guardar **somente hash** (SHA-256) da API Key; o segredo é mostrado **uma vez** na criação.

- `webhooks`
  `id PK`, `account_id FK`, `store_id FK`, `url TEXT`, `signing_secret_hash CHAR(64)`, `events TEXT[]`, `active BOOL DEFAULT true`, `created_at`, `disabled_at NULL`.
- `webhook_deliveries`
  `id PK`, `webhook_id FK`, `event_type TEXT`, `event_id UUID`, `attempt INT`, `status TEXT('ok'|'failed'|'skipped')`, `response_code INT`, `response_ms INT`, `error TEXT NULL`, `payload_json JSONB`, `headers_json JSONB`, `sent_at`.

Índices úteis:

- `api_keys(account_id, store_id)`;
- `webhook_deliveries(webhook_id, event_id)` único (idempotência).

---

### 3) Segurança & Escopos

- **API Key** enviada via `Authorization: Bearer <key>` **ou** `X-Api-Key: <key>`.
- **Scopes** (sugestão):

  - `stores:read`
  - `violations:read`
  - `scans:read`
  - `blocks:read`
  - `blocks:write`

- **Rate-limit**: bucket por **token** (ex.: 120 req/min). Resposta `429` com `Retry-After`.
- **Auditoria**: toda chamada pública → log com `api_key_id`, `scope`, `store_id`, `status`.

---

### 4) Endpoints (API pública v1)

- **Management (autenticado com JWT interno; RBAC owner/admin)**

  - `POST   /api/v1/stores/{store_id}/api-keys` → cria chave (retorna **cleartext** uma única vez)
    body: `{name, scopes:[...]}`; resp: `{id, token_plaintext_once, scopes, created_at}`
  - `GET    /api/v1/stores/{store_id}/api-keys` → lista (sem segredos)
  - `POST   /api/v1/stores/{store_id}/api-keys/{id}/revoke` → revoga
  - `POST   /api/v1/stores/{store_id}/webhooks` → cria webhook
    body: `{url, events:[...]}`
  - `GET    /api/v1/stores/{store_id}/webhooks` → lista (sem segredo)
  - `POST   /api/v1/stores/{store_id}/webhooks/{id}/rotate` → **gera novo** `signing_secret` (mostra uma vez)
  - `POST   /api/v1/stores/{store_id}/webhooks/{id}/disable`
  - `POST   /api/v1/stores/{store_id}/webhooks/{id}/test` → dispara evento `webhook.test`

- **Pública (via API Key)**

  - `GET /api/v1/stores/{store_id}/scans/{run_id}` (scope: `scans:read`)
  - `GET /api/v1/stores/{store_id}/violations` (filtros: rule, sev, dt) (scope: `violations:read`)
  - `POST /api/v1/stores/{store_id}/blocks` (scope: `blocks:write`)
    body: `{feed_item_id, reason?}`
  - `DELETE /api/v1/stores/{store_id}/blocks/{feed_item_id}` (scope: `blocks:write`)

> **Compatibilidade**: manter rotas internas atuais; as públicas são adicionais, baseadas em escopos.

---

### 5) Webhooks — Assinatura & Entrega

**Eventos suportados (inicial)**

- `webhook.test`
- `scan.completed` (payload inclui `run_id`, contagens, timestamps)
- `violation.created` (por item/regra; pode agrupar em lote)
- `block.changed` (`blocked|unblocked`, `feed_item_id`, `reason`)

**Assinatura**

- Header:

  - `X-Webhook-Id: <uuid>`
  - `X-Webhook-Timestamp: <epoch-seconds>`
  - `X-Webhook-Signature: sha256=<hexdigest>`

- Cálculo: `signature = HMAC_SHA256(signing_secret, f"{timestamp}.{raw_body}")`
- Validações no receptor:

  1. `now - timestamp <= WEBHOOK_SIGNATURE_TOLERANCE_SEC`
  2. signature confere (constant-time compare)
  3. `X-Webhook-Id` **idempotente** (não processar duas vezes)

**Entrega & Retry**

- Worker `webhook-dispatcher` consome fila.
- Retry exponencial com jitter, até `WEBHOOK_MAX_RETRIES`.
- **DLQ** (dead letter): após falha final, marcar `status='failed'` e notificar na UI.
- Persistir cada tentativa em `webhook_deliveries`.

---

### 6) SDKs & Exemplos

**`clients/python/`** (poetry ou setup.cfg simples)

- `verify_signature(raw_body, signature, timestamp, secret) -> bool`
- `WebhookClient(base_url, api_key)` com métodos: `get_violations`, `get_scan`, `block`, `unblock`
- Exemplo Flask/FastAPI de receiver:

```python
@app.post("/webhooks/gmc-shield")
def receive():
    sig   = request.headers["X-Webhook-Signature"]
    ts    = request.headers["X-Webhook-Timestamp"]
    wid   = request.headers["X-Webhook-Id"]
    body  = request.data
    if not verify_signature(body, sig, ts, SIGNING_SECRET):
        return ("bad signature", 400)
    # idempotência por wid aqui
    event = request.json
    ...
    return ("ok", 200)
```

**`clients/js/`** (ESM)

- `verifySignature(rawBody, signature, timestamp, secret)`
- Exemplo Express:

```js
app.post("/webhooks/gmc-shield", express.raw({ type: "*/*" }), (req, res) => {
  const sig = req.header("X-Webhook-Signature");
  const ts = req.header("X-Webhook-Timestamp");
  if (!verifySignature(req.body, sig, ts, SIGNING_SECRET))
    return res.status(400).send("bad signature");
  // dedupe por X-Webhook-Id
  const evt = JSON.parse(req.body.toString());
  res.send("ok");
});
```

---

### 7) Observabilidade

- Logs estruturados: `webhook_enqueue`, `webhook_attempt`, `webhook_success`, `webhook_failed`, com `event_type`, `attempt`, `response_ms`, `status`.
- Métricas (Prometheus):

  - `webhook_deliveries_total{event_type,status}`
  - `webhook_delivery_latency_ms_bucket{event_type}`

- Painel simples no Grafana.

---

### 8) Testes (sem rede)

- Unit:

  - Geração/verificação de assinatura (casos válidos/inválidos/replay).
  - Rate-limit por token.
  - Scopes negados → `403`.

- Integração:

  - Dispatcher com mock de HTTP 200/500/timeout + retries e DLQ.
  - Rotação de secret: entrega falha com secret antigo, sucesso com novo.

- E2E local:

  - `webhooks/test` para URL de **servidor dummy** (httpbin/local), validando assinatura.

---

## DoD

- **API Keys** gerenciáveis por loja; escopos aplicados; rate-limit por token ativo.
- **Webhooks** entregues com assinatura HMAC; retries exponenciais; DLQ visível.
- **SDKs** (Python/JS) com verificadores de assinatura e helpers de chamada.
- **Documentação**: `OpenAPI.md` + exemplos curl para endpoints e exemplo de receiver.
- Testes cobrindo assinatura, rate-limit, retries e rotação de secret.

---

## Validações

1. **Webhook test**

   - Criar webhook para a loja; executar `.../webhooks/{id}/test` → servidor dummy recebe evento, valida assinatura e responde 200.

2. **Eventos reais**

   - Completar um `scan` → `scan.completed` chega com payload esperado.
   - Criar uma `violation` sintética → `violation.created` recebido.

3. **API pública**

   - Gerar API key com `violations:read`; chamar `/violations` com token → 200.
     Tentar `POST /blocks` com o mesmo token → `403` (escopo ausente).

4. **Resiliência**

   - Simular endpoint externo 500/timeout → retries até `MAX_RETRIES`, registro em DLQ.

---

## Mudanças no repo (resumo)

- **API**

  - `api/app/routers/public_api.py` (rotas públicas)
  - `api/app/routers/webhooks.py` (management/test)
  - `api/app/services/webhook_sign.py` (HMAC + headers)
  - `api/app/services/api_keys.py` (hash/emit/verify + scopes)
  - Worker `webhook_dispatcher` (pode morar em `worker/run_worker.py` ou novo módulo)

- **DB/Migrations**

  - Tabelas `api_keys`, `webhooks`, `webhook_deliveries`

- **Clients**

  - `clients/python/` e `clients/js/` (mínimo viável)

- **Docs**

  - `OpenAPI.md` atualizado; `docs/WEBHOOKS.md` com exemplos e verificação de assinatura

- **CI**

  - Testes com `respx`/`responses` (Python) e `nock` (JS) para HTTP mock; gate de drift do OpenAPI

---

### T31 — Backups & Disaster Recovery

**Objetivo**
Garantir restauração **rápida** e **confiável** do banco e dos artefatos (HTML/PNG/PDF/ZIP), com ensaio de DR (fire drill).

---

## Escopo — detalhar

### 1) Estratégia de backup (recomendada)

- **Postgres (PITR)**: base backups diários + **WAL contínuo** com **wal-g** → permite **Point-In-Time Restore**.
- **Artefatos (`artifacts/`)**: `aws s3 sync` (ou `rclone`) para S3/MinIO com **versionamento** + regras de **lifecycle**.
- **Retenção**: 30 diários / 7 semanais / 1 mensal (via lifecycle em S3 + retenção do wal-g).
- **Criptografia**: SSE-S3 (ou SSE-KMS se disponível).
- **Checksums**: `sha256` de manifest de artefatos por lote.

> Alternativa simples (se não quiser PITR): `pg_dump` diário + `aws s3 sync` dos artefatos. **Preferimos wal-g** para RTO/RPO melhores.

---

### 2) Variáveis de ambiente (adicionar em `.env.example`)

**S3/MinIO**

- `AWS_ACCESS_KEY_ID=...`
- `AWS_SECRET_ACCESS_KEY=...`
- `AWS_DEFAULT_REGION=us-east-1`
- `S3_ENDPOINT=https://s3.amazonaws.com` # ou `http://minio:9000`
- `S3_FORCE_PATH_STYLE=true` # `true` para MinIO
- `S3_BUCKET_BACKUPS=gmcshield-backups`
- `S3_BUCKET_ARTIFACTS=gmcshield-artifacts` # se separar artefatos

**wal-g (PG)**

- `WALG_S3_PREFIX=s3://gmcshield-backups/pg`
- `WALG_S3_SSE=aws:kms|AES256` (opcional)
- `WALG_UPLOAD_CONCURRENCY=4`
- `PGHOST=db` `PGPORT=5432` `PGUSER=postgres` `PGPASSWORD=postgres`
- `PGDATABASE=gmc_shield`

**Retenção / agendamento**

- `BACKUP_BASE_INTERVAL_HOURS=24`
- `WALG_RETAIN_FULL_BACKUPS=30` # base backups
- `ARTIFACTS_RETENTION_DAYS=90` # GC opcional no cold storage

---

### 3) Layout no bucket

```
s3://gmcshield-backups/
  ├── pg/               # wal-g (base backups + WAL)
  └── artifacts/        # mirror de artifacts/ do repo
      └── store{ID}/runs/{run_id}/...
```

Ativar **Versioning** + **Lifecycle**:

- Regra A: transicionar **WAL antigos** p/ infrequent access em 30d; deletar em 180d.
- Regra B: **artefatos** com IA em 30d; expirar em 180d (ou política da empresa).
- Regra C: **manter** 7 semanais e 1 mensal (via labels/prefix ou política de `wal-g delete retain` + cópias marcadas).

---

### 4) Serviço de backup (Compose)

Adicionar um serviço leve que rode cron e scripts:

```yaml
backup:
  build:
    context: .
    dockerfile: infra/Dockerfile.api # imagem com awscli, wal-g
  env_file: [.env]
  depends_on:
    db: { condition: service_healthy }
  volumes:
    - ./api:/app
    - artifacts:/app/api/artifacts
  command: bash -lc "crond -f -l 8"
  restart: unless-stopped
```

Crontab (montar em `/etc/crontabs/root`):

```
# base backup diário às 02:05
5 2 * * * /app/ops/backup_db.sh >> /var/log/backup_db.log 2>&1
# upload incremental de artefatos a cada hora
10 * * * * /app/ops/backup_artifacts.sh >> /var/log/backup_artifacts.log 2>&1
# health ping
*/10 * * * * /app/ops/backup_health.sh >> /var/log/backup_health.log 2>&1
```

---

### 5) Scripts (em `ops/`)

#### `ops/backup_db.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail
echo "[DB] $(date -Is) starting base backup"
export AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_DEFAULT_REGION S3_ENDPOINT S3_FORCE_PATH_STYLE WALG_S3_PREFIX
export PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE

# wal-g exige env de endpoint p/ MinIO
if [[ -n "${S3_ENDPOINT:-}" ]]; then
  export AWS_ENDPOINT="$S3_ENDPOINT"
fi

# push de base backup e limpeza por retenção
wal-g backup-push /var/lib/postgresql/data
wal-g delete retain FULL "${WALG_RETAIN_FULL_BACKUPS:-30}" --confirm
echo "[DB] $(date -Is) base backup done"
```

> **Config do Postgres** (já no contêiner `db`):

- Ativar WAL archiving (se a imagem não vier pronta):

  - `wal_level=replica`, `archive_mode=on`
  - `archive_command='wal-g wal-push %p'`

- Restaurar usa `restore_command='wal-g wal-fetch %f %p'`.

#### `ops/backup_artifacts.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail
SRC="/app/api/artifacts/"
DST="s3://${S3_BUCKET_BACKUPS}/artifacts/"
echo "[ART] $(date -Is) syncing artifacts ${SRC} -> ${DST}"

# opcional: gerar manifest sha256 por run_id antes do sync
find "$SRC" -type f -printf '%P\0' | sort -z | xargs -0 sha256sum > /tmp/artifacts_manifest.sha256 || true
aws s3 cp /tmp/artifacts_manifest.sha256 "${DST}manifests/$(date +%F-%H%M).sha256" \
  ${S3_ENDPOINT:+--endpoint-url "$S3_ENDPOINT"} --sse AES256 || true

aws s3 sync "$SRC" "$DST" \
  ${S3_ENDPOINT:+--endpoint-url "$S3_ENDPOINT"} \
  --delete --only-show-errors --sse AES256

echo "[ART] $(date -Is) sync done"
```

#### `ops/backup_health.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail
# Faz um 'wal-g backup-list' e 'aws s3 ls' rápido para sanity check
wal-g backup-list || exit 1
aws s3 ls "s3://${S3_BUCKET_BACKUPS}/artifacts/" ${S3_ENDPOINT:+--endpoint-url "$S3_ENDPOINT"} >/dev/null
echo "[HEALTH] $(date -Is) OK"
```

#### `ops/restore_db.sh` (PITR)

```bash
#!/usr/bin/env bash
set -euo pipefail
WHEN="${1:-LATEST}"  # ou ISO/epoch p/ PITR
echo "[RESTORE] stopping API + DB"
docker compose stop api

# Desligar Postgres e limpar datadir *com cuidado*
docker compose stop db
sudo rm -rf ./pgdata/* || true

# Buscar base backup e preparar
if [[ "$WHEN" == "LATEST" ]]; then
  wal-g backup-fetch ./pgdata LATEST
else
  wal-g backup-fetch ./pgdata LATEST
  # recovery até tempo-alvo
  echo "recovery_target_time = '${WHEN}'" >> ./pgdata/postgresql.auto.conf
fi

# Necessário p/ Postgres >=12 indicar recuperação
touch ./pgdata/recovery.signal
echo "restore_command = 'wal-g wal-fetch %f %p'" >> ./pgdata/postgresql.auto.conf

docker compose up -d db
echo "[RESTORE] waiting db healthy..."
sleep 10
docker compose up -d api
echo "[RESTORE] done"
```

#### `ops/restore_artifacts.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail
SRC="s3://${S3_BUCKET_BACKUPS}/artifacts/"
DST="/app/api/artifacts/"
aws s3 sync "$SRC" "$DST" \
  ${S3_ENDPOINT:+--endpoint-url "$S3_ENDPOINT"} --only-show-errors
echo "[RESTORE] artifacts restored to $DST"
```

> **Nota**: paths podem variar conforme seu `docker-compose`. Ajuste `./pgdata` e volume do `db` conforme seu setup.

---

### 6) Observabilidade & Alertas

- **Logs estruturados** de backup/restore com `ts, level, msg, duration_ms, size_bytes`.
- **Métricas** simples em `/api/ops/metrics`:

  - `backup_db_last_success_ts`, `backup_artifacts_last_success_ts`
  - `backup_db_age_minutes`, `backup_artifacts_age_minutes`

- **Alertas**: se `*_age_minutes` > 150% do esperado → aviso.

---

### 7) Runbook de DR (resumo em `RUNBOOK.md`)

1. **Acionar DR**: declarar RPO/RTO (ex.: RPO ≤ 24h, RTO ≤ 60min).
2. **Provisionar ambiente** (stack padrão).
3. **Restaurar DB**: `ops/restore_db.sh LATEST` (ou ISO alvo).
4. **Restaurar artefatos**: `ops/restore_artifacts.sh`.
5. **Verificações**:

   - `SELECT count(*) FROM feed_items;`
   - `curl /api/stores/{id}/runs` e abrir evidências recentes.
   - Validar **JWT login**, **lista de violações**, **scan** de smoke.

6. **Encerrar DR** com relatório: tempos, falhas, lessons learned.

---

## DoD

- Backups **diários** do Postgres com **wal-g** e WAL contínuo; **artefatos** sincronizados para S3.
- **Retenção** aplicada (30/7/1) via lifecycle + `wal-g delete retain`.
- **Fire drill** executado: restaura DB + artefatos e a UI volta a operar com dados do dia anterior.
- **Documentação**: `RUNBOOK.md` atualizado com passos e comandos; `.env.example` completo.

---

## Validações

1. **Sanidade de backup**

   - `wal-g backup-list` mostra entradas recentes; `aws s3 ls s3://.../artifacts/` lista pastas.

2. **Checksums**

   - Baixar um manifest `*.sha256` e rodar `sha256sum -c` contra arquivos restaurados (amostra).

3. **Fire drill (ambiente isolado)**

   - Executar `restore_db.sh LATEST` + `restore_artifacts.sh`.
   - Abrir UI, logar, listar versões de feed, ver snapshots e baixar um screenshot/HTML.

4. **RPO/RTO**

   - Cronometrar: `start → UI operante`. Registrar no relatório e comparar com metas.

---

### T32 — SLOs, Observabilidade & Alertas

**Objetivo**
Operar com metas confiáveis (SLOs) e alertas úteis (baixo ruído) para API e workers.

---

## Escopo — detalhar

### 1) SLOs propostos (iniciais)

- **API**

  - **Disponibilidade**: ≥ 99.9% / 30 dias (exclui janelas de manutenção)
  - **Erro 5xx rate**: ≤ 0.5% p95 / dia
  - **Latência P95**:

    - `GET` ≤ 250 ms
    - `POST` ≤ 500 ms

- **Crawler/Jobs**

  - **Tempo médio por item (P95)**: ≤ 6 s (Chrome/Googlebot)
  - **Tempo de run (N=50 itens, P95)**: ≤ 8 min
  - **Fail rate por host**: ≤ 3% (com retries)

> SLOs devem ir para `docs/SLOs.md` com exclusões, janelas e fontes de dados.

### 2) Métricas (Prometheus)

- **API (FastAPI/uvicorn)**

  - `http_requests_total{path,method,status}`
  - `http_request_duration_seconds_bucket` (histograma por `path_template`)
  - `app_auth_rate_limit_hits_total`
  - `app_db_pool_inuse` / `app_db_query_seconds_bucket`

- **Workers (RQ/Playwright)**

  - `rq_jobs_enqueued_total{queue}`
  - `rq_job_duration_seconds_bucket{queue,job}`
  - `crawler_page_fetch_seconds_bucket{ua,domain}`
  - `crawler_failures_total{reason}` (ex.: `timeout`, `dns`, `reset`)
  - `artifacts_bytes_written_total`

- **Negócio/KPI**

  - `violations_created_total{rule,severity}`
  - `blocks_active_total`
  - `scan_runs_total{state}`

**Implementação**

- API: `prometheus_client` com endpoint **somente interno** `GET /api/ops/metrics`.
- Workers: push com `multiprocess` ou `prometheus_client` em modo processo único + sidecar gateway (opcional).
- **Buckets**: defina buckets realistas (p.ex. latência: `0.05,0.1,0.25,0.5,1,2,5`).
- **Rotulagem**: normalize `path` para templates (`/api/v1/stores/{id}/…`) para evitar cardinalidade explosiva.

### 3) Tracing (OpenTelemetry)

- **Instrumentar**: uvicorn/FastAPI, `httpx`, SQLAlchemy, RQ, Playwright (span manual).
- **Propagação**: `traceparent` de API → job (coloque no payload/ctx).
- **Export**: OTLP para um collector local; opcional Grafana Tempo/Jaeger.

### 4) Dashboards (Grafana)

- **API**:

  - Visão geral: taxa req/s, 2xx/4xx/5xx, P50/P95/P99, top rotas lentas, saturação DB.

- **Crawler**:

  - Duração por domínio/UA, falhas por motivo, runs ativos/duração, fila por queue.

- **Negócio**:

  - Violations por regra/severidade, blocks ativos, ingest por dia.

Inclua JSONs em `docs/grafana/` (um por painel).

### 5) Alertas (ruído baixo)

- **Regras** (Prometheus Alertmanager):

  - `APIHigh5xxRate`: `rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.02` por **10 min**
  - `APIP95LatencyHigh`: `histogram_quantile(0.95, …) > 0.5` por **15 min**
  - `CrawlerHighFailureRateByDomain`: `increase(crawler_failures_total[15m]) / increase(rq_jobs_enqueued_total[15m]) > 0.1`
  - `NoBackupsRecently`: `time() - backup_db_last_success_ts > 36h`

- **Roteamento**: Slack/PagerDuty por severidade; **silences** para manutenção.
- **Runbooks**: link em cada alerta para `RUNBOOK.md#<alert-name>`.

### 6) Variáveis de ambiente (adicionar a `.env.example`)

- `OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4317`
- `PROMETHEUS_MULTIPROC_DIR=/tmp/metrics` (se multiprocess)
- `ALERT_ROUTE_SLACK_WEBHOOK=…` / `PAGERDUTY_ROUTING_KEY=…`

---

## DoD

- Painéis Grafana prontos e versionados (JSON em `docs/grafana/`), mostrando SLOs.
- Alertas disparam nos limiares e roteiam para Slack/PagerDuty.
- Traces completos de um fluxo **ingest → scan → violations**.
- `docs/SLOs.md` contendo metas, janelas, exclusões e como medir.

## Validações

- Rodar **teste sintético** que provoca 5xx por 10 min → alerta `APIHigh5xxRate` abre.
- Introduzir latência artificial por rota e ver `APIP95LatencyHigh`.
- Forçar falhas de DNS no crawler (host demo off) e ver `CrawlerHighFailureRateByDomain`.
- Verificar links de runbook nos alertas e passos de mitigação.

---

### T33 — Shopify Connector (OAuth, Products & Block Sync)

**Objetivo**
Permitir conectar uma loja Shopify ao GMC Shield, listar produtos e refletir **bloqueios** (unpublish/estoque=0) via Admin API, com healthcheck e auditoria.

---

## Escopo

### 1) Backend (FastAPI)

**Variáveis (.env / Settings)**

- `SHOPIFY_CLIENT_ID`
- `SHOPIFY_CLIENT_SECRET`
- `SHOPIFY_REDIRECT_URI` (ex.: `https://app.example.com/api/shopify/callback`)
- `SHOPIFY_SCOPES="read_products,write_products,read_inventory,write_inventory"`
- `SHOPIFY_API_VERSION="2024-07"` (overrideável)
- `SHOPIFY_WEBHOOK_SECRET` (reservado p/ T34, mas já previsto)

**DB/Migração**

- `stores.shopify_shop` (ex.: `my-store.myshopify.com`)
- `stores.shopify_access_token_enc` (TEXT, criptografado com `crypto.py`)
- `stores.shopify_api_version` (VARCHAR)
- `stores.shopify_last_sync_at` (TIMESTAMP)
- Índices úteis em `stores.shopify_shop`

**Cliente Shopify**

- `api/app/services/shopify_client.py`

  - helpers: `get_products`, `get_variants_by_sku(skus[])`, `unpublish_product(product_id)`, `set_inventory_to_zero(inventory_item_id, location_id)`, `publish_product(product_id)`
  - **Nota técnica**: detalhe de endpoints pode mudar por versão da API; isolar chamadas e mapear erros (422/429/5xx) com retry/backoff.

**Rotas**

- `GET  /api/stores/{id}/shopify/start?return_to=/settings`

  - Gera link de instalação OAuth (state+HMAC Shopify, TTL Redis).

- `GET  /api/shopify/callback`

  - Valida `state`/HMAC, troca `code` por token, salva `shopify_access_token_enc`, `shopify_shop`, `shopify_api_version`. Redireciona para `return_to`.

- `GET  /api/stores/{id}/shopify/health`

  - Verifica chamada autenticada simples (ex.: listar 1 produto), retorna `{ok, api_version, last_sync_at}`.

- `GET  /api/stores/{id}/shopify/products?limit=&page_info=`

  - Lista produtos/variants (paginação por `page_info`), inclui `sku`, `product_id`, `variant_id`, `inventory_item_id`, `published`.

- `POST /api/stores/{id}/blocks/sync-shopify`

  - Para cada `feed_item_id` bloqueado:

    - Resolve `variant_id` por SKU;
    - Ação configurável por loja: **A)** `unpublish` do produto, **B)** inventário `0` da variant (todas locations), **C)** `draft`;

  - Para desbloqueios: revert **A/B/C** conforme política.
  - Retorna relatório `{blocked_updated, unblocked_updated, errors[]}`.

**Políticas de ação (por loja)**

- Campo em `stores` ou tabela `store_settings`: `shopify_block_action ∈ {UNPUBLISH, ZERO_INVENTORY, DRAFT}` com default `UNPUBLISH`.

**Resiliência/Rate-limit**

- Retry com backoff exponencial + jitter para 429/5xx (respeitar headers de rate limit se presentes).
- Limite de batch por chamada (ex.: 50 SKUs por sync).

**Auditoria**

- Eventos: `shopify_oauth_start`, `shopify_oauth_callback`, `shopify_health`, `shopify_products_list`, `shopify_block_sync`.
- Campos: `store_id`, `user_id`, `ip`, `status`, `count`, `errors`.

---

### 2) Frontend (React)

**Configurações / Settings**

- Botão **“Conectar Shopify”** → chama `/api/stores/{id}/shopify/start`.
- Badge de status (conectado / não conectado) + **Health** (versão, última sync).
- Tabela simples para listar produtos/variants (primeira página), com colunas: `SKU`, `Product ID`, `Variant ID`, `Published`, `Inventory`.
- Ação “Sincronizar Bloqueios” (chama `/blocks/sync-shopify` e mostra resumo).

**UX**

- Toasts para `connected`, `sync completo`, `erros parciais`.
- Guardar política de ação (UNPUBLISH/ZERO_INVENTORY/DRAFT) em Settings.

---

### 3) Segurança

- Validar HMAC do Shopify em `/callback` (query `hmac`).
- Criptografar token (`shopify_access_token_enc`) com chaves já usadas no projeto.
- RBAC: somente `owner|admin` pode conectar/sincronizar.

---

### 4) Qualidade

- `respx`/mocks para Admin API no CI (sem rede).
- Tratamento de paginação por `page_info` (cursor-based).
- Logs JSON com `shop`, `rate_limit_remaining` (se exposto) e `retry_count`.

---

## DoD

- Conexão OAuth concluída em **dev store**: `health` retorna **OK**.
- Página de produtos lista **variants** com SKU e published.
- `blocks/sync-shopify`:

  - Bloquear SKU → produto **despublicado** (ou estoque=0 / draft) em ≤60s.
  - Desbloquear SKU → revertido conforme política.

- Auditoria grava eventos e contagens.
- Testes (mocks) passando no CI; sem dependência de rede.

---

## Validações

- **Manual**:

  1. Conectar dev store → ver status em `/shopify/health`.
  2. Criar 3 produtos (SKUs) na loja; bloquear 2 no GMC Shield → rodar `blocks/sync-shopify` → conferir unpublish/estoque.
  3. Desbloquear 1 → rodar sync → conferir publish/estoque.

- **Logs**: checar rate-limits, retries, auditoria.
- **DB**: `stores.shopify_*` preenchidos; `shopify_last_sync_at` atualizado.

---

## Observações

- Mantém **paridade** conceitual com Woo (T14) **sem plugin**, usando Admin API.
- Em T34 (próxima), adicionaremos **Webhooks Shopify** (products/update, inventory_levels/update) para reconciliação automática e menor acoplamento a “sync manual”.

---

### T34 — Shopify Webhooks & Reconciliação

**Objetivo**
Receber eventos do Shopify (products/inventory/app) com verificação HMAC, manter um **índice local** consistente de produtos/variants por SKU e reconciliar bloqueios/desbloqueios automaticamente.

---

## Escopo

### 1) Backend (FastAPI)

**Variáveis (.env / Settings)**

- `SHOPIFY_WEBHOOK_SECRET` (obrigatória; usada p/ HMAC)
- `SHOPIFY_WEBHOOK_TOPICS="products/update,products/delete,inventory_levels/update,app/uninstalled"` (padrão)
- `SHOPIFY_API_VERSION="2024-07"` (herdado do T33)
- `SHOPIFY_WEBHOOK_SELF_URL` (opcional; para auto-registro)

**DB/Migração**

- Tabela `shopify_webhooks`:

  - `id` (pk), `store_id`, `shop_domain`, `topic`, `webhook_id` (header), `delivered_at`, `payload_sha256`, `status ∈ {processed, skipped, failed}`, `error`, `created_at`.
  - Índice único `(store_id, webhook_id)` → **idempotência**.

- Tabela `shopify_index` (cache local de catálogo):

  - `id`, `store_id`, `sku` (indexado), `product_id`, `variant_id`, `inventory_item_id`, `published` (bool), `inventory_quantity` (int), `updated_at`.
  - Índices em `(store_id, sku)` e `(store_id, product_id)`.

**Rotas**

- `POST /api/shopify/webhooks`

  - Aceita todos os tópicos.
  - Verifica HMAC (`X-Shopify-Hmac-Sha256`), `X-Shopify-Topic`, `X-Shopify-Shop-Domain`, `X-Shopify-Webhook-Id`.
  - Enfileira job `rq-shopify` com `{store_id, topic, webhook_id, body}` (ACK 200 rápido).

- `POST /api/stores/{id}/shopify/register-webhooks`

  - Usa Admin API para registrar os tópicos configurados apontando para `/api/shopify/webhooks`.
  - Salva/atualiza `webhook_ids` se desejar (opcional).

- `GET  /api/stores/{id}/shopify/webhooks/health`

  - Retorna contagem de últimos recebidos por tópico, latência média (entrega→processamento), últimos erros.

**Workers / Reconciliação**

- Queue `rq-shopify`, função `process_webhook(store_id, topic, webhook_id, body)`:

  - **Idempotência**: checa `shopify_webhooks` por `webhook_id`; se existe → `skipped`.
  - `products/update`:

    - Atualiza/insere em `shopify_index` cada variant (por `sku`), `published`, `variant_id`, `inventory_item_id`.

  - `products/delete`:

    - Marca em `shopify_index` como removido (`published=false`, `inventory_quantity=0`) ou apaga linha (preferir “soft delete”).

  - `inventory_levels/update`:

    - Atualiza `inventory_quantity` por `inventory_item_id` (resolver mapeamento item→variants já armazenado).

  - `app/uninstalled`:

    - Zera `stores.shopify_access_token_enc` (ou marca `disconnected=true`) e desabilita auto-sync; cria notificação para o usuário.

- **Reconciliação de Bloqueios**:

  - Para `products/update` e `inventory_levels/update`, se a loja tem SKUs **bloqueados**:

    - Reaplicar política (UNPUBLISH/ZERO_INVENTORY/DRAFT) **apenas se** detectar divergência (drift) no estado atual.

  - Gravar auditoria `shopify_reconcile` com `{changed, skipped, errors[]}`.

**Segurança**

- Verificação estrita do HMAC e domínio (`shop_domain` deve casar com `stores.shopify_shop`).
- Responder 401/400 em caso de HMAC inválido ou domínio desconhecido.
- Limitar payload a 1MB e “early return” em topics não habilitados.

**Observabilidade**

- Logs JSON por evento: `{store_id, topic, webhook_id, duration_ms, actions, errors}`.
- Métricas simples: contador por tópico, taxa de falha, tempo médio de processamento.

---

### 2) Frontend (React)

**Settings / Health**

- Em **Settings** (Shopify): seção **Webhooks** com:

  - Botão **“(Re)Registrar Webhooks”** → chama `/shopify/register-webhooks`.
  - Cards de saúde por tópico (recebidos nas últimas 24h, último erro).

- Banner se app foi desinstalado (baseado em `stores.shopify_access_token_enc` vazio ou flag).

---

### 3) Qualidade

- **Mocks** (respx) para Admin API somente em `register-webhooks`; o endpoint de **recebimento** é testado com payloads fixos (sem rede).
- Testes de HMAC (válido/ inválido), idempotência (`webhook_id` repetido), e reconciliação quando bloqueios existem.
- Fixtures JSON de `products/update`, `inventory_levels/update`, `products/delete`, `app/uninstalled`.

---

## DoD

- Webhooks registrados e **recebidos** (logs exibem `topic`, `webhook_id`).
- `shopify_index` atualizado em tempo real após `products/update` e `inventory_levels/update`.
- Se um SKU bloqueado voltar a ser publicado/estoque>0 na Shopify, a reconciliação **reaplica** a política em ≤60s.
- `app/uninstalled` desabilita integração e mostra aviso na UI.
- Health endpoint reflete contagens e últimos erros; auditoria cobre eventos.

---

## Validações

- **Manual** (dev store):

  1. Registrar webhooks → criar/editar produto/variant; observar `shopify_index`.
  2. Bloquear SKU no GMC Shield → forçar mudança contrária na Shopify → ver reconciliação reverter.
  3. Desinstalar app → ver banner e status desconectado.

- **CI**: testes de HMAC, idempotência e reconciliação com fixtures.
- **DB/Logs**: `shopify_webhooks` populado, `status` coerente, métricas por tópico.

---

## Observações

- Mantém o padrão de **idempotência** e reconciliação já usado em outras integrações (Woo).
- Prepara terreno para **T35** (Catálogo Unificado & Matching SKU↔FeedItem) e **T36** (Sync bidirecional opcional).

---

### T35 — Catálogo Unificado & Matching (SKU ↔ Feed ↔ Shopify/Woo)

**Objetivo**
Unificar a visão de produto por **SKU** dentro da loja, conciliando **feed** (T1), **índices da plataforma** (Shopify: T34; Woo: T14) e **snapshots** (T4) em um **catálogo canônico** com detecção de conflitos.

---

## Escopo

### 1) Modelo & Migração (Alembic)

**Novas tabelas**

- `catalog_items`

  - `id` (pk)
  - `store_id` (fk)
  - `sku` (text, **unique** por `store_id`)
  - `title` (text, opcional)
  - `brand` (text, opcional)
  - `gtin` (text, opcional normalizado)
  - `mpn` (text, opcional)
  - `link_canonical` (text, opcional)
  - **Fonte canônica** (`source ∈ {feed, shopify, woo, mixed}`)
  - **Sinais canônicos**: `price_cents`, `currency`, `availability` (`in_stock|out_of_stock|preorder|unknown`)
  - `last_synced_at`
  - Índices: `(store_id, sku)` **único**, `(store_id, brand)`

- `catalog_links`

  - `id` (pk)
  - `store_id` (fk)
  - `sku`
  - `source ∈ {feed, shopify, woo}`
  - `ref_id` (ex.: `feed_items.id`, `shopify_index.variant_id`, `woo_product_id`/`variation_id`)
  - `status ∈ {active, missing, stale}`
  - `created_at`, `updated_at`
  - Índices: `(store_id, sku, source)`; `(store_id, source, ref_id)` **único**

**Ajustes em tabelas existentes**

- `feed_items`: índice em `(store_id, item_id)` já existe; garantir.
- `shopify_index` (T34): já tem `sku`, `variant_id`, `inventory_item_id`; garantir índice `(store_id, sku)`.

### 2) Serviço de Matching & Consolidação

**Módulo**: `api/app/services/catalog.py`

**Regras de matching (determinísticas)**

1. **Chave primária: SKU**

   - Normalizar: `sku_norm = clean_text(sku).strip()` _(sem espaços extras; não alterar case por padrão — manter `case-sensitive` se o domínio usar assim)_
   - Feed → `FeedItem.item_id`; Shopify → `variant.sku`; Woo → sku do produto/variação.

2. **Vínculo (upsert)**

   - Ao criar/atualizar `feed_items` **ou** `shopify_index` **ou** Woo:

     - `get_or_create catalog_items(store_id, sku_norm)`
     - Atualizar/insert em `catalog_links`:

       - `{source=feed, ref_id=feed_item.id}`
       - `{source=shopify, ref_id=variant_id}` / `{source=woo, ref_id=variation_id}`

3. **Fonte canônica (`catalog_items.source`)**

   - Prioridade padrão: **feed > shopify > woo** (configurável por loja no futuro).
   - Se existir em múltiplas fontes, o `source=mixed` mas os **valores canônicos** vêm da prioridade:

     - `title/price/currency/availability/link` herdados da fonte de maior prioridade **que possua o campo**.
     - Campos faltantes podem ser preenchidos por fontes de menor prioridade (merge “preenchimento”).

4. **Normalizações**

   - `price_cents`/`currency` e `availability` de cada fonte devem passar pelos mesmos helpers de T1.
   - `gtin/mpn/brand/title/link` idem (usar `normalize_gtin`, `clean_text`, `canonicalize_link`).

**Detecção de Conflitos (gravados em `catalog_items` ou como view derivada)**

- `CONFLICT_PRICE`: diferença > X% entre feed e plataforma (X=5% default).
- `CONFLICT_AVAILABILITY`: feed diz `in_stock` mas plataforma `0` ou não publicado.
- `CONFLICT_CURRENCY`: `currency` diverge.
- `CONFLICT_TITLE`: títulos muito distintos (distância > limiar).
- Guardar flags computadas em campos derivados (ex.: `conflicts_json`) ou em tabela `catalog_conflicts(store_id, sku, codes[], updated_at)`.

**Jobs**

- `rebuild_catalog(store_id, scope)`:

  - Percorre `feed_items` e `shopify_index` (e Woo, se ativo), faz upsert em massa nos `catalog_*`.
  - Recalcula canônicos e conflitos.

- Hooks:

  - T1 (ingest feed) → dispara `rebuild_catalog(store_id, scope="feed:version:{id}")` incremental pelos SKUs tocados.
  - T34 (webhooks Shopify) e T14 (sync Woo) → idem pelos SKUs alterados.

### 3) API

**Rotas (v1)**

- `GET /api/v1/stores/{id}/catalog/items?query=&brand=&has_conflicts=&page=&limit=`

  - Retorna itens canônicos com campos: `sku, title, brand, price_cents, currency, availability, source, conflicts[]`.

- `GET /api/v1/stores/{id}/catalog/items/{sku}`

  - Detalhe + **proveniência** (valores por fonte, links, timestamps).

- `POST /api/v1/stores/{id}/catalog/rebuild {scope?}`

  - Admin/owner: reprocessar catálogo (full/partial).

- **Compatibilidade**

  - `GET /api/stores/{id}/items` (legado) pode redirecionar/alias para o canônico paginado (ou manter ambos durante migração).

**RBAC**

- `viewer` pode listar/consultar.
- `analyst/admin/owner` podem `rebuild`.

### 4) UI (React)

- Nova página **Catalog** (ou evoluir `Items.jsx`):

  - Tabela canônica com filtros (query por sku/title, brand, conflicts).
  - Badge de **fonte** (`feed/shopify/woo/mixed`).
  - Pill de conflito (clicável para ver difs).

- **Detalhe do item**:

  - Painel comparativo “fonte por fonte” (feed × shopify × woo) para: `title/price/currency/availability/link`.
  - Ações rápidas: “abrir na loja” (link plataforma) e “abrir snapshot” (último HTML/PNG).

### 5) Qualidade

- **Testes unit** (`tests/test_catalog_matching.py`)

  - Matching por SKU (feed-only; shopify-only; ambos; mixed).
  - Consolidação de campos (prioridade; preenchimento).
  - Conflitos (price%, availability, currency, title distance).

- **Testes integração**:

  - Executar ingest (T1) + simular webhook (T34) → `catalog_items` atualiza e conflitos aparecem.

- **Perf**:

  - Rebuild parcial para 10k SKUs em < N segundos (usar bulk upserts).
  - Índices verificados para queries de UI (ex.: `(store_id, sku)`).

---

## DoD

- `/catalog/items` lista SKUs com valores canônicos e \*\*conflicts\[]\` quando houver.
- Detalhe do SKU mostra as **fontes** e diffs de forma clara.
- Hooks de ingest/webhooks alimentam `catalog_*` incrementalmente sem necessidade de full rebuild.
- Rebuild completo funciona e respeita índices/tempo alvo.

---

## Validações

- **Script**: ingerir `demo_feed.csv` (≥60) e simular 5 updates de preço no Shopify → ver `CONFLICT_PRICE` em subset.
- **UI**: filtrar por `has_conflicts=true` retorna apenas SKUs com divergências; clicar no SKU mostra difs.
- **DB**: checar unicidades e que não há `catalog_links` órfãos; medir tempo de rebuild.

---

## Observações

- Evitar heurísticas “mágicas” de matching: **SKU é a chave**. Se faltar SKU em alguma fonte, registrar `missing` e **não** inferir por título.
- A prioridade de fonte pode virar **configurável** por loja em tarefas futuras.
- Prepara terreno para **T36** (Sync bidirecional opcional) e para relatórios de **consistência** (T19).

---

### T36 — Sincronização Bidirecional (Catálogo → Plataforma) com Guardrails

**Objetivo**
Permitir **corrigir conflitos automaticamente** no Shopify/Woo a partir do **Catálogo Canônico** (T35), com **pré-visualização**, **aprovação** e **políticas de segurança** (dry-run por padrão).

---

## Escopo

### 1) Políticas & Configuração por Loja

- **Tabela/JSON config** `store_sync_policies` (ou coluna JSON em `stores`):

  - `enabled` (default: false)
  - `dry_run_default` (true)
  - `allowed_fields`: subset de `{price, compare_at_price, availability(publish/unpublish|stock), title, tags, visibility}`
  - `max_changes_per_run` (ex.: 200)
  - `price_guard`: `{max_delta_pct: 5, currency_lock: true}`
  - `schedule`: opcional (cron para reconciliação automática)
  - `platform_priority`: `{feed > shopify > woo}` (herdado do T35; aqui apenas leitura)

- **RBAC**: somente `owner|admin` podem alterar políticas e aplicar mudanças.

### 2) Motor de Sync

- **Módulo** `api/app/services/sync.py`:

  - Recebe **diffs** do Catálogo (T35) e **gera operações** por plataforma:

    - Shopify (T34): usar Admin API (REST/GraphQL) para `price`, `compare_at_price`, `inventoryLevel`/`publish`.
    - Woo (T14): REST v3 para `regular_price`, `stock_status`, `status`/`catalog_visibility`.

  - **Idempotência**:

    - Chaves `sync:{store_id}:{source}:{sku}:{field}:{expected_rev}`.
    - Usar **versionamento**/`etag`/`if-match` quando disponível (Shopify `updated_at`/`inventory_item_id`).

  - **Loop avoidance**:

    - Ao aplicar mudança, **marcar origem** `source=gmc_shield` via metadado/tag para que webhooks ignorem eco.

  - **Rate limit & retry**:

    - Token bucket por host; retries com backoff (429/5xx).

  - **Rollback window**:

    - Persistir `previous_values` por 7 dias em `sync_changes` para undo.

### 3) API (v1)

- `GET /api/v1/stores/{id}/catalog/diff?fields=&only_conflicts=&limit=`
  Gera **pré-visualização**: por SKU, campo, `current (platform)`, `desired (catalog)`, `delta`, `risk`.
- `POST /api/v1/stores/{id}/catalog/sync/preview` `{filters, fields, limit}`
  Mesmo payload, mas persistindo um **draft** (`sync_draft_id`) com snapshot do diff.
- `POST /api/v1/stores/{id}/catalog/sync/apply` `{sync_draft_id, dry_run?}`
  Aplica mudanças (ou simula) respeitando políticas/limites; enfileira jobs.
- `POST /api/v1/stores/{id}/catalog/sync/rollback` `{change_ids[]}`
  Restaura valores anteriores (se dentro da janela).
- `GET /api/v1/stores/{id}/catalog/sync/runs`
  Histórico (status, counts, erros).
- **RBAC**: `viewer` pode ver diffs; `analyst` pode gerar preview; `admin/owner` aplicam.

### 4) Worker & Jobs

- Fila `sync`:

  - **Batching** por plataforma (Shopify vs Woo) e por tipo de operação.
  - **Ordem segura**: publish/unpublish após price para evitar inconsistências.
  - **Observabilidade**: logs JSON `{store_id, sku, field, from, to, dry_run, applied, latency_ms, platform, status}`.
  - **Dedupe**: evitar repetir a mesma operação em paralelo.

### 5) Auditoria

- Tabela `sync_changes`:

  - `id`, `store_id`, `sku`, `platform`, `field`, `from_value`, `to_value`, `applied_by (user_id)`, `dry_run`, `job_id`, `status`, `error`, `created_at`
  - `undo_from_value`, `undo_to_value`, `undo_at`, `undo_by`

- Eventos no **audit log**: `sync.preview`, `sync.apply`, `sync.rollback`.

### 6) UI (React)

- Página **Catalog → Sync**:

  - Filtros (conflitos, campos, delta%).
  - Tabela de **diffs** com seleção em massa; coluna **risk** (ex.: preço >5%).
  - Botões: **Preview (draft)**, **Apply (dry-run)**, **Apply (live)**, **Rollback**.
  - Badges de estado por linha (applied/failed/dry-run).

### 7) Qualidade & Segurança

- **Guarda de políticas**: bloquear campos não permitidos, deltas acima do guard, currency divergente se `currency_lock`.
- **Proteção transacional**: se batch falhar > X%, interromper run.
- **Testes**:

  - Unit: geração de diffs; aplicação limitada por policy; rollback.
  - Integração: mock Shopify/Woo com 429/5xx; ver retries/backoff.
  - E2E leve: fluxo preview→apply(dry)→apply(live)→rollback em loja de teste.

---

## DoD

- **Preview** lista diffs coerentes (≥10 SKUs com `CONFLICT_PRICE/AVAILABILITY`).
- **Apply (dry-run)** não altera plataforma e grava `sync_changes(dry_run=true)`.
- **Apply (live)** atualiza **apenas** campos permitidos e dentro dos guardrails; plataforma reflete mudanças.
- **Catalog (T35)** recalcula e conflitos resolvidos desaparecem nos SKUs afetados.
- **Rollback** reverte com sucesso dentro da janela de 7 dias.
- Logs/auditoria completos e legíveis.

---

## Validações

- **Cenário controlado**:

  1. Introduzir conflito de preço em 20 SKUs (Shopify/Woo).
  2. Gerar **preview** filtrando `price` e `delta% > 3`.
  3. Aplicar **dry-run** (sem efeitos) e revisar `sync_changes`.
  4. Aplicar **live** para 10 SKUs; confirmar na plataforma e no catálogo.
  5. **Rollback** de 2 SKUs; confirmar reversão.

- **Resiliência**:

  - Simular 429/5xx e verificar retry limitado + interrupção do run ao exceder erro.

- **Segurança**:

  - Tentar aplicar campo bloqueado por policy → **negado**.
  - Tentar delta > guard → **negado** (tratado no preview e no apply).

---

## Observações

- **Fonte da verdade** continua sendo o **Catálogo Canônico** (T35).
- Evitar “guerra” entre feed e plataforma — **prioridade e guardrails** são obrigatórios.
- Integrar com webhooks (T34/T14) marcando mudanças originadas pela app para não gerar **loops**.
- Este T36 é opcional para produção inicial; pode ficar atrás de **feature flag** por loja.

---

### T37 — Auto-Fix Engine & Guided Remediation

**Objetivo**
Oferecer **correções automáticas/assistidas** para violações comuns (preço/SD/canonical/robots), com **preview**, **aprovação**, **aplicação** (Woo/Shopify) e **verificação pós-fix**.

---

## Escopo

### 1) Política de Auto-Fix por Loja

- Nova tabela/coluna JSON `store_autofix_policies`:

  - `enabled` (default: false)
  - `dry_run_default` (true)
  - `allowed_rules`: subset de `["PRICE_MISSING","SD_ABSENT","CANONICAL_MISMATCH","ROBOTS_NOINDEX","TITLE_EMPTY"]`
  - `max_changes_per_run` (ex.: 100)
  - `post_verify_snapshot` (true)

- RBAC: somente `owner|admin` habilita/aplica.

### 2) Motor de Auto-Fix (API)

- Módulo `api/app/services/autofix.py`:

  - **Resolvers por regra** → plano de ação por plataforma:

    - `PRICE_MISSING`: preencher preço a partir do **Catálogo Canônico** (T35) → Woo (regular_price) / Shopify (price/compare_at).
    - `SD_ABSENT`: injetar JSON-LD Product/Offer canônico (plugin Woo / Theme App Extension no Shopify).
    - `CANONICAL_MISMATCH`: ajustar `link rel=canonical` (Woo via hook/tema; Shopify via snippet/TE).
    - `ROBOTS_NOINDEX`: remover `noindex`/`X-Robots-Tag` (opção de tema/metacampos).
    - `TITLE_EMPTY`: sincronizar título do Catálogo (guard com limite de delta e comprimento).

  - **Gerar plano** (`autofix_plan`): lista de ações `{sku, platform, field/type, from, to, risk}`.
  - **Aplicar plano** com idempotência e **origin marker** (`x-gmcshield`) para evitar loops de webhook.
  - **Rollback** por ação (janela de 7 dias), reaproveitando `sync_changes` (T36).

### 3) Integrações de Plataforma

- **Woo (plugin-woo/)**:

  - Hook para **injetar JSON-LD** (template Jinja por loja) e para `rel=canonical`.
  - Rotas autenticadas p/ setar `regular_price`, `stock_status`, `meta` (robots).
  - Admin Notice “Corrigir agora” (botão dispara endpoint da API do Shield).

- **Shopify (T34)**:

  - **Theme App Extension** com snippet JSON-LD e canonical (flag por template).
  - Ajuste de preço/availability via Admin API (com guardrails do T36).
  - App Proxy para **dry-run preview** (opcional).

### 4) API (v1)

- `GET /api/v1/stores/{id}/autofix/candidates?rules=&limit=`
  Lista violações fixáveis com proposta (`plan_preview`).
- `POST /api/v1/stores/{id}/autofix/preview` `{rules, filters}`
  Gera **draft** (`autofix_draft_id`) com plano consolidado.
- `POST /api/v1/stores/{id}/autofix/apply` `{autofix_draft_id, dry_run?}`
  Executa alterações (ou simula), respeitando políticas.
- `POST /api/v1/stores/{id}/autofix/rollback` `{change_ids[]}`
  Reverte específica(s) ação(ões).
- `GET /api/v1/stores/{id}/autofix/runs`
  Histórico com contagens e erros.

### 5) UI (React)

- **Remediation Center**:

  - Filtros por regra/severidade.
  - Grid com **plano proposto** (diff por SKU/campo) + badges de risco.
  - Ações: **Preview draft**, **Apply (dry)**, **Apply (live)**, **Rollback**.
  - Pós-aplicação: mostrar **snapshot de verificação** (novo crawl do item) e status da violação (resolvida?).

### 6) Segurança & Guardrails

- Bloquear alterações fora de `allowed_rules`.
- Não aplicar se delta de preço > limite da política (herdar guard de T36).
- Limitar por run (`max_changes_per_run`).
- **Observabilidade**: logs JSON por ação `{rule, sku, field, from, to, dry_run, applied, platform, latency_ms, status}`.
- Auditoria: `autofix.preview`, `autofix.apply`, `autofix.rollback`.

### 7) Testes

- Unit: geração de planos por regra; filtros/guardrails; rollback.
- Integração: Woo/Shopify mock com 429/5xx (retries/backoff).
- E2E leve: `candidates → preview → apply(dry) → apply(live) → verify snapshot → rollback`.

---

## DoD

- `candidates` retorna ≥ 3 tipos de violações com planos coerentes.
- `apply (dry-run)` não altera plataformas e registra mudanças.
- `apply (live)` corrige **ao menos 3 regras** (incluindo `SD_ABSENT` via snippet) e as violações somem após verificação.
- **Rollback** de um subconjunto reverte o estado anterior com sucesso.
- Logs/auditoria completos; nenhuma mudança fora do escopo permitido pela política.

---

## Validações

1. Criar dataset com 15 SKUs (5 `PRICE_MISSING`, 5 `SD_ABSENT`, 5 `CANONICAL_MISMATCH`).
2. Rodar `preview` e revisar riscos; aplicar **dry-run**.
3. Aplicar **live** para 10 SKUs; confirmar no Woo/Shopify e no **snapshot pós-fix** que a violação foi sanada.
4. Executar **rollback** de 2 SKUs e validar reversão.
5. Simular 429/5xx e verificar comportamento de retry/backoff limitado.

---

## Observações

- Mantém o **Catálogo Canônico** (T35) como fonte primária dos valores.
- Snippets de JSON-LD/canonical são **versionados** (TE no Shopify, template no Woo) para auditoria.
- Pode ser **feature-flag** por loja até maturidade de tuning.

---

Aqui vai a versão “fechada” do backlog propositivo (T38+) — já priorizada, com escopos enxutos, critérios de sucesso e dependências. Está pronta para colar no seu documento.

---

## Próximas fases — backlog propositivo (T38+)

> Organização por **eixos** e uma shortlist de **T38–T47** para o próximo ciclo. Cada item traz Objetivo, Escopo, DoD e Dependências.

### Matriz rápida de prioridade

- **P0 (alto impacto / baixa incerteza)**: Shopify Connector, BigQuery Export, Rule Suggestions v1, Usage-based Billing v2.
- **P1 (alto impacto / média incerteza)**: GA4/Ads awareness, GDPR/DSR, SSO Enterprise, Anomalias Preço/Estoque.
- **P2 (investimento infra/escala)**: HA multi-região, K8s/HPA, Canary/Feature Flags, Magento/VTEX.

---

## Shortlist para o próximo ciclo (T38–T47)

### T38 — Shopify Connector (MVP) **\[P0]**

**Objetivo**: Paridade básica com Woo (bloqueios, políticas, health).
**Escopo**: App privado + Admin API; Theme App Extension p/ JSON-LD/canonical; endpoints de health/sync; mapeio SKU↔variant.
**DoD**: Block/unblock reflete em ≤60s; JSON-LD/canonical injetados; health OK na UI.
**Dependências**: T34/T36 guardrails de sync.

---

### T39 — BigQuery Export (Batch) **\[P0]**

**Objetivo**: Abrir dados para BI.
**Escopo**: job diário → export de tabelas normalizadas (violations, scans, items) em GCS/Parquet; config por loja/conta.
**DoD**: Dataset aparece no BQ com partições por dia; consulta exemplo no README.
**Dependências**: T20 métricas para custos/volume (opcional).

---

### T40 — Rule Suggestions v1 **\[P0]**

**Objetivo**: Sugerir ajustes de thresholds/regras com base nos achados.
**Escopo**: heurísticas simples (frequência, severidade, taxa de FP); UI com “Apply suggestion” (gera PR de config por loja).
**DoD**: Pelo menos 3 sugestões aplicáveis por loja; audit trail do apply.
**Dependências**: T25 tuning/waivers.

---

### T41 — Usage-based Billing v2 **\[P0]**

**Objetivo**: Cobrar por uso (itens/scan/GB) além de planos.
**Escopo**: medidores por recurso; integração Stripe usage records; limites soft/hard; UI de consumo.
**DoD**: Faturamento sandbox reflete consumo semanal; bloqueios/avisos funcionam.
**Dependências**: T29 billing v1.

---

### T42 — GA4/Google Ads Awareness **\[P1]**

**Objetivo**: Correlacionar violações com performance.
**Escopo**: Conector só-leitura (GA4 Data API, Ads Reports) → métricas por SKU/URL; painel “Impacto de Qualidade”.
**DoD**: Tela cruza top regras × queda de CTR/conv.
**Dependências**: Consent/escopo adicionais (OAuth incremental).

---

### T43 — GDPR/Privacy (DSR) **\[P1]**

**Objetivo**: Export/erase de dados pessoais e retenções.
**Escopo**: endpoints de DSR; rotas admin; retention policies por tipo de dado; logs de conformidade.
**DoD**: Fire-drill DSR conclui em ambiente de teste; relatório de auditoria.
**Dependências**: T28 auditoria.

---

### T44 — SSO Enterprise (SAML/OIDC) **\[P1]**

**Objetivo**: Integração corporativa (Okta/AzureAD).
**Escopo**: provedor SAML/OIDC para login; SCIM opcional para provisionamento; mapeamento de grupos→RBAC.
**DoD**: Login via IdP com RBAC aplicado; playbook de setup.
**Dependências**: T12 RBAC/headers.

---

### T45 — Detecção de Anomalias (Preço/Estoque) **\[P1]**

**Objetivo**: Alertar outliers e quedas abruptas.
**Escopo**: estatística leve (EWMA/IQR) por SKU; alertas + sugestão de regra; endpoints/cron.
**DoD**: Dataset sintético aciona alertas com baixa taxa de falsos positivos.
**Dependências**: T9 notificações.

---

### T46 — HA & Feature Flags (Foundations) **\[P2]**

**Objetivo**: Preparar base para escala/rollouts seguros.
**Escopo**: Canary/Blue-Green; OpenFeature p/ flags; presigned URLs S3 padronizados; readiness probes reforçados.
**DoD**: Deploy canário validado; feature flag liga/desliga Rule Suggestions sem downtime.
**Dependências**: T21 hardening.

---

### T47 — Magento/VTEX Discovery Spike **\[P2]**

**Objetivo**: Avaliar esforço e desenho de conectores.
**Escopo**: PoC leitura/escrita de produto e snippet SD; health; diferenças de auth e SKU keys.
**DoD**: Documento técnico com estimativa e riscos + mínimos endpoints PoC.
**Dependências**: Nenhuma (isolado).

---

## Backlog por eixo (para referência contínua)

### A) Integrações & Ecossistema

- Shopify/Magento/VTEX connectors (T38/T47).
- BigQuery/Redshift export (T39).
- GA4/Ads awareness (T42).

### B) Segurança & Compliance

- SSO/SCIM (T44), GDPR/DSR (T43), SOC2 checklist (iniciar com T28/T21).

### C) Inteligência & Automação

- Rule Suggestions v1 (T40), Anomalias (T45), Auto-remediation guiada (já iniciada em T37).

### D) Produto & UX

- Playbooks guiados, Mobile/push, Multi-tenant avançado (posterior ao T18).

### E) Infra & Confiabilidade

- HA multi-região, K8s/HPA/VPA, Canary/Feature Flags (T46).

### F) Monetização Avançada

- Usage-based billing v2 (T41), trials/promo codes e limites granulares.

---

## Critérios gerais de prontidão (Definition of Ready)

- OpenAPI desenhado; chaves de config em `.env.example`.
- Estrutura de DB e migrações Alembic esboçadas.
- Testes planejados (unit + integração mock).
- Impacto/risco documentados com rollback strategy.

## Como escolher o próximo lote

1. Pegue 2× P0 + 1× P1 (equilíbrio impacto/risco).
2. Garanta 1 item de **integração** e 1 de **produto/insight** no mesmo ciclo.
3. Use feature flags para mitigar risco de UI/fluxos novos.

---
