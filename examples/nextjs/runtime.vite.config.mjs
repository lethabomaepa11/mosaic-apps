import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/_mosaic-runtime/',
  publicDir: false,
  plugins: [tailwindcss(), svelte()],
  build: {
    outDir: 'public/_mosaic-runtime',
    emptyOutDir: true,
    cssCodeSplit: false,
    rollupOptions: {
      input: 'runtime/entry.js',
      output: {
        entryFileNames: 'artifact.js',
        assetFileNames: (asset) => asset.names.some((name) => name.endsWith('.css')) ? 'artifact.css' : '[name]-[hash][extname]',
      },
    },
  },
});
