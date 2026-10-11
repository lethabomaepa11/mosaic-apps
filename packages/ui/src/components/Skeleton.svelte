<script lang="ts">
  interface Props {
    width?: string;
    height?: string;
    lines?: number;
  }

  let { width = '100%', height, lines = 1 }: Props = $props();
</script>

<div style="width:{width}">
  {#each Array.from({ length: lines }, (_, i) => i) as i (i)}
    <div class="m-skeleton" style="width:100%;height:{height ?? (i === 0 ? '16px' : '12px')};margin-bottom:8px"></div>
  {/each}
</div>
