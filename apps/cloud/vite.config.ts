import { sveltekit } from '@sveltejs/kit/vite';
import { vercelAdapter } from '../../scripts/vercel-adapter.ts';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import { templateFiles } from './src/lib/server/template.ts';

export default defineConfig({
  define: { __MOSAIC_TEMPLATE_FILES__: JSON.stringify({ sveltekit: templateFiles('sveltekit'), nextjs: templateFiles('nextjs') }) },
  plugins: [tailwindcss(), sveltekit({ adapter: vercelAdapter() })],
  resolve: { alias: { '#lib': fileURLToPath(new URL('./src/lib', import.meta.url)) } },
});
