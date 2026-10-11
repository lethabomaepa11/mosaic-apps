<script lang="ts">
  import type { Snippet } from 'svelte';
  import { ScrollArea as BitsScrollArea } from 'bits-ui';
  import { cn } from '../../lib/cn';

  interface Props {
    class?: string;
    children?: Snippet;
  }

  let { class: className, children, ...restProps }: Props = $props();

  const classes = $derived(cn('', className));
</script>

<BitsScrollArea.Viewport class={classes} {...restProps}>
  {@render children?.()}
</BitsScrollArea.Viewport>