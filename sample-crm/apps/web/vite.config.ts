import { sveltekit } from '@sveltejs/kit/vite';
import adapter from '@sveltejs/adapter-node';
import { defineConfig } from 'vite';

/** SvelteKit 3: all config lives in vite.config.ts (svelte.config.js removed). */
export default defineConfig({
  plugins: [sveltekit({ adapter: adapter() })],
  server: {
    port: 5621,
    proxy: {
      // proxy API calls to the Hono server during development
      '/api': {
        target: 'http://localhost:8911',
        changeOrigin: true,
      },
      '/files': {
        target: 'http://localhost:8911',
        changeOrigin: true,
      },
    },
  },
});
