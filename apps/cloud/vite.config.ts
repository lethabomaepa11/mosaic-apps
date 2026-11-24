import { sveltekit } from '@sveltejs/kit/vite';
import { vercelAdapter } from '../../scripts/vercel-adapter.ts';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [tailwindcss(), sveltekit({ adapter: vercelAdapter() })],
  resolve: { alias: { '#lib': fileURLToPath(new URL('./src/lib', import.meta.url)) } },
});
