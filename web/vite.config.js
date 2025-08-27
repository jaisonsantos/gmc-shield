// web/vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Garante que o servidor de desenvolvimento do Vite é acessível
    // a partir do localhost e da rede local.
    host: true, 
    port: 5173,
    
    // Configuração de proxy para redirecionar pedidos /api para o backend
    // Isto é uma alternativa a usar VITE_API_BASE no .env.local
    // e pode ser mais robusto para desenvolvimento.
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})