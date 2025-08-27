# T2 — Google Login (OIDC) — Sessão do SaaS
**Tipo:** feature • **Labels:** auth, oidc, oauth, google, security • **Prioridade:** P0

## Descrição
Implementar login “Continuar com Google” usando OIDC Authorization Code + PKCE, sem solicitar o escopo do Merchant Center. Persistir conta Google vinculada ao usuário local, com segurança (criptografia de refresh token) e testes mockados (sem rede). Rotas devem aparecer no OpenAPI.

## Escopo
- Variáveis de ambiente e `.env.example` atualizados (client id/secret, redirect, issuer, scopes base, endpoints overrideáveis).
- PKCE + `state` (+ `nonce` opcional) com TTL em Redis, chaves consumidas após uso.
- Endpoints:
  - `GET /api/auth/google/start?return_to=/path` → `{ auth_url }` (PKCE + state)
  - `GET /api/auth/google/callback?state&code` → cria/associa usuário, emite JWT, upsert `google_accounts`
- Modelo/Migração `google_accounts` (sub único, tokens criptografados, `content_scope_granted=false`).
- Rate-limit leve em start/callback; redirect whitelist; CORS/CSP compatíveis.
- Logs JSON e eventos (`oauth.start`, `oauth.callback.ok|error`).
- OpenAPI inclui as rotas.
- Testes unitários e de integração mockada (`respx`) sem rede.

## Critérios de Aceite
- [ ] `/api/auth/google/start` retorna `auth_url` com PKCE + `state` válido (TTL).
- [ ] `/api/auth/google/callback` autentica, cria/associa usuário e retorna JWT da app.
- [ ] `google_accounts` populado/atualizado; `refresh_token_enc` criptografado (se houver) e nunca sobrescrito por `NULL`.
- [ ] Chaves Redis de `state`/`pkce`/`nonce` são expiradas/consumidas corretamente.
- [ ] OpenAPI contém as rotas de OAuth.
- [ ] Testes offline (mockados) passando no CI.
- [ ] Rate-limit e redirect whitelist ativos; nenhum token sensível em localStorage.
- [ ] Logs JSON mostram eventos e `trace_id`.

## Evidências (preencher ao concluir)
- Resposta de `/api/auth/google/start`:
- Resultado do callback (JWT emitido / cookie):
- Dump de `google_accounts` (campos chave):
- Saída do `pytest -q` (tests oauth):
- Screenshot do OpenAPI com as rotas:
- Link do PR (se houve correções):

