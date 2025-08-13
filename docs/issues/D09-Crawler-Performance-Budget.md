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
