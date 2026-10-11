<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    left?: Snippet;
    right?: Snippet;
  }

  let { left, right }: Props = $props();
</script>

<div class="m-toolbar">
  <div class="m-row">{@render left?.()}</div>
  <div class="m-row">{@render right?.()}</div>
</div>
