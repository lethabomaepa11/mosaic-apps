<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Dialog as BitsDialog } from 'bits-ui';
  import { cn } from '../../lib/cn';

  interface Props {
    class?: string;
    children?: Snippet;

  }

  let { class: className, children, ...restProps }: Props = $props();
</script>

<BitsDialog.Trigger {...restProps}>
  {@render children?.()}
</BitsDialog.Trigger>