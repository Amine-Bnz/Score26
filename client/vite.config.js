import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'maskable-icon.svg', 'icon-192.png', 'icon-512.png', 'maskable-icon-512.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'Score26',
        short_name: 'Score26',
        description: 'Pronostics personnels pour la Coupe du Monde 2026',
        theme_color: '#111827',
        background_color: '#111827',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'maskable-icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: 'icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
          },
        ],
      },
      // Service worker : met en cache tous les assets au build
      // + importe le gestionnaire push (push-sw.js servi depuis /public)
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg}'],
        importScripts: ['/push-sw.js'],
        // Les appels API ne doivent jamais être mis en cache par le service worker
        // NetworkOnly = le SW laisse passer la requête sans interception
        // En mode offline, la requête échoue proprement (network error)
        runtimeCaching: [
          {
            // Fonctionne en dev (URL relatives) et en prod (URL absolues vers Fly.io)
          urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})
