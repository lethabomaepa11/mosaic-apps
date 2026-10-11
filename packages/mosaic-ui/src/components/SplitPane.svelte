<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    first?: Snippet;
    second?: Snippet;
    direction?: 'row' | 'column';
    initial?: number; // percentage
    min?: number;
  }

  let { first, second, direction = 'row', initial = 30, min = 15 }: Props = $props();

  // svelte-ignore state_referenced_locally -- intentional: initial size from prop
  let size = $state(initial);
  let dragging = $state(false);
  let wrap: HTMLDivElement | undefined = $state();

  function onDown(e: PointerEvent) {
    dragging = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onMove(e: PointerEvent) {
    if (!dragging || !wrap) return;
    const rect = wrap.getBoundingClientRect();
    const pct = direction === 'row'
      ? ((e.clientX - rect.left) / rect.width) * 100
      : ((e.clientY - rect.top) / rect.height) * 100;
    size = Math.max(min, Math.min(100 - min, Math.round(pct)));
  }

  function onUp() {
    dragging = false;
  }
</script>

<div class="m-split" class:m-split--v={direction === 'column'} bind:this={wrap}>
  <div class="m-split__pane" style={direction === 'row' ? `width:${size}%` : `height:${size}%`}>
    {@render first?.()}
  </div>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="m-split__handle" class:dragging role="separator"
    onpointerdown={onDown} onpointermove={onMove} onpointerup={onUp} onpointercancel={onUp}></div>
  <div class="m-split__pane" style="flex:1">
    {@render second?.()}
  </div>
</div>
