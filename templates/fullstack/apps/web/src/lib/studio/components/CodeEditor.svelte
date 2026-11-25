<script lang="ts">
  import { CodeEditor } from '@mosaic-apps/ui';
  import type { ComponentProps } from 'svelte';
  let props: ComponentProps<typeof CodeEditor> = $props();
</script>

<CodeEditor {...props} />
