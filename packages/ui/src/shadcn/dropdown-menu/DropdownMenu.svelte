<script lang="ts">
  import type { Snippet } from 'svelte';
  import { DropdownMenu as BitsDropdownMenu } from 'bits-ui';

  interface Props {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    children?: Snippet;
  }

  let { open = $bindable(false), onOpenChange, children }: Props = $props();
</script>

<BitsDropdownMenu.Root bind:open {onOpenChange}>
  {@render children?.()}
</BitsDropdownMenu.Root>
