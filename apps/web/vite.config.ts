import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // 'prompt': the SW never takes over a live session automatically.
      // The app can hold live data (socket.io, dashboards), so an update is
      // surfaced to the user and applied on explicit reload instead.
      registerType: 'prompt',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Courier Manager',
        short_name: 'Courier',
        description: 'Courier SaaS Platform - multi-tenant shipping management',
        lang: 'es',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        theme_color: '#16a34a',
        background_color: '#ffffff',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icon-192-maskable.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: '/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // SPA: unknown navigations fall back to the precached index.html.
        navigateFallback: '/index.html',
        // socket.io long-polls and websockets must never be precached.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        globIgnores: ['**/socket.io*'],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // API calls: network-first so live data always wins; the cache is
            // only a fallback for offline/flaky connections.
            urlPattern: ({ url }) => url.pathname.startsWith('/api'),
            handler: 'NetworkFirst',
            options: {
              // Explicit name: must match API_CACHE_NAME in
              // src/utils/apiCache.ts, which purges this cache on logout
              // (Workbox keys entries by URL only and never varies on the
              // Authorization header, so stale user data must not survive).
              cacheName: 'api-cache',
              networkTimeoutSeconds: 10,
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 },
              // 200 only: status 0 (opaque) responses are not valid API data.
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            // Google Fonts static files (fonts.gstatic.com): cache-first,
            // they are content-hashed and effectively immutable.
            urlPattern: ({ url }) => url.hostname === 'fonts.gstatic.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Same-origin images: cache-first with a size/age cap.
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    // Dev-server counterpart of build.commonjsOptions below: the @courier/*
    // workspace packages are CommonJS but resolve outside node_modules, so
    // Vite serves them raw (no CJS->ESM conversion) unless pre-bundled.
    // Without this, named imports like STATUS_TRANSITIONS fail at runtime:
    // "does not provide an export named '...'".
    include: ['@courier/constants', '@courier/helpers'],
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:3000',
        ws: true,
      },
    },
  },
  build: {
    commonjsOptions: {
      // The @courier/* workspace packages are CommonJS (module.exports) but
      // resolve to their real path under packages/*, which falls outside the
      // default /node_modules/ include pattern. Without this, rollup treats
      // them as ESM and named imports (e.g. formatCurrency) fail to bundle.
      include: [/node_modules/, /packages\/(helpers|constants|validation)\//],
    },
  },
});