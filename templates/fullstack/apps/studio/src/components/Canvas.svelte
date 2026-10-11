<script lang="ts">
  import CanvasNode from './CanvasNode.svelte';
  import { designer } from '#lib/designer.svelte';

  function clearCanvasSelection(event: MouseEvent) {
    const target = event.target;
    if (target instanceof Element && target.closest('.design-canvas') && !target.closest('.design-node')) designer.select(null);
  }
</script>

<svelte:window onclick={clearCanvasSelection} onkeydown={(e) => { if (e.key === 'Escape' && !(e.target instanceof Element && e.target.closest('[role="dialog"]'))) designer.select(null); }} />

<div class="design-canvas">
  {#if designer.root}
    <div class="design-form">
      <CanvasNode node={designer.root} depth={0} />
    </div>
  {:else}
    <p class="m-muted">No form loaded.</p>
  {/if}
</div>
