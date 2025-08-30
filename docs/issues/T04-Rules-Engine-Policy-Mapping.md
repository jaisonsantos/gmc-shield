# T4 — Rules Engine & Policy Mapping
Tipo: feature • Labels: rules, violations, policy, crawler, extraction • Prioridade: P0

## Objetivo
Construir o motor de regras que detecta violações de políticas em páginas de produto, mapeadas às diretrizes do Google Merchant Center (GMC). O objetivo é alertar e prevenir bloqueios/desaprovações (ex.: Price/Availability mismatch, Misrepresentation) antes que o Merchant bloqueie itens.

## Estado atual (simulado)
- O worker simplificado (`worker/run_worker.py`) hoje cria violações “demo” durante o processamento de um scan:
  - `R1` Preço divergente: diferença relativa > 20% entre preço do feed e preço extraído da página.
  - `R2` Moeda divergente: moeda do feed vs. moeda extraída.
  - `R3` Disponibilidade divergente: disponibilidade do feed vs. texto extraído.
  - `R4` Redirect suspeito: heurística de amostragem (ex.: a cada 5 itens) simulando redirects fora do domínio.
- Fonte de dados: snapshots (HTML, redirects, extrações) produzidos pelo crawler e armazenados em `page_snapshots`.

## Escopo (fase 1 – paridade essencial)
- Normalizar entradas de regra (feed vs. extraído do snapshot) via helpers existentes (preço em centavos, ISO currency, availability mapeada).
- Implementar validações reais (sem amostragem aleatória):
  - `R1` Price mismatch: thresholds configuráveis por loja (`major=10%`, `critical=20%`).
  - `R2` Currency mismatch: comparação direta do ISO.
  - `R3` Availability mismatch: enum padronizado (in stock / out of stock / preorder). Mapear strings comuns.
  - `R4` Excessive/cross-domain redirects: N > 3 ou domínio final ≠ esperado (com whitelist por loja).
  - `R5` Identifiers: GTIN inválido/faltando quando `identifierExists=true` no feed (heurística por país/opcional).
  - `R6` Link quebra 404/410/5xx.
- Severidade: `critical`, `warning`, `info` mapeadas por regra e threshold.
- Idempotência: as violações recebem `run_id` e não são duplicadas quando os mesmos sinais se repetem num mesmo run.

## Escopo (fase 2 – políticas avançadas GMC)
- Misrepresentation checks (sinais de risco): divergência de branding, selos falsos, claims arriscados, abuso de microdata (opcional).
- Conteúdo sensível (categorias reguladas): aplicar regras de presença de disclaimers e gates.
- URL hygiene: UTM/affiliates, popups bloqueantes, interstitials.

## API/Model
- Já existente:
  - `POST /api/stores/{id}/scan` → cria `scan_runs` e `page_snapshots`.
  - `GET  /api/stores/{id}/violations?run_id=` → lista violações por execução.
- Adicionar (se necessário):
  - `GET /api/stores/{id}/violations/stats` → agregados 7d para dashboard.
  - `PATCH /api/stores/{id}/rules/config` → thresholds/whitelists por loja.

## Integração com Blocks (T6)
- Ações: ao “Bloquear” um item na UI, criar/ativar `blocks` localmente (já existe) e, quando T6 estiver pronto, sincronizar um feed suplementar para excluir destinos no GMC (opcional e reversível).

## Critérios de Aceite
- [ ] Execução de scan gera violações apenas para itens da loja (usa `feed_items` do DB).
- [ ] R1–R4 implementadas conforme thresholds; R5–R6 mapeadas e com flags desativáveis por loja.
- [ ] UI mostra severidades e links para evidências (snapshot/screenshot).
- [ ] Testes unitários para cada regra e testes integrados do fluxo (scan → violations).
- [ ] Documentação descreve regras, thresholds e fontes de dados.

## Testes
- Unitários: funções de verificação por regra (inputs feed vs snapshot). 
- Integração: simular scan com 3 itens (ok, mismatch preço, mismatch disponibilidade) e verificar `violations` persistidas e severidades.

## Observações
- Políticas do GMC evoluem: manter catálogo versionado das regras e linká-lo no OpenAPI/Docs. 
- Configurabilidade por loja é fundamental (mercados/categorias diferentes têm tolerâncias distintas).
