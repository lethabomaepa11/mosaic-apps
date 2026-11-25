<script lang="ts">
  import '../app.css';
  import '#lib/mosaic-components';
  import { Toaster } from '@mosaic-apps/ui';

  // The public shell lives in (app)/+layout.svelte; Studio has its own in studio/+layout.svelte.
  let { children } = $props();
</script>

{@render children()}
<Toaster />
