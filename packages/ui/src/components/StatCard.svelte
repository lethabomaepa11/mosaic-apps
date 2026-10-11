<script lang="ts">
  interface Props {
    label: string;
    value?: string | number;
    /** entity name: value is fetched via client when provided */
    entity?: string;
    client?: import('../client/api').MosaicClient;
    trend?: string;
    trendDir?: 'up' | 'down';
    icon?: string;
  }

  let { label, value, entity, client, trend, trendDir = 'up', icon }: Props = $props();

  let resolved = $state<string | number | null>(null);
  let loaded = $state(false);

  $effect(() => {
    const ent = entity;
    const cl = client;
    if (!ent || !cl || loaded) return;
    loaded = true;
    cl.listRecords(ent, { page: 1, pageSize: 1 })
      .then((res) => { resolved = res.total; })
      .catch(() => { resolved = '—'; });
  });

  const display = $derived(value ?? resolved ?? '—');
</script>

<div class="m-stat">
  <div class="m-row" style="justify-content:space-between">
    <span class="m-stat__label">{label}</span>
    {#if icon}<span style="opacity:.5">{icon}</span>{/if}
  </div>
  <div class="m-stat__value">{display}</div>
  {#if trend}<div class="m-stat__trend" class:up={trendDir === 'up'} class:down={trendDir === 'down'}>{trend}</div>{/if}
</div>
