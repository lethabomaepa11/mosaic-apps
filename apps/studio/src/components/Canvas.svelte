<script lang="ts">
  import CanvasNode from './CanvasNode.svelte';
  import { designer } from '#lib/designer.svelte';
</script>

<div class="design-canvas" onclick={() => designer.select(null)}>
  {#if designer.root}
    <div class="design-form" onclick={(e) => e.stopPropagation()}>
      <CanvasNode node={designer.root} depth={0} />
    </div>
  {:else}
    <p class="m-muted">No form loaded.</p>
  {/if}
</div>
