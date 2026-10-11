<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Dialog as BitsDialog } from 'bits-ui';
  import { cn } from '../../lib/cn';

  interface Props {
    class?: string;
    side?: 'top' | 'right' | 'bottom' | 'left';
    children?: Snippet;
  }

  let { class: className, side = 'right', children, ...restProps }: Props = $props();

  const sideVariants = {
    top: 'top-0 left-0 w-full h-auto',
    right: 'right-0 top-0 h-full w-auto',
    bottom: 'bottom-0 left-0 w-full h-auto',
    left: 'left-0 top-0 h-full w-auto',
  };

  const classes = $derived(cn(
    'fixed z-50 flex h-full w-full flex-col gap-2 bg-background p-6 shadow-lg transition-transform duration-300 ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out',
    sideVariants[side],
    className
  ));
</script>

<BitsDialog.Content class={classes} {...restProps}>
  {@render children?.()}
</BitsDialog.Content>