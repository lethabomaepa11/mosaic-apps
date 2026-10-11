<script lang="ts">
  import type { EntityDef, FieldDef } from '@mosaic/core';
  import { allFields, entityLabelPlural } from '@mosaic/core';
  import type { MosaicClient } from '../client/api';
  import DataTable from './DataTable.svelte';
  import Pagination from './Pagination.svelte';
  import SearchField from './SearchField.svelte';
  import type { Snippet } from 'svelte';

  interface Props {
    entity: EntityDef;
    client: MosaicClient;
    title?: string;
    columns?: string[];
    pageSize?: number;
    sortable?: boolean;
    searchable?: boolean;
    onrowclick?: (row: Record<string, unknown>) => void;
    actions?: Snippet<[Record<string, unknown>]>;
  }

  let { entity, client, title, columns, pageSize = 10, sortable = true, searchable = true, onrowclick, actions }: Props = $props();

  let rows = $state<Record<string, unknown>[]>([]);
  let total = $state(0);
  let page = $state(1);
  let sortBy = $state('');
  let sortDir = $state<'asc' | 'desc'>('asc');
  let q = $state('');
  let loading = $state(false);

  const fields: FieldDef[] = $derived(allFields(entity));
  const cols = $derived((columns ?? entity.list?.columns ?? fields.slice(0, 6).map((f) => f.name))
    .map((name) => fields.find((f) => f.name === name))
    .filter((f): f is FieldDef => !!f));

  const tableColumns = $derived(cols.map((f) => ({
    key: f.name,
    label: f.label ?? f.name,
    sortable: sortable && f.sortable !== false && !f.system,
  })));

  $effect(() => {
    void load();
  });

  async function load() {
    loading = true;
    try {
      const res = await client.listRecords(entity.name, {
        page,
        pageSize,
        sort: sortBy ? [{ field: sortBy, dir: sortDir }] : undefined,
        q: q || undefined,
      });
      rows = res.data;
      total = res.total;
    } catch (err) {
      console.error('[entityTable]', err);
    } finally {
      loading = false;
    }
  }

  function onsort(key: string) {
    if (sortBy === key) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    else { sortBy = key; sortDir = 'asc'; }
    load();
  }
</script>

<div class="m-card">
  {#if title || searchable}
    <div class="m-toolbar">
      <div class="m-row">
        {#if title}<strong>{title}</strong>
        {:else}<span class="m-muted">{entityLabelPlural(entity)}</span>{/if}
        <span class="m-badge">{total}</span>
      </div>
      <div class="m-row">
        {#if searchable}
          <div style="min-width:220px">
            <SearchField bind:value={q} onSearch={() => { page = 1; load(); }} />
          </div>
        {/if}
      </div>
    </div>
  {/if}
  <DataTable columns={tableColumns} rows={rows} {sortBy} {sortDir} {onsort} {onrowclick} {actions} {loading} />
  <Pagination {page} {pageSize} {total} onpage={(p) => { page = p; load(); }} />
</div>
