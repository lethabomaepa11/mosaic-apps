<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Select as BitsSelect } from 'bits-ui';

  interface Props {
    class?: string;
    children?: Snippet;
  }

  let { class: className, children, ...restProps }: Props = $props();
</script>

<BitsSelect.Group class={className} {...restProps}>
  {@render children?.()}
</BitsSelect.Group>