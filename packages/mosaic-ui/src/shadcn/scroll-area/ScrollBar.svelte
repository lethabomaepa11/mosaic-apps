<script lang="ts">
  import type { Snippet } from 'svelte';
  import { ScrollArea as BitsScrollArea } from 'bits-ui';
  import { cn } from '../../lib/cn';

  interface Props {
    class?: string;
    orientation?: 'horizontal' | 'vertical';
    children?: Snippet;
  }

  let { class: className, orientation = 'vertical', children, ...restProps }: Props = $props();

  const classes = $derived(cn(
    'flex touch-none select-none transition-colors',
    orientation === 'vertical' && 'h-full w-2.5 border-l border-l-transparent p-[1px]',
    orientation === 'horizontal' && 'h-2.5 flex-col border-t border-t-transparent p-[1px]',
    className
  ));
</script>

<BitsScrollArea.Scrollbar class={classes} {orientation} {...restProps}>
  {@render children?.()}
</BitsScrollArea.Scrollbar>