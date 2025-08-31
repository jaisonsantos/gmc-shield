# T23 — Internacionalização (i18n) & Localização (l10n) v1
**Tipo:** feature • **Labels:** i18n, l10n, web, api • **Prioridade:** P0

## Descrição
Tornar o produto utilizável em PT/EN/ES com formatação regional consistente (datas, números, moeda) e preferência de idioma persistente por usuário (localStorage + servidor). Incluir negociação por `Accept-Language` quando o usuário não tiver preferência.

## Escopo
- Web (React):
  - `i18next` + `react-i18next` + `i18next-browser-languagedetector` configurados em `web/src/i18n/`.
  - Provider em `web/src/main.jsx` + `<Suspense>`.
  - `LanguageSwitcher` com PT/EN/ES e persistência em localStorage e API.
  - Helpers `formatCurrency`/`formatDate` em `web/src/lib/format.js` usando Intl.
  - UI principal sem strings cruas (nav, login, shell, Store layout, WP page) usando `t('…')`.
  - Enviar `Accept-Language` em todas as chamadas via `apiFetch`.
- API (FastAPI):
  - `babel` adicionado; helpers em `api/app/i18n.py` com negociação: `user.locale` → `Accept-Language` → `DEFAULT_LOCALE`.
  - Endpoint `GET/PUT /api/v1/me/preferences` com `{ locale: 'pt_BR'|'en_US'|'es_ES' }`.
  - Migração Alembic (`0012_user_locale`) + campo `users.locale` e modelo atualizado.
  - Renderização de templates com fallback por idioma via `render_template(name, locale, ctx)`.
  - Templates de Policies e Appeals em `api/templates/**.{en|pt|es}.md.j2`.
- DX/Docs:
  - `.env.example` com `DEFAULT_LOCALE` e `SUPPORTED_LOCALES`.
  - `scripts/i18n/extract.js` para extrair chaves e gerar `missing.json` por idioma.
  - Guia curto em `docs/i18n.md`.

## Critérios de Aceite
- [x] Alternância de idioma na UI funciona e persiste entre sessões.
- [x] Preferência salva/retornada em `/api/v1/me/preferences` e impacta renderização de policies.
- [x] `Accept-Language` respeitado quando `user.locale` não estiver definida.
- [x] Templates de Policies/Appeals possuem variações PT/EN/ES com fallback para EN.
- [x] Strings principais migradas para i18n (Login, AppShell, StoreLayout, WP page, Toast headings, botões comuns).
- [x] Helpers de formatação: moeda e data localizadas em EN/PT/ES.
- [x] `.env.example` atualizado e script de extração disponível (`npm run i18n:extract`).

## Implementação/Notas
- Web: `web/src/i18n/index.js`, `web/src/i18n/locales/{en,pt,es}/common.json`, `LanguageSwitcher` e substituições com `useTranslation()`.
- API: `api/app/i18n.py` expõe `inject_user_locale`, `render_template`, `format_*`. WP router usa o locale para escolher título e template.
- Migração: `api/alembic/versions/0012_user_locale.py` adiciona a coluna.
- Segurança: nenhum efeito em RBAC; somente leitura/escrita da preferência do usuário autenticado.
- Acessibilidade: `<html lang>` sincronizado com a linguagem atual (on languageChanged).

## Como testar (dev)
1) `cd web && npm i && npm run dev`
2) No app, altere o idioma no switcher e verifique persistência após refresh.
3) Logado, faça `PUT /api/v1/me/preferences { locale: 'es_ES' }` e verifique policies renderizadas em ES.
4) Remova a preferência do usuário e envie `Accept-Language: pt-BR` para obter conteúdo em PT.
5) Rode `npm run i18n:extract` e veja `missing.json` por idioma.

## Evidências (preencher ao concluir)
- Screenshot do switcher e UI em 3 idiomas.
- Respostas de `/api/v1/me/preferences` (GET/PUT) com round-trip.
- Render de `refund`/`shipping`/`privacy` em PT/EN/ES.
- `missing.json` gerado sem chaves críticas para páginas principais.
