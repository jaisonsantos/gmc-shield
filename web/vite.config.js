// web/vite.config.js

import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
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
      // se não setar nada no .env, libera todos (evita o 403 do Vite)
      allowedHosts: allowed.length ? allowed : true,
      // se acessar o Vite via ngrok, o HMR precisa ser wss
      hmr: env.VITE_HMR_HOST ? {
        host: env.VITE_HMR_HOST,
        protocol: 'wss',
        clientPort: 443
      } : undefined
    }
  }
})
