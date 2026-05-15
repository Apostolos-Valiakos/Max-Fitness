import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'icons/*.png'],
      manifest: {
        name:             'max-fitnes',
        short_name:       'max-fitnes',
        description:      'Offline-first workout tracker',
        theme_color:      '#0A0A0A',
        background_color: '#0A0A0A',
        display:          'standalone',
        orientation:      'portrait',
        start_url:        '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts-cache', expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
  server: {
    port:       5173,
    host:       '0.0.0.0',
    strictPort: true,
  },
  build: {
    outDir:    'dist',
    sourcemap: true,
  },
})
