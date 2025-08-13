- [ ] Importar feed
- [ ] Gerar violações
- [ ] Publicar políticas
- [ ] Bloquear item
- [ ] Gerar PDF/ZIP/TEXTO
- [ ] Notificação diária

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

# D1 — Feed Ingestor (XML/CSV/TSV) + Versionamento

**Tipo:** feature • **Labels:** feed, backend • **Estimativa:** 1d

## Descrição

- Endpoint `POST /stores/{id}/feed` e leitura de URL/arquivo.
- Parse (id,title,link,price,sale_price,availability,brand,gtin,mpn,shipping).
- Normalização preço/moeda e limpeza de UTM.
- Hash/versionamento do feed e diffs básicos.

## Aceite

- [ ] Upload e URL funcionam.
- [ ] 60 itens importados do seed.
- [ ] `GET /feed/versions` lista historico com hash.

# D2 — Page Crawler (como o Google vê)

**Tipo:** feature • **Labels:** crawler, evidence • **Estimativa:** 1.5d

## Descrição

- Playwright (UA Googlebot e Chrome).
- Coleta: HTML renderizado, screenshot full, status, redirect chain.
- Extrações: preço visível, moeda, disponibilidade, H1, JSON-LD Product.
- Persistir `pages` e `snapshots` (paths).

## Aceite

- [ ] Para 20 itens do seed, salvar HTML+screenshot.
- [ ] Registrar redirects e status.

# D3 — Rules Engine (R1–R4) + Evidências

**Tipo:** feature • **Labels:** rules, misrepresentation • **Estimativa:** 1d

## Descrição

- R1 Preço divergente, R2 Moeda, R3 Disponibilidade, R4 Redirect suspeito.
- Evidence JSON com diffs, paths de artifacts, destaques CSS.

## Aceite

- [ ] Em loja demo, gerar ≥3 violações CRITICAL com prints.
- [ ] Modal na UI exibe evidências.

# D4 — Policy Generator + Publicar no WordPress

**Tipo:** feature • **Labels:** policies, wordpress • **Estimativa:** 0.5d

## Descrição

- Templates PT/ES (envio, devolução, contato, termos).
- Endpoint para render e enviar ao plugin WP criar/atualizar página.
- Wizard na UI com preview.

## Aceite

- [ ] Publicar 3 páginas no WP (demo) e retornar URLs.
- [ ] R5 muda de CRITICAL/WARN para OK após publicar.

# D5 — Feed Guard (Bloqueio Preventivo)

**Tipo:** feature • **Labels:** feed, prevention • **Estimativa:** 0.5d

## Descrição

- Tabela `blocks` + endpoints POST/DELETE.
- Plugin WP: meta `_gmc_shield_exclude=1` e coluna na lista de produtos.
- Mini supplemental feed com `excluded_destination=Shopping` (fallback).

## Aceite

- [ ] Toggle de bloqueio por item reflete no WP.
- [ ] Supplemental feed lista itens bloqueados.

# D6 — Appeal Kit (PDF + ZIP + Texto)

**Tipo:** feature • **Labels:** appeals, evidence • **Estimativa:** 1d

## Descrição

- PDF com resumo e prints antes/depois (WeasyPrint/Chromium).
- ZIP com screenshots+HTML+recorte de feed.
- Texto-base PT/ES com narrativa padrão.

## Aceite

- [ ] Botões "Gerar PDF" e "Baixar ZIP" entregam arquivos.
- [ ] Texto pronto para colar no GMC.

# D7 — Notificações & Varredura Diária

**Tipo:** feature • **Labels:** notify, scheduler • **Estimativa:** 0.5d

## Descrição

- Scheduler diário de scan por loja.
- E-mail (Sendgrid/SES) + Slack webhook (opcional).
- Centro de notificações na UI.

## Aceite

- [ ] Email de teste e resumo diário enviados.
- [ ] Preferências por loja salvas.

# D8 — UI Checklist & Evidence Viewer

**Tipo:** feature • **Labels:** ui,frontend,misrepresentation • **Estimativa:** 0.5d

## Descrição

- Dashboard KPI: _Pronto para revisão?_ (verde/amarelo/vermelho).
- Tabela de violações: filtros (severity/rule), modal de evidências (screenshot + HTML snippet).
- Checklist de políticas (shipping/returns/contact) com links-tracker.

## Critérios de Aceite

- [ ] Implementado conforme descrição
- [ ] Testes manuais (seed) e/ou unitários
- [ ] Documentado no README/DEMO

# D9 — Crawler Performance & Budget

**Tipo:** feature • **Labels:** crawler,perf • **Estimativa:** 0.5d

## Descrição

- Budget por loja (max páginas/dia). Timeout adaptativo.
- Retry com backoff exponencial. Cache 24h por URL.
- Rate limit por domínio (fila concorrente).

