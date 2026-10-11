<script lang="ts">
  import type { Snippet } from 'svelte';
  import { DropdownMenu as BitsDropdownMenu } from 'bits-ui';

  interface Props {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    children?: Snippet;
  }

  let { children, ...restProps }: Props = $props();
</script>

<BitsDropdownMenu.Sub {...restProps}>
  {@render children?.()}
</BitsDropdownMenu.Sub>
