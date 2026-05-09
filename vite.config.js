import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'GarageData',
        short_name: 'GarageData',
        description: 'Professional Garage Management',
        theme_color: '#111827', /* Dark gray to match your top bar */
        background_color: '#ffffff',
        display: 'standalone', /* This hides the browser address bar! */
        icons: [
          {
            src: '/applogo.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/applogo.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ]
})