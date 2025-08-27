// web/vite.config.js
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

export default defineConfig(({ mode }) => {
  // garante que o loadEnv leia .env.* dentro de /web
  const root = fileURLToPath(new URL('.', import.meta.url))
  const env = loadEnv(mode, root, '')

  const allowed = (env.VITE_ALLOWED_HOSTS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)

  return {
    base: env.VITE_BASE || '/',
    plugins: [react()],
    server: {
      host: true,
      port: 5173,
      // se não setar nada no .env, libera todos (evita 403 do Vite)
      allowedHosts: allowed.length ? allowed : true,
      // HMR via túnel HTTPS (ex.: ngrok) → usar wss
      hmr: env.VITE_HMR_HOST
        ? { host: env.VITE_HMR_HOST, protocol: 'wss', clientPort: 443 }
        : undefined,
    },
  }
})
