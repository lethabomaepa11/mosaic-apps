<script lang="ts">
  import type { Snippet } from 'svelte';
  import { ScrollArea as BitsScrollArea } from 'bits-ui';
  import { cn } from '../../lib/cn';

  interface Props {
    class?: string;
    type?: 'always' | 'auto' | 'scroll' | 'hover';
    scrollHideDelay?: number;
    children?: Snippet;
  }

  let { class: className, type = 'auto', scrollHideDelay = 500, children, ...restProps }: Props = $props();

  const classes = $derived(cn('relative', className));
</script>

<BitsScrollArea.Root class={classes} {type} {scrollHideDelay} {...restProps}>
  {@render children?.()}
</BitsScrollArea.Root>