# Kanban (GitHub Projects) — Como usar

## UI do GitHub (rápida)
1. Suba o repositório para o GitHub.
2. **Projects → New project** → nomeie `GMC Shield MVP`.
3. **Backlog → Add item → Add from repository**, filtre por label `mvp` e adicione todas as issues.
4. Use colunas: Todo / In progress / Review / Done.

## CLI (opcional)
- Requer `gh` autenticado: `gh auth login`.
- Crie o projeto: `gh project create "GMC Shield MVP" --owner YOUR_USER --format owner`
- Crie issues via script (abaixo) e depois use **Add items → Add from repository** com label `mvp`.

Consulte `scripts/seed_issues_from_docs.py` para gerar issues a partir de `docs/issues/`.
