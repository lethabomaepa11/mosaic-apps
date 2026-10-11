<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '../../lib/cn';

  interface Props {
    class?: string;
    htmlFor?: string;
    required?: boolean;
    children?: Snippet;
  }

  let { class: className, htmlFor, required, children, ...restProps }: Props = $props();

  const classes = $derived(cn(
    'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
    className
  ));
</script>

<label class={classes} for={htmlFor} {...restProps}>
  {@render children?.()}
  {#if required}<span class="text-destructive ml-1">*</span>{/if}
</label>