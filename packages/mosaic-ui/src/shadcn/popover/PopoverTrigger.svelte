<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Popover as BitsPopover } from 'bits-ui';
  import { cn } from '../../lib/cn';

  interface Props {
    class?: string;
    children?: Snippet;

  }

  let { class: className, children, ...restProps }: Props = $props();
</script>

<BitsPopover.Trigger {...restProps}>
  {@render children?.()}
</BitsPopover.Trigger>