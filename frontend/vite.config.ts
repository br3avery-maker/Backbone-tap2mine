import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Relative base for IPFS compatibility
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // Don't inline the wasm — keep it as a separate file
    assetsInlineLimit: 0,
  },
  server: {
    port: 3000,
  },
  // Serve wasm from public/ during dev
  publicDir: 'public',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        // Cache everything including wasm
        globPatterns: ['**/*.{js,css,html,wasm,json,ico,png,svg}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB for wasm
      },
      manifest: {
        name: 'Tap2Mine',
        short_name: 'Tap2Mine',
        description: 'Decentralized blocklattice node — tap to mine',
        theme_color: '#0a0a0f',
        background_color: '#0a0a0f',
        display: 'standalone',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
    }),
  ],
});
