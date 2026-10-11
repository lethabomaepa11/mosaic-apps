<script lang="ts">
  import type { Snippet } from 'svelte';
  import ShadcnButton from '../shadcn/button/Button.svelte';

  interface FilterChip {
    key: string;
    label: string;
  }

  interface Props {
    children?: Snippet;
    onClear?: () => void;
    activeCount?: number;
  }

  let { children, onClear, activeCount = 0 }: Props = $props();
</script>

<div class="m-filterbar">
  {@render children?.()}
  {#if activeCount > 0}
    <ShadcnButton variant="ghost" size="sm" class="m-btn m-btn--ghost m-btn--sm" onclick={() => onClear?.()}>Clear {activeCount} filter{activeCount > 1 ? 's' : ''}</ShadcnButton>
  {/if}
</div>
