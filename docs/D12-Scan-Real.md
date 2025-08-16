# D12 — Scan Real

Passos básicos para rodar o pipeline de scan real:

```bash
# subir stack completa
./ops/reset_and_boot.sh

# enfileirar scan de uma loja
curl -s -X POST http://localhost:8000/api/stores/1/scan -H 'Authorization: Bearer <TOKEN>' -H 'content-type: application/json' -d '{"limit_items":5}'

# listar execuções
curl -s http://localhost:8000/api/stores/1/scan/runs -H 'Authorization: Bearer <TOKEN>'
```

Os artefatos HTML são gravados em `worker/artifacts/`. O worker gera snapshots, aplica regras R1–R4 e cria violações vinculadas ao `run_id`.
