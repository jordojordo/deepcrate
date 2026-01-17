import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  server:  {
    fs: {
      // Allow serving files from monorepo root node_modules (for primeicons, etc.)
      allow: ['..'],
    },
    proxy: {
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
