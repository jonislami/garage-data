import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/favicon-32.png', 'icons/favicon-48.png', 'icons/apple-touch-icon.png'],
      // The one app description (web manifest) used when installing GarageData
      manifest: {
        id: '/',
        name: 'GarageData',
        short_name: 'GarageData',
        description: 'Punët, faturat, stoku dhe historia e servisit për ofiçinën tuaj.',
        lang: 'sq',
        start_url: '/',
        scope: '/',
        display: 'standalone', // opens in its own window, without the browser bar
        theme_color: '#111827',
        background_color: '#ffffff',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    })
  ]
})
