<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '../../lib/cn';

  interface Props {
    class?: string;
    children?: Snippet;
  }

  let { class: className, children, ...restProps }: Props = $props();

  const classes = $derived(cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2', className));
</script>

<div class={classes} {...restProps}>
  {@render children?.()}
</div>