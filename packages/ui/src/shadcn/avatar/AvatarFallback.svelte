<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Avatar as BitsAvatar } from 'bits-ui';
  import { cn } from '../../lib/cn';

  interface Props {
    class?: string;
    children?: Snippet;
  }

  let { class: className, children, ...restProps }: Props = $props();

  const classes = $derived(cn(
    'flex h-full w-full items-center justify-center rounded-full bg-muted',
    className
  ));
</script>

<BitsAvatar.Fallback class={classes} {...restProps}>
  {@render children?.()}
</BitsAvatar.Fallback>
