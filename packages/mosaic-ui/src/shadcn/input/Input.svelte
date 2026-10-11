<script lang="ts">
  import { cn } from '../../lib/cn';
  import type { HTMLInputAttributes } from 'svelte/elements';

  interface Props extends HTMLInputAttributes {
    class?: string;
    ariaLabel?: string;
    ariaDescribedBy?: string;
  }

  let { class: className, type = 'text', ariaLabel, ariaDescribedBy, ...restProps }: Props = $props();

  const classes = $derived(cn(
    'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
    className
  ));
</script>

<input class={classes} {type} aria-label={ariaLabel} aria-describedby={ariaDescribedBy} {...restProps} />
