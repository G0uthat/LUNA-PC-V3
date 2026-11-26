import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  // `vite build --mode electron` => build para el .exe (rutas relativas, sin PWA)
  const isElectron = mode === 'electron' || process.env.ELECTRON_BUILD === 'true';
  // Ruta base web. En GitHub Pages el workflow define VITE_BASE_PATH=/NOMBRE-DEL-REPO/
  // (respeta mayúsculas). En local queda '/'.
  const rawBase = process.env.VITE_BASE_PATH?.trim() || '/';
  const withLead = rawBase.startsWith('/') ? rawBase : `/${rawBase}`;
  const webBase = withLead.endsWith('/') ? withLead : `${withLead}/`;
  return {
  base: isElectron ? './' : webBase,
  resolve: isElectron
    ? {
        alias: {
          'virtual:pwa-register': fileURLToPath(
            new URL('./src/stubs/pwa-register.ts', import.meta.url)
          ),
        },
      }
    : undefined,
  plugins: [
    react(),
    tailwindcss(),
    ...(!isElectron
      ? [
          VitePWA({
            registerType: 'autoUpdate',
            includeAssets: [
              'icon.svg',
              'apple-touch-icon.png',
              'pwa-192x192.png',
              'pwa-512x512.png',
              'pwa-maskable-512x512.png',
            ],
            manifest: {
              id: webBase,
              name: 'Luma — Cuadernos y Lectura',
              short_name: 'Luma',
              description:
                'Biblioteca visual multiformato, lector inmersivo, cuadernos híbridos y sincronización directa con tu propio Google Drive.',
              theme_color: '#0F1E3A',
              background_color: '#F7F3EA',
              display: 'standalone',
              orientation: 'any',
              scope: webBase,
              start_url: webBase,
              lang: 'es',
              categories: ['productivity', 'education', 'books'],
              icons: [
                {
                  src: 'pwa-192x192.png',
                  sizes: '192x192',
                  type: 'image/png',
                },
                {
                  src: 'pwa-512x512.png',
                  sizes: '512x512',
                  type: 'image/png',
                },
                {
                  src: 'pwa-maskable-512x512.png',
                  sizes: '512x512',
                  type: 'image/png',
                  purpose: 'maskable',
                },
              ],
            },
            workbox: {
              maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
              globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
              runtimeCaching: [
                {
                  urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
                  handler: 'CacheFirst',
                  options: {
                    cacheName: 'luma-google-fonts-css',
                    expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
                  },
                },
                {
                  urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
                  handler: 'CacheFirst',
                  options: {
                    cacheName: 'luma-google-fonts-files',
                    expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 365 },
                  },
                },
              ],
            },
            devOptions: {
              enabled: true,
              type: 'module',
            },
          }),
        ]
      : []),
  ],
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    hmr: false,
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    allowedHosts: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
  },
};
});
