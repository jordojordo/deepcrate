import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server:  {
    fs: {
      // Allow serving files from monorepo root node_modules (for primeicons, etc.)
      allow: ['..'],
    },
    proxy: {
      '/health': {
        target:       'http://localhost:8080',
        changeOrigin: true,
      },
      '/api': {
        target:       'http://localhost:8080',
        changeOrigin: true,
      },
      '/socket.io': {
        target:       'http://localhost:8080',
        ws:           true,
        changeOrigin: true,
      },
    },
  },
});
