<script lang="ts">
  import type { EntityDef, FieldDef } from '@mosaic/core';
  import { allFields, entityLabelPlural } from '@mosaic/core';
  import type { MosaicClient } from '../client/api';
  import DataTable from './DataTable.svelte';
  import Pagination from './Pagination.svelte';
  import SearchField from './SearchField.svelte';
  import EntityForm from '../render/EntityForm.svelte';
  import Modal from './Modal.svelte';
  import ShadcnButton from '../shadcn/button/Button.svelte';
  import { toast } from '../stores/toast.svelte';
  import type { Snippet } from 'svelte';

  interface Props {
    entity: EntityDef | string;
    client?: MosaicClient;
    title?: string;
    columns?: string[];
    pageSize?: number;
    sortable?: boolean;
    searchable?: boolean;
    allowCreate?: boolean;
    allowEdit?: boolean;
    allowDelete?: boolean;
    drillDown?: boolean;
    onrowclick?: (row: Record<string, unknown>) => void;
    actions?: Snippet<[Record<string, unknown>]>;
  }

  let { entity, client, title, columns, pageSize = 10, sortable = true, searchable = true, allowCreate = true, allowEdit = true, allowDelete = true, drillDown = true, onrowclick, actions }: Props = $props();

  let rows = $state<Record<string, unknown>[]>([]);
  let total = $state(0);
  let page = $state(1);
  let sortBy = $state('');
  let sortDir = $state<'asc' | 'desc'>('asc');
  let q = $state('');
  let loading = $state(false);
  let entityDef = $state<EntityDef | null>(null);
  let selectedRecord = $state<Record<string, unknown> | null>(null);
  let editorOpen = $state(false);
  let editorMode = $state<'create' | 'edit'>('create');
  let editTarget = $state<Record<string, unknown> | undefined>(undefined);

  // Resolve entity def from string or use directly
  $effect(() => {
    if (typeof entity === 'string' && client) {
      client.listEntities().then((res) => { 
        entityDef = res.find((e: any) => e.definition.name === entity)?.definition ?? null; 
      }).catch(() => { entityDef = null; });
    } else if (typeof entity === 'string') {
      // Designer canvas can render data components before a runtime client is attached.
      entityDef = null;
    } else {
      entityDef = entity;
    }
  });

  const fields: FieldDef[] = $derived(entityDef ? allFields(entityDef) : []);
  const cols = $derived((columns ?? entityDef?.list?.columns ?? fields.slice(0, 6).map((f) => f.name))
    .map((name) => fields.find((f) => f.name === name))
    .filter((f): f is FieldDef => !!f));

  const tableColumns = $derived(cols.map((f) => ({
    key: f.name,
    label: f.label ?? f.name,
    sortable: sortable && f.sortable !== false && !f.system,
  })));

  $effect(() => {
    if (entityDef) void load();
  });

  async function load() {
    if (!client) return;
    const name = entityDef?.name;
    if (!name) return;
    loading = true;
    try {
      const res = await client.listRecords(name, {
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

  function openCreate() { editorMode = 'create'; editTarget = undefined; editorOpen = true; }
  function openEdit(row: Record<string, unknown>) { editorMode = 'edit'; editTarget = row; editorOpen = true; }
  function selectRow(row: Record<string, unknown>) {
    onrowclick?.(row);
    if (drillDown) selectedRecord = row;
  }
  async function deleteRow(row: Record<string, unknown>) {
    if (!client || !entityDef || row.id === undefined || !confirm('Delete this record?')) return;
    try { await client.deleteRecord(entityDef.name, String(row.id)); await load(); toast.success('Record deleted'); }
    catch (err) { toast.error('Delete failed', err instanceof Error ? err.message : String(err)); }
  }
</script>

<div class="m-card">
  {#if title || searchable}
    <div class="m-toolbar">
      <div class="m-row">
        {#if title}<strong>{title}</strong>
        {:else}<span class="m-muted">{entityDef ? entityLabelPlural(entityDef) : ''}</span>{/if}
        <span class="m-badge">{total}</span>
      </div>
      <div class="m-row">
        {#if allowCreate && client && entityDef}<ShadcnButton size="sm" class="m-btn m-btn--primary m-btn--sm" onclick={openCreate}>Add {entityDef.label ?? entityDef.name}</ShadcnButton>{/if}
        {#if searchable}
          <div style="min-width:220px">
            <SearchField bind:value={q} onSearch={() => { page = 1; load(); }} />
          </div>
        {/if}
      </div>
    </div>
  {/if}
  {#snippet rowActions(row: Record<string, unknown>)}
    <div class="m-row" style="gap:4px">
      {#if drillDown}<ShadcnButton variant="ghost" size="sm" class="m-btn m-btn--ghost m-btn--sm" onclick={() => selectRow(row)}>View</ShadcnButton>{/if}
      {#if allowEdit && client}<ShadcnButton variant="secondary" size="sm" class="m-btn m-btn--secondary m-btn--sm" onclick={() => openEdit(row)}>Edit</ShadcnButton>{/if}
      {#if allowDelete && client}<ShadcnButton variant="ghost" size="sm" class="m-btn m-btn--ghost m-btn--sm" onclick={() => deleteRow(row)}>Delete</ShadcnButton>{/if}
      {@render actions?.(row)}
    </div>
  {/snippet}
  <DataTable columns={tableColumns} rows={rows} {sortBy} {sortDir} {onsort} onrowclick={selectRow} actions={rowActions} {loading} />
  {#if !client}<p class="m-small m-muted" style="padding:12px 16px">Connect a runtime API client to load this table.</p>{/if}
  <Pagination {page} {pageSize} {total} onpage={(p) => { page = p; load(); }} />
  {#if selectedRecord && entityDef && client}
    <section class="m-entity-detail">
      <header class="m-row" style="justify-content:space-between"><strong>{entityDef.label ?? entityDef.name} details</strong><ShadcnButton variant="ghost" size="sm" class="m-btn m-btn--ghost m-btn--sm" onclick={() => selectedRecord = null}>Back to table</ShadcnButton></header>
      <EntityForm entity={entityDef} {client} record={selectedRecord} mode="view" />
    </section>
  {/if}
</div>
<Modal bind:open={editorOpen} title={editorMode === 'create' ? `Create ${entityDef?.label ?? entityDef?.name ?? 'record'}` : `Edit ${entityDef?.label ?? entityDef?.name ?? 'record'}`} size="lg">
  {#if entityDef && client}<EntityForm entity={entityDef} {client} record={editTarget} mode={editorMode} onsaved={() => { editorOpen = false; void load(); }} oncancel={() => editorOpen = false} />{/if}
</Modal>

<style>
  .m-entity-detail { display:grid; gap:14px; margin:16px 0; padding:16px; border:1px solid var(--m-border); border-radius:var(--m-radius); background:var(--m-surface); }
</style>
