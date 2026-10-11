<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    columns?: number | 'auto';
    gap?: 'sm' | 'md' | 'lg';
    direction?: 'row' | 'column';
    children: Snippet;
  }

  let { columns = 2, gap = 'md', direction = 'row', children }: Props = $props();

  const gapPx = $derived(gap === 'sm' ? '8px' : gap === 'lg' ? '24px' : '14px');

  const style = $derived(
    direction === 'column'
      ? `display:flex;flex-direction:column;gap:${gapPx}`
      : columns === 'auto'
        ? `display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:${gapPx}`
        : `display:grid;grid-template-columns:repeat(${columns},minmax(0,1fr));gap:${gapPx}`,
  );
</script>

<div class="m-grid" style={style}>
  {@render children()}
</div>
