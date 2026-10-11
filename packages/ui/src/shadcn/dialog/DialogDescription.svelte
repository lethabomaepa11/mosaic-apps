<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '../../lib/cn';

  interface Props {
    class?: string;
    children?: Snippet;
  }

  let { class: className, children, ...restProps }: Props = $props();

  const classes = $derived(cn('text-sm text-muted-foreground', className));
</script>

<p class={classes} {...restProps}>
  {@render children?.()}
</p>