# T3 — Conectar Merchant Center (escopo `content`)
**Tipo:** feature • **Labels:** oauth, google, merchant-center, api, web • **Prioridade:** P0

## Descrição
Habilitar consentimento incremental com o escopo `https://www.googleapis.com/auth/content`, listar contas acessíveis (authinfo), permitir a escolha e persistência de um `merchant_id` por loja e paginar produtos via Content API. Renovação de token deve ser automática e segura (criptografia e preservação de refresh token).

## Escopo
- Variáveis de ambiente/documentação: `GOOGLE_OAUTH_SCOPES_CONTENT`, `GOOGLE_API_BASE` (+ T2).
- Endpoint `GET /api/auth/google/start-content` (PKCE+state) e callback compartilhado com T2.
- Upsert em `google_accounts`: `content_scope_granted=true`, tokens/expiry atualizados sem sobrescrever `refresh_token` por `NULL`.
- Endpoints:
  - `GET /api/google/mc/accounts` → `content/v2.1/accounts/authinfo`
  - `GET /api/google/mc/{merchant_id}/products?maxResults=&pageToken=` → paginação
  - `POST /api/google/mc/{merchant_id}/import?store_id={id}` → importa produtos do GMC para `feed_items` (source `gmc`) com `FeedVersion` calculado por `content_hash`
- Renovação automática de token (pré-chamada e on-401 retry); 403 sinaliza reconectar.
- Persistência do `merchant_id` selecionado (ex.: `stores.google_merchant_id`).
- Frontend (Settings): conectar, listar contas, salvar `merchant_id`, listar primeira página de produtos e acionar import automático para a loja selecionada (itens passam a aparecer em Itens/Scans).
- Rate-limit leve; redirect whitelist; logs JSON com eventos.
- OpenAPI atualizado com as 3 rotas.

## Critérios de Aceite
- [ ] Fluxo de consent incremental conclui e `content_scope_granted=true` em `google_accounts`.
- [ ] `/api/google/mc/accounts` lista contas acessíveis.
- [ ] `merchant_id` selecionado é persistido no store.
- [ ] `/api/google/mc/{merchant_id}/products` retorna produtos com paginação.
- [ ] Renovação de token automática; `refresh_token_enc` preservado quando não retornado.
- [ ] OpenAPI contém `start-content`, `mc/accounts`, `mc/{merchant_id}/products`.
- [ ] OpenAPI contém `mc/{merchant_id}/import`.
- [ ] Testes (unit + integração mockada) passam no CI sem rede.
- [ ] Logs JSON mostram `oauth.content.start`, `oauth.content.granted`, `mc.authinfo.ok`, `mc.products.ok`.

## Evidências (preencher ao concluir)
- Resposta de `/api/auth/google/start-content`:
- Dump `google_accounts` (campos relevantes):
- Seleção persistida `stores.google_merchant_id`:
- Amostra de `/mc/accounts` e `/mc/{merchant_id}/products`:
- Resultado de `/mc/{merchant_id}/import?store_id=...` (contagem importada, `content_hash`):
- Saída do `pytest -q` (tests google content):
- Screenshot do OpenAPI com as rotas:
- Link do PR (se houve correções):
