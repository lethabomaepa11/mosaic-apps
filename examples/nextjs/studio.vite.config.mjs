import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

// Cloud releases carry the same Studio sources as the SvelteKit scaffold.
const sources = existsSync('studio-source/routes/studio')
  ? 'studio-source'
  : '../../templates/fullstack/apps/web/src';
const src = '.studio-build/src';
mkdirSync(`${src}/routes`, { recursive: true });
mkdirSync(`${src}/lib`, { recursive: true });
for (const path of ['routes/studio', 'lib/studio', 'lib/client.ts', 'app.css']) {
  cpSync(`${sources}/${path}`, `${src}/${path}`, { recursive: true });
}
writeFileSync(`${src}/routes/+layout.js`, 'export const ssr = false;\n');
writeFileSync(`${src}/routes/+layout.svelte`, `<script>
  import '@mosaic-apps/ui/style.css';
  import '../app.css';
  import { Toaster } from '@mosaic-apps/ui';
  let { children } = $props();
</script>
{@render children()}
<Toaster />
`);
writeFileSync(`${src}/app.html`, `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">%sveltekit.head%</head>
<body><div style="display:contents">%sveltekit.body%</div></body>
</html>`);

export default defineConfig({
  resolve: { alias: { '#lib': resolve(src, 'lib') } },
  plugins: [tailwindcss(), sveltekit({
    appDir: '_mosaic-studio',
    outDir: '.studio-build/kit',
    files: { src },
    adapter: {
      name: 'mosaic-next-studio',
      async adapt(builder) {
        builder.rimraf('public/_mosaic-studio');
        builder.writeClient('public');
        await builder.generateFallback('.studio-build/index.html');
        writeFileSync('.studio-build/entry.mjs', `export default ${JSON.stringify(readFileSync('.studio-build/index.html', 'utf8'))};\n`);
      },
    },
  })],
});
