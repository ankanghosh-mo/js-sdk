import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
// The backend. Set VITE_API_TARGET=http://localhost:8096 to use the mock (mock/mock-server.mjs).
const apiTarget = process.env.VITE_API_TARGET || 'http://localhost:8095';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Shared masking + selector-stability modules, used as-is from the SDK.
      '@sdk': path.resolve(here, '../sdk/src'),
    },
  },
  server: {
    port: 5181,
    strictPort: true,
    fs: { allow: [path.resolve(here, '..')] },
    proxy: {
      '/api': { target: apiTarget, changeOrigin: true },
    },
  },
});
