<script lang="ts">
  import type { Snippet } from 'svelte';
  import { DropdownMenu as BitsDropdownMenu } from 'bits-ui';

  interface Props {
    class?: string;
    value?: string;
    onValueChange?: (value: string) => void;
    children?: Snippet;
  }

  let { class: className, children, ...restProps }: Props = $props();
</script>

<BitsDropdownMenu.RadioGroup class={className} {...restProps}>
  {@render children?.()}
</BitsDropdownMenu.RadioGroup>