import { sveltekit } from '@sveltejs/kit/vite';
import adapter from '@sveltejs/adapter-node';
import netlifyAdapter from '@sveltejs/adapter-netlify';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

/** SvelteKit 3: all config lives in vite.config.ts (svelte.config.js removed). */
export default defineConfig({
  optimizeDeps: { include: ['monaco-editor/editor/editor.main', '@jitl/quickjs-wasmfile-release-sync', 'quickjs-emscripten-core', 'typescript'] },
  envPrefix: ['VITE_', 'PUBLIC_'],
  preview: { host: '127.0.0.1', port: __WEB_PORT__ },
  plugins: [tailwindcss(), sveltekit({ adapter: process.env.MOSAIC_DEPLOY_TARGET === 'netlify' ? netlifyAdapter() : adapter() })],
  resolve: { alias: { '#lib': fileURLToPath(new URL('./src/lib', import.meta.url)) } },
  server: {
    host: '127.0.0.1',
    fs: { allow: [fileURLToPath(new URL('./', import.meta.resolve('@mosaic-apps/ui')))] },
    port: __WEB_PORT__,
    proxy: {
      // proxy API calls to the Hono server during development
      '/api': {
        target: 'http://localhost:__API_PORT__',
        changeOrigin: true,
      },
      '/files': {
        target: 'http://localhost:__API_PORT__',
        changeOrigin: true,
      },
    },
  },
});
