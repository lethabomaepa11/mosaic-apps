<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '../../lib/cn';

  interface Props {
    class?: string;
    children?: Snippet;
  }

  let { class: className, children, ...restProps }: Props = $props();

  const classes = $derived(cn(
    'rounded-lg border bg-card text-card-foreground shadow-sm',
    className
  ));
</script>

<div class={classes} {...restProps}>
  {@render children?.()}
</div>