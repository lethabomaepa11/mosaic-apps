<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Dialog as BitsDialog } from 'bits-ui';

  interface Props {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    children?: Snippet;
  }

  let { open = $bindable(false), onOpenChange, children }: Props = $props();
</script>

<BitsDialog.Root bind:open {onOpenChange}>
  {@render children?.()}
</BitsDialog.Root>
