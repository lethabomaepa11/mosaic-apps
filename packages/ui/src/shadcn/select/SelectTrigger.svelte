<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Select as BitsSelect } from 'bits-ui';
  import { cn } from '../../lib/cn';

  interface Props {
    class?: string;
    children?: Snippet;

  }

  let { class: className, children, ...restProps }: Props = $props();
</script>

<BitsSelect.Trigger class={cn('flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1', className)} {...restProps}>
  {@render children?.()}
</BitsSelect.Trigger>