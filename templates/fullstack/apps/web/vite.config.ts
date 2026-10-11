import { sveltekit } from '@sveltejs/kit/vite';
import adapter from '@sveltejs/adapter-node';
import netlifyAdapter from '@sveltejs/adapter-netlify';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

/** SvelteKit 3: all config lives in vite.config.ts (svelte.config.js removed). */
export default defineConfig({
  envPrefix: ['VITE_', 'PUBLIC_'],
  plugins: [tailwindcss(), sveltekit({ adapter: process.env.MOSAIC_DEPLOY_TARGET === 'netlify' ? netlifyAdapter() : adapter() })],
  resolve: { alias: { '#lib': fileURLToPath(new URL('./src/lib', import.meta.url)) } },
  server: {
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
