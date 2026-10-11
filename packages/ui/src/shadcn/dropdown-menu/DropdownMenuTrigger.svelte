<script lang="ts">
  import type { Snippet } from 'svelte';
  import { DropdownMenu as BitsDropdownMenu } from 'bits-ui';
  import { cn } from '../../lib/cn';

  interface Props {
    class?: string;
    children?: Snippet;

  }

  let { class: className, children, ...restProps }: Props = $props();
</script>

<BitsDropdownMenu.Trigger {...restProps}>
  {@render children?.()}
</BitsDropdownMenu.Trigger>