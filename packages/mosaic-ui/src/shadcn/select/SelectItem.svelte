<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Select as BitsSelect } from 'bits-ui';
  import { cn } from '../../lib/cn';
  import { Check } from '@lucide/svelte';

  interface Props {
    class?: string;
    value: string;
    disabled?: boolean;
    onSelect?: () => void;
    children?: Snippet;
  }

  let { class: className, value, disabled, children, ...restProps }: Props = $props();

  const classes = $derived(cn(
    'relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
    className
  ));
</script>

<BitsSelect.Item class={classes} {value} {disabled} {...restProps}>
  {@render children?.()}
  <span class="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
    <Check class="h-4 w-4" />
  </span>
</BitsSelect.Item>