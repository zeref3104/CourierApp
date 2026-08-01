import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
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
    include: ['@courier/constants'],
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