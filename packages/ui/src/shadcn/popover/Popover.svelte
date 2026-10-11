<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Popover as BitsPopover } from 'bits-ui';

  interface Props {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    children?: Snippet;
  }

  let { open = $bindable(false), onOpenChange, children }: Props = $props();
</script>

<BitsPopover.Root bind:open {onOpenChange}>
  {@render children?.()}
</BitsPopover.Root>
