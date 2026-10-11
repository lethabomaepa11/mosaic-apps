<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Select as BitsSelect } from 'bits-ui';
  import { cn } from '../../lib/cn';

  interface Props {
    class?: string;
    inset?: boolean;
    children?: Snippet;
  }

  let { class: className, inset, children, ...restProps }: Props = $props();

  const classes = $derived(cn('px-2 py-1.5 text-sm font-semibold', inset && 'pl-8', className));
</script>

<BitsSelect.GroupHeading class={classes} {...restProps}>
  {@render children?.()}
</BitsSelect.GroupHeading>