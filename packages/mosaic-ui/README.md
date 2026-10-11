# @mosaic/ui

Source-first Svelte 5 components, renderers, API client, instance-scoped
runtime state, declarative actions, and isolated browser scripting for Mosaic.

```bash
npm install @mosaic/ui @mosaic/core svelte tailwindcss
```

Use a Svelte-aware bundler with Tailwind CSS 4 and its Vite plugin. Import the
package entry from Svelte/TypeScript or `@mosaic/ui/style.css` for design
tokens. Components use Mosaic CSS variables and Bits UI/shadcn-svelte wrappers.

```svelte
<script lang="ts">
  import { createClient, FormRenderer } from '@mosaic/ui';
  const client = createClient({ baseUrl: '/api' });
</script>

<FormRenderer {form} {client} />
```

Custom JavaScript and TypeScript execute in a QuickJS WebAssembly worker and
return validated declarative actions. See the Mosaic documentation for the
sandbox limits, state scope ownership, persistence limits, and nested form
behavior.
