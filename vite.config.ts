import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The web assets are bundled into the HarmonyOS app via `cap sync harmony`,
// which copies the `www/` output dir into `harmony/rawfile/`.
//
// `npm start` runs a browser-based dev server (HMR) so you can preview and
// develop the frontend without building a .app each time. The embedded Node
// backend (node/main.js) listens on :3000; API calls under /api are proxied
// to it during dev.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'www',
    emptyOutDir: true,
  },
  server: {
    host: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
    },
  },
});
