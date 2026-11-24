# @mosaic-apps/ui

Source-first Svelte 5 components, renderers, API client, instance-scoped
runtime state, declarative actions, and isolated browser scripting for Mosaic.

```bash
npm install @mosaic-apps/ui @mosaic-apps/core svelte tailwindcss
```

Use a Svelte-aware bundler with Tailwind CSS 4 and its Vite plugin. Import the
package entry from Svelte/TypeScript or `@mosaic-apps/ui/style.css` for design
tokens. Components use Mosaic CSS variables and Bits UI/shadcn-svelte wrappers.

```svelte
<script lang="ts">
  import { createClient, FormRenderer } from '@mosaic-apps/ui';
  const client = createClient({ baseUrl: '/api' });
</script>

<FormRenderer {form} {client} />
```

Package-backed Svelte components can join the runtime, Studio palette, and
generated inspector through `registerComponent`:

```ts
import Widget from '@acme/widgets/Widget.svelte';
import { registerComponent } from '@mosaic-apps/ui';

registerComponent({
  type: 'acme.widget', label: 'Widget', category: 'Display', icon: 'box',
  component: Widget, pages: true,
  inspector: [{ key: 'title', label: 'Title', kind: 'string' }],
});
```

Register the same stable type in the application and Studio entry points.

Custom JavaScript and TypeScript execute in a QuickJS WebAssembly worker and
return validated declarative actions. See the Mosaic documentation for the
sandbox limits, state scope ownership, persistence limits, and nested form
behavior.
