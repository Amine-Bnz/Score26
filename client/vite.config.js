import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // Proxy vers le backend pour éviter les problèmes CORS en dev
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})
