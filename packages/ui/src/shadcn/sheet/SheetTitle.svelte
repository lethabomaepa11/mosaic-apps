<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '../../lib/cn';

  interface Props {
    class?: string;
    children?: Snippet;
  }

  let { class: className, children, ...restProps }: Props = $props();

  const classes = $derived(cn('text-lg font-semibold leading-none tracking-tight', className));
</script>

<h2 class={classes} {...restProps}>
  {@render children?.()}
</h2>