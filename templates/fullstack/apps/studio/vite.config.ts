import { sveltekit } from '@sveltejs/kit/vite';
import adapter from '@sveltejs/adapter-node';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

const apiUrl = process.env.PUBLIC_API_URL ?? 'http://localhost:3001';

/** SvelteKit 3: all config lives in vite.config.ts (svelte.config.js removed). */
export default defineConfig({
  optimizeDeps: { include: ['monaco-editor/editor/editor.main', '@jitl/quickjs-wasmfile-release-sync', 'quickjs-emscripten-core', 'typescript'] },
  plugins: [tailwindcss(), sveltekit({ adapter: adapter() })],
  resolve: {
    alias: {
      $ui: '@mosaic-apps/ui',
      '#lib': fileURLToPath(new URL('./src/lib', import.meta.url)),
    },
  },
  server: {
    fs: { allow: [fileURLToPath(new URL('./', import.meta.resolve('@mosaic-apps/ui')))] },
    port: Number(process.env.PORT ?? 3002),
    proxy: {
      '/api': { target: apiUrl.replace(/\/api$/, ''), changeOrigin: true },
      '/files': { target: apiUrl.replace(/\/api$/, ''), changeOrigin: true },
    },
  },
  preview: {
    port: Number(process.env.PORT ?? 3002),
    proxy: {
      '/api': { target: apiUrl.replace(/\/api$/, ''), changeOrigin: true },
      '/files': { target: apiUrl.replace(/\/api$/, ''), changeOrigin: true },
    },
  },
});
