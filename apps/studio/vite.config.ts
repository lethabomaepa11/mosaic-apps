import { sveltekit } from '@sveltejs/kit/vite';
import adapter from '@sveltejs/adapter-node';
import netlifyAdapter from '@sveltejs/adapter-netlify';
import vercelAdapter from '@sveltejs/adapter-vercel';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

const apiUrl = process.env.MOSAIC_API_TARGET || process.env.PUBLIC_API_URL || 'http://localhost:3001';

/** SvelteKit 3: all config lives in vite.config.ts (svelte.config.js removed). */
export default defineConfig({
  optimizeDeps: { include: ['monaco-editor/editor/editor.main', '@jitl/quickjs-wasmfile-release-sync', 'quickjs-emscripten-core', 'typescript'] },
  envPrefix: ['VITE_', 'PUBLIC_'],
  plugins: [tailwindcss(), sveltekit({
    adapter: process.env.MOSAIC_DEPLOY_TARGET === 'netlify' ? netlifyAdapter() : process.env.MOSAIC_DEPLOY_TARGET === 'vercel' ? vercelAdapter() : adapter(),
    ...(process.env.MOSAIC_APP_ORIGIN ? { paths: { origin: process.env.MOSAIC_APP_ORIGIN } } : {}),
  })],
  resolve: {
    alias: {
      // consume the UI kit and browser-safe core from the monorepo
      $ui: fileURLToPath(new URL('../../packages/ui/src', import.meta.url)),
      '#lib': fileURLToPath(new URL('./src/lib', import.meta.url)),
      '@mosaic-apps/core': fileURLToPath(new URL('../../packages/core/src/browser.ts', import.meta.url)),
    },
  },
  server: {
    fs: { allow: [fileURLToPath(new URL('../../packages/core/src', import.meta.url)), fileURLToPath(new URL('../../packages/ui/src', import.meta.url))] },
    port: Number(process.env.PORT ?? 3000),
    proxy: {
      '/api': { target: apiUrl.replace(/\/api$/, ''), changeOrigin: true },
      '/files': { target: apiUrl.replace(/\/api$/, ''), changeOrigin: true },
    },
  },
  preview: {
    port: Number(process.env.PORT ?? 3000),
    proxy: {
      '/api': { target: apiUrl.replace(/\/api$/, ''), changeOrigin: true },
      '/files': { target: apiUrl.replace(/\/api$/, ''), changeOrigin: true },
    },
  },
});
