import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Installable app (desktop shortcut / iPad home screen) that works offline:
// the service worker precaches the game, fonts, icons and every voice clip.
export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'prompt', // we decide when to switch versions (only on the start screen)
      injectRegister: false,  // registered in src/main.js
      includeAssets: ['icon.png', 'icon-192.png', 'icon-maskable.png', 'apple-touch-icon.png'],
      manifest: {
        id: '/',
        name: 'Pup Patrol – Zosia',
        short_name: 'Pup Patrol',
        description: 'Gra o literach i cyferkach z Zosią i Czejsem.',
        lang: 'pl',
        start_url: '/',
        scope: '/',
        display: 'fullscreen',
        display_override: ['fullscreen', 'standalone'],
        orientation: 'any',
        background_color: '#8fd3ff',
        theme_color: '#1e4fbf',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icon-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff,woff2,webmanifest}', 'voice/*.{mp3,json}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
});
