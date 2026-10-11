<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Select as BitsSelect } from 'bits-ui';

  interface Props {
    value?: string;
    onValueChange?: (value: string) => void;
    disabled?: boolean;
    required?: boolean;
    name?: string;
    children?: Snippet;
  }

  let { value = $bindable(), onValueChange, children, ...restProps }: Props = $props();
</script>

<BitsSelect.Root type="single" bind:value {onValueChange} {...restProps}>
  {@render children?.()}
</BitsSelect.Root>
