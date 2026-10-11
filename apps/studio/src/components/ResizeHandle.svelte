<script lang="ts">
  interface Props { onresize: (delta: number) => void; value: number; min: number; max: number; direction?: 1 | -1 }
  let { onresize, value, min, max, direction = 1 }: Props = $props();
  let start = 0;
  function down(event: PointerEvent) {
    start = event.clientX;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }
  function move(event: PointerEvent) {
    if (!(event.currentTarget as HTMLElement).hasPointerCapture(event.pointerId)) return;
    const delta = event.clientX - start;
    if (delta) { onresize(delta); start = event.clientX; }
  }
</script>

<button type="button" class="resize-handle" role="slider" aria-orientation="vertical" aria-label="Resize panels" aria-valuemin={min} aria-valuemax={max} aria-valuenow={value} onpointerdown={down} onpointermove={move} onpointerup={(e) => (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)} onkeydown={(e) => { if (e.key === 'ArrowLeft') onresize(-8 * direction); if (e.key === 'ArrowRight') onresize(8 * direction); }}></button>

<style>
  .resize-handle { appearance:none; padding:0; border:0; width:6px; z-index:2; cursor:col-resize; background:transparent; touch-action:none; }
  .resize-handle:hover,.resize-handle:focus-visible { background:var(--m-primary-soft); outline:none; }
</style>
