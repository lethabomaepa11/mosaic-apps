import { sveltekit } from '@sveltejs/kit/vite';
import adapter from '@sveltejs/adapter-node';
import netlifyAdapter from '@sveltejs/adapter-netlify';
import vercelAdapter from '@sveltejs/adapter-vercel';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

const apiUrl = process.env.MOSAIC_API_TARGET || process.env.PUBLIC_API_URL || 'http://127.0.0.1:__API_PORT__';

/** SvelteKit 3: all config lives in vite.config.ts (svelte.config.js removed). */
export default defineConfig({
  // The UI ships Svelte/TypeScript source and Vite worker imports. Transform it
  // through the application pipeline, rather than the dependency prebundler.
  optimizeDeps: { exclude: ['@mosaic-apps/ui'], include: ['monaco-editor/editor/editor.main', '@jitl/quickjs-wasmfile-release-sync', 'quickjs-emscripten-core', 'typescript'] },
  envPrefix: ['VITE_', 'PUBLIC_'],
  plugins: [tailwindcss(), sveltekit({
    adapter: process.env.MOSAIC_DEPLOY_TARGET === 'netlify' ? netlifyAdapter() : process.env.MOSAIC_DEPLOY_TARGET === 'vercel' ? vercelAdapter() : adapter(),
    paths: { origin: process.env.MOSAIC_APP_ORIGIN },
  })],
  resolve: {
    alias: {
      $ui: '@mosaic-apps/ui',
      '#lib': fileURLToPath(new URL('./src/lib', import.meta.url)),
    },
  },
  server: {
    host: '127.0.0.1',
    fs: { allow: [fileURLToPath(new URL('./', import.meta.resolve('@mosaic-apps/ui')))] },
    port: Number(process.env.MOSAIC_STUDIO_PORT ?? __STUDIO_PORT__),
    proxy: {
      '/api': { target: apiUrl.replace(/\/api$/, ''), changeOrigin: true },
      '/files': { target: apiUrl.replace(/\/api$/, ''), changeOrigin: true },
    },
  },
  preview: {
    host: '127.0.0.1',
    port: Number(process.env.MOSAIC_STUDIO_PORT ?? __STUDIO_PORT__),
    proxy: {
      '/api': { target: apiUrl.replace(/\/api$/, ''), changeOrigin: true },
      '/files': { target: apiUrl.replace(/\/api$/, ''), changeOrigin: true },
    },
  },
});
