<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Select as BitsSelect } from 'bits-ui';
  import { cn } from '../../lib/cn';

  interface Props {
    class?: string;
    children?: Snippet;
  }

  let { class: className, children, ...restProps }: Props = $props();

  const classes = $derived(cn('p-1', className));
</script>

<BitsSelect.Viewport class={classes} {...restProps}>
  {@render children?.()}
</BitsSelect.Viewport>