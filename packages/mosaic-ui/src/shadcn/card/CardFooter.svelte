<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '../../lib/cn';

  interface Props {
    class?: string;
    children?: Snippet;
  }

  let { class: className, children, ...restProps }: Props = $props();

  const classes = $derived(cn('flex items-center p-6 pt-0', className));
</script>

<div class={classes} {...restProps}>
  {@render children?.()}
</div>