## Critérios de Aceite

- [ ] Implementado conforme descrição
- [ ] Testes manuais (seed) e/ou unitários
- [ ] Documentado no README/DEMO

# D10 — JWT Auth + RBAC (Owner/Manager/Viewer)

**Tipo:** feature • **Labels:** auth,security • **Estimativa:** 0.5d

## Descrição

- JWT com expiração, refresh opcional.
- Roles por usuário e escopo por loja.
- Proteção das rotas sensíveis.

## Critérios de Aceite

- [ ] Implementado conforme descrição
- [ ] Testes manuais (seed) e/ou unitários
- [ ] Documentado no README/DEMO

# D11 — WP Publish API (Policies) + Templates PT/ES

**Tipo:** feature • **Labels:** wordpress,policies • **Estimativa:** 0.5d

## Descrição

- Render via Jinja2. Variáveis: prazos, contato, endereço, NIF/CNPJ.
- Endpoint: POST /policies?publish=true → chama WP REST.
- Persistir URLs das políticas publicadas.

## Critérios de Aceite

- [ ] Implementado conforme descrição
- [ ] Testes manuais (seed) e/ou unitários
- [ ] Documentado no README/DEMO

# D12 — Feed Guard v1 (meta + UI toggle)

**Tipo:** feature • **Labels:** feed,prevention,woocommerce • **Estimativa:** 0.5d

## Descrição

- Tabela `blocks` e endpoints POST/DELETE.
- Plugin WP aplica meta `_gmc_shield_exclude=1`.
- UI: botão 'Excluir do feed' por item.

## Critérios de Aceite

- [ ] Implementado conforme descrição
- [ ] Testes manuais (seed) e/ou unitários
- [ ] Documentado no README/DEMO

# D13 — Appeal Kit v1 (PDF/ZIP + Texto)

**Tipo:** feature • **Labels:** appeals,evidence • **Estimativa:** 1d

## Descrição

- PDF: sumário de violações corrigidas + prints (antes/depois).
- ZIP: screenshots + HTML + recorte do feed.
- Texto-base PT/ES para colar no GMC.

## Critérios de Aceite

- [ ] Implementado conforme descrição
- [ ] Testes manuais (seed) e/ou unitários
- [ ] Documentado no README/DEMO

# D14 — Notificações: Email + Slack

**Tipo:** feature • **Labels:** notify,ops • **Estimativa:** 0.5d

## Descrição

- Scheduler diário. Resumo de novas violações e riscos críticos.
- Test endpoint '/notify/test'. Preferências por loja.

## Critérios de Aceite

- [ ] Implementado conforme descrição
- [ ] Testes manuais (seed) e/ou unitários
- [ ] Documentado no README/DEMO

# D15 — Evidence Center (timeline por item/página)

**Tipo:** feature • **Labels:** evidence,ui • **Estimativa:** 0.5d

## Descrição

- Histórico: snapshots, status, quem marcou 'fixed'.
- Links permanentes para artefatos.

## Critérios de Aceite

- [ ] Implementado conforme descrição
- [ ] Testes manuais (seed) e/ou unitários
- [ ] Documentado no README/DEMO

# D16 — R5 – Políticas mínimas

**Tipo:** feature • **Labels:** rules,misrepresentation • **Estimativa:** 0.5d

## Descrição

- Detectar ausência de shipping/returns/contact ou conteúdo vazio.
- Severidade: CRITICAL/WARN conforme nível.

## Critérios de Aceite

- [ ] Implementado conforme descrição
- [ ] Testes manuais (seed) e/ou unitários
- [ ] Documentado no README/DEMO

# D17 — R6 – Cookie sem consent

**Tipo:** feature • **Labels:** rules,privacy,lgpd • **Estimativa:** 0.5d

## Descrição

- Detectar GA/Ads/FB antes de consent ou ausência de banner.
- Nota: heurística simples no MVP.

## Critérios de Aceite

- [ ] Implementado conforme descrição
- [ ] Testes manuais (seed) e/ou unitários
- [ ] Documentado no README/DEMO

# D18 — R7/R8 – Structured Data & Noindex

**Tipo:** feature • **Labels:** rules,seo • **Estimativa:** 0.5d

## Descrição

- JSON-LD Product preço vs página (±5%).
- meta robots noindex/nofollow em produtos.

## Critérios de Aceite

- [ ] Implementado conforme descrição
- [ ] Testes manuais (seed) e/ou unitários
- [ ] Documentado no README/DEMO

# D19 — R9 – Claims arriscadas (regex)

**Tipo:** feature • **Labels:** rules,content • **Estimativa:** 0.25d

## Descrição

- Regex por termos de risco ("100% garantido", "cura", etc.).
- Severidade INFO/WARN.

## Critérios de Aceite

- [ ] Implementado conforme descrição
- [ ] Testes manuais (seed) e/ou unitários
- [ ] Documentado no README/DEMO

