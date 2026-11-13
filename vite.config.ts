import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'images/*.png', 'logos/*.png'],
      manifest: {
        name: 'ZIMRAH 2026 – Song of Praise',
        short_name: 'ZIMRAH 2026',
        description: 'CSI Madhya Kerala Diocese Adoor Clergy District Youth Movement - Kalolsavam Results & Championship System',
        theme_color: '#064e3b',
        background_color: '#064e3b',
        display: 'standalone',
        orientation: 'portrait-primary',
        icons: [
          {
            src: '/images/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: '/images/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/portal/, /^\/admin/, /^\/api/, /^\/auth/],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        runtimeCaching: [
          {
            // Static images, logos, and fonts: Cache First
            urlPattern: ({ request }) =>
              request.destination === 'image' ||
              request.destination === 'font' ||
              request.destination === 'style',
            handler: 'CacheFirst',
            options: {
              cacheName: 'zimrah-static-assets-v1',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // Public live scorecards, event listings and leaderboard feeds: Network First
            // Guardrail: Strictly exclude admin, auth, user profiles, or audit logs
            urlPattern: ({ url, request }) => {
              if (request.method !== 'GET') return false;
              const path = url.pathname;
              if (
                path.includes('/portal') ||
                path.includes('/admin') ||
                path.includes('/auth') ||
                path.includes('audit_logs') ||
                path.includes('profiles')
              ) {
                return false;
              }
              return (
                path.startsWith('/results') ||
                path.startsWith('/championship') ||
                path.startsWith('/events')
              );
            },
            handler: 'NetworkFirst',
            options: {
              cacheName: 'zimrah-public-content-v1',
              networkTimeoutSeconds: 3,
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 60 * 60 * 24, // 24 hours fallback
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
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
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          query: ['@tanstack/react-query'],
          supabase: ['@supabase/supabase-js'],
          icons: ['lucide-react'],
        },
      },
    },
  },
  server: {
    port: 3000,
    open: true,
  },
});
