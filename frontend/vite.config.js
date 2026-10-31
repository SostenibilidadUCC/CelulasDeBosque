import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // "@/..." apunta a src/ (lo usan los componentes de shadcn en components/ui).
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  // En desarrollo, los pedidos a /api los atiende el servidor Go.
  server: {
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
})
