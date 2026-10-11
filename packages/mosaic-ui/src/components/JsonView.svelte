<script lang="ts">
  interface Props {
    value: unknown;
    collapsed?: boolean;
  }

  let { value, collapsed = false }: Props = $props();

  const text = $derived(JSON.stringify(value, null, 2) ?? 'null');
  let expanded = $state(!collapsed);
</script>

<div>
  <button class="m-btn m-btn--ghost m-btn--sm" style="margin-bottom:6px" onclick={() => (expanded = !expanded)}>
    {expanded ? '▾ Collapse' : '▸ Expand'} JSON
  </button>
  {#if expanded}<pre class="m-jsonview">{text}</pre>{/if}
</div>
