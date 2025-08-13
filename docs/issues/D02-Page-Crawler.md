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
