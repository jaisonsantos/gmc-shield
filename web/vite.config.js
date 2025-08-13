import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
  server: { port: 5173, host: true },
  define: { __API__: JSON.stringify(process.env.VITE_API || 'http://localhost:8000') }
})
