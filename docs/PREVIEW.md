# Preview do Frontend

Ambiente de desenvolvimento roda em `localhost`; para compartilhar externamente use um túnel (ex.: `ngrok`) ou um dos métodos abaixo.

## Opção 1 — GitHub Pages (automático pelo workflow)

1. Faça push do repositório para o GitHub (branch `main` ou `master`).
2. Vá em **Settings → Pages** e deixe como **Source: GitHub Actions**.
3. O workflow **Web Preview (GitHub Pages)** será disparado quando `web/**` mudar.
4. A URL de preview aparecerá no job como **page_url** (ex.: `https://<user>.github.io/<repo>/`).

> O workflow já define `VITE_BASE=/<repo>/` para servir a SPA a partir do subpath certo.

## Opção 2 — Vercel (monorepo, pasta `web/`)

1. Crie um projeto novo em https://vercel.com/import e selecione seu repositório.
2. Em **Root Directory**, escolha `web/`.
3. **Build Command**: `npm run build` • **Output Directory**: `dist`.
4. Em **Environment Variables**, defina `VITE_API` (ex.: `https://api.seu-domínio.com`).
5. Deploy! A URL do preview sai automática (ex.: `https://gmc-shield-web-yourhash.vercel.app`).

Dica: em ambos os casos, se precisar apontar para outra API, defina `VITE_API` no ambiente de deploy.
