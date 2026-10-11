import { sveltekit } from '@sveltejs/kit/vite';
import adapter from '@sveltejs/adapter-node';
import netlifyAdapter from '@sveltejs/adapter-netlify';
import vercelAdapter from '@sveltejs/adapter-vercel';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

/** SvelteKit 3: all config lives in vite.config.ts (svelte.config.js removed). */
export default defineConfig({
  // Keep Svelte/TypeScript source and ?worker imports in the application pipeline.
  optimizeDeps: { exclude: ['@mosaic-apps/ui'], include: ['monaco-editor/editor/editor.main', '@jitl/quickjs-wasmfile-release-sync', 'quickjs-emscripten-core', 'typescript'] },
  envPrefix: ['VITE_', 'PUBLIC_'],
  preview: { host: '127.0.0.1', port: Number(process.env.MOSAIC_WEB_PORT ?? __WEB_PORT__) },
  plugins: [tailwindcss(), sveltekit({
    adapter: process.env.MOSAIC_DEPLOY_TARGET === 'netlify' ? netlifyAdapter() : process.env.MOSAIC_DEPLOY_TARGET === 'vercel' ? vercelAdapter() : adapter(),
    paths: { origin: process.env.MOSAIC_APP_ORIGIN },
  })],
  resolve: { alias: { '#lib': fileURLToPath(new URL('./src/lib', import.meta.url)) } },
  server: {
    host: '127.0.0.1',
    fs: { allow: [fileURLToPath(new URL('./', import.meta.resolve('@mosaic-apps/ui')))] },
    port: Number(process.env.MOSAIC_WEB_PORT ?? __WEB_PORT__),
    proxy: {
      // proxy API calls to the Hono server during development
      '/api': {
        target: process.env.MOSAIC_API_TARGET ?? 'http://127.0.0.1:__API_PORT__',
        changeOrigin: true,
      },
      '/files': {
        target: process.env.MOSAIC_API_TARGET ?? 'http://127.0.0.1:__API_PORT__',
        changeOrigin: true,
      },
    },
  },
});