# D20 — Threshold Tuning & Suppress

**Tipo:** feature • **Labels:** rules,product • **Estimativa:** 0.5d

## Descrição

- Tolerância dinâmica por loja (±3–5%). Campo por regra.
- Marcar violação como 'suppressed' com motivo.

## Critérios de Aceite

- [ ] Implementado conforme descrição
- [ ] Testes manuais (seed) e/ou unitários
- [ ] Documentado no README/DEMO

# D21 — Agência: múltiplas lojas & subusers

**Tipo:** feature • **Labels:** multi-tenant,agency • **Estimativa:** 0.5d

## Descrição

- Visão 'Agency' com KPIs por loja.
- Convidar subusers (Manager/Viewer).

## Critérios de Aceite

- [ ] Implementado conforme descrição
- [ ] Testes manuais (seed) e/ou unitários
- [ ] Documentado no README/DEMO

# D22 — Stripe Billing (trial + plano Solo/Agência)

**Tipo:** feature • **Labels:** billing,stripe • **Estimativa:** 1d

## Descrição

- Stripe Customer + Subscription (trial 7–14d).
- Middleware que verifica status ativo.
- Página Billing na UI com portal.

## Critérios de Aceite

- [ ] Implementado conforme descrição
- [ ] Testes manuais (seed) e/ou unitários
- [ ] Documentado no README/DEMO

# D23 — Trial & Onboarding Guardrails

**Tipo:** feature • **Labels:** activation,product-led • **Estimativa:** 0.25d

## Descrição

- Checklist de ativação (1º scan, 1 política, 1 bloqueio).
- Nudge na UI até completar AHA.

## Critérios de Aceite

- [ ] Implementado conforme descrição
- [ ] Testes manuais (seed) e/ou unitários
- [ ] Documentado no README/DEMO

# D24 — Webhooks & API Pública (preview)

**Tipo:** feature • **Labels:** platform,api • **Estimativa:** 0.5d

## Descrição

- Webhook: 'violation.created', 'scan.completed'.
- Token de integração por loja.

## Critérios de Aceite

- [ ] Implementado conforme descrição
- [ ] Testes manuais (seed) e/ou unitários
- [ ] Documentado no README/DEMO

# D25 — Logging & Tracing (OpenTelemetry)

**Tipo:** feature • **Labels:** observability,ops • **Estimativa:** 0.5d

## Descrição

- Logs estruturados (request-id, store-id).
- Trace básico das rotas críticas.

## Critérios de Aceite

- [ ] Implementado conforme descrição
- [ ] Testes manuais (seed) e/ou unitários
- [ ] Documentado no README/DEMO

# D26 — Dashboards internos (Grafana/Metabase)

**Tipo:** feature • **Labels:** analytics,ops • **Estimativa:** 0.5d

## Descrição

- KPIs: violações por regra, tempo até reativação, bloqueios aplicados.
- Painel por loja e global.

## Critérios de Aceite

- [ ] Implementado conforme descrição
- [ ] Testes manuais (seed) e/ou unitários
- [ ] Documentado no README/DEMO

# D27 — Security Pass & Backups

**Tipo:** feature • **Labels:** security,gdpr • **Estimativa:** 0.5d

## Descrição

- Checklist de segurança (tokens, CORS, headers).
- Backup diário do Postgres. Retenção 7/30 dias.

## Critérios de Aceite

- [ ] Implementado conforme descrição
- [ ] Testes manuais (seed) e/ou unitários
- [ ] Documentado no README/DEMO

# D28 — Runbook Beta Onboarding

**Tipo:** feature • **Labels:** cs,ops • **Estimativa:** 0.25d

## Descrição

- Roteiro passo a passo para lojas beta (PT/ES).
- Scripts de validação rápida.

## Critérios de Aceite

- [ ] Implementado conforme descrição
- [ ] Testes manuais (seed) e/ou unitários
- [ ] Documentado no README/DEMO

# D29 — Case Study 01 (ES/BR)

**Tipo:** feature • **Labels:** marketing,cs • **Estimativa:** 0.5d

## Descrição

- Template 'antes/depois', métricas (dias até reativação).
- Landing page com highlights.

## Critérios de Aceite

- [ ] Implementado conforme descrição
- [ ] Testes manuais (seed) e/ou unitários
- [ ] Documentado no README/DEMO

# D30 — Launch Checklist (MVP)

**Tipo:** feature • **Labels:** launch,gtm • **Estimativa:** 0.25d

## Descrição

- Materiais: landing, vídeo 3min, checklist Misrepresentation.
- Política de preços e oferta beta.
- Handoff de vendas (script outbound).

## Critérios de Aceite

- [ ] Implementado conforme descrição
- [ ] Testes manuais (seed) e/ou unitários
- [ ] Documentado no README/DEMO
