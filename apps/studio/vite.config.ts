import { sveltekit } from '@sveltejs/kit/vite';
import adapter from '@sveltejs/adapter-node';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

const apiUrl = process.env.PUBLIC_API_URL ?? 'http://localhost:8787';

/** SvelteKit 3: all config lives in vite.config.ts (svelte.config.js removed). */
export default defineConfig({
  plugins: [tailwindcss(), sveltekit({ adapter: adapter() })],
  resolve: {
    alias: {
      // consume the UI kit and browser-safe core from the monorepo
      $ui: fileURLToPath(new URL('../../packages/ui/src', import.meta.url)),
      '#lib': fileURLToPath(new URL('./src/lib', import.meta.url)),
      '@mosaic-apps/core': fileURLToPath(new URL('../../packages/core/src/browser.ts', import.meta.url)),
    },
  },
  server: {
    port: Number(process.env.PORT ?? 4173),
    proxy: {
      '/api': { target: apiUrl.replace(/\/api$/, ''), changeOrigin: true },
      '/files': { target: apiUrl.replace(/\/api$/, ''), changeOrigin: true },
    },
  },
  preview: {
    port: Number(process.env.PORT ?? 4173),
    proxy: {
      '/api': { target: apiUrl.replace(/\/api$/, ''), changeOrigin: true },
      '/files': { target: apiUrl.replace(/\/api$/, ''), changeOrigin: true },
    },
  },
});
