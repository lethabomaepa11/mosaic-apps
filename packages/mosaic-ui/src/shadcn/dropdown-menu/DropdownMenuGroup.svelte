<script lang="ts">
  import type { Snippet } from 'svelte';
  import { DropdownMenu as BitsDropdownMenu } from 'bits-ui';

  interface Props {
    class?: string;
    children?: Snippet;
  }

  let { class: className, children, ...restProps }: Props = $props();
</script>

<BitsDropdownMenu.Group class={className} {...restProps}>
  {@render children?.()}
</BitsDropdownMenu.Group>