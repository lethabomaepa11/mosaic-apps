<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '../../lib/cn';

  interface Props {
    class?: string;
    children?: Snippet;
  }

  let { class: className, children }: Props = $props();
</script>

<span class={cn('ml-auto text-xs tracking-widest opacity-60', className)}>
  {@render children?.()}
</span>
