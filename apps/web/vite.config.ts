import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

const basePath = (process.env.HANDYIN_BASE_PATH || '/handyin').replace(/\/+$/, '');
const base = `${basePath}/`;

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'HandyIn 作业收取系统',
        short_name: 'HandyIn',
        description: '扫码收取纸质作业与统计',
        start_url: base,
        scope: base,
        display: 'standalone',
        theme_color: '#4f46e5',
        background_color: '#f8fafc',
        icons: [
          {
            src: 'icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
      },
      workbox: {
        navigateFallback: `${base}index.html`,
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/healthz': 'http://localhost:3000',
      [`${basePath}/api`]: 'http://localhost:3000',
      [`${basePath}/ws`]: {
        target: 'ws://localhost:3000',
        ws: true,
      },
    },
  },
});
