<script lang="ts">
  import type { Snippet } from 'svelte';
  import { DropdownMenu as BitsDropdownMenu } from 'bits-ui';
  import { cn } from '../../lib/cn';
  import { Circle } from '@lucide/svelte';

  interface Props {
    class?: string;
    value: string;
    disabled?: boolean;
    inset?: boolean;
    children?: Snippet;
  }

  let { class: className, value, disabled, inset, children, ...restProps }: Props = $props();

  const classes = $derived(cn(
    'relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
    inset && 'pl-8',
    className
  ));
</script>

<BitsDropdownMenu.RadioItem class={classes} {value} {disabled} {...restProps}>
  {@render children?.()}
  <span class="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
    <Circle class="h-3.5 w-3.5 fill-current" />
  </span>
</BitsDropdownMenu.RadioItem>