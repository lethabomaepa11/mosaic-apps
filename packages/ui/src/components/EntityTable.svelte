<script lang="ts">
  import type { EntityDef, FieldDef, TableRowAction } from '@mosaic-apps/core';
  import { allFields, entityLabelPlural, evaluateBoolean } from '@mosaic-apps/core';
  import type { MosaicClient } from '../client/api';
  import DataTable from './DataTable.svelte';
  import Pagination from './Pagination.svelte';
  import SearchField from './SearchField.svelte';
  import EntityForm from '../render/EntityForm.svelte';
  import Modal from './Modal.svelte';
  import ShadcnButton from '../shadcn/button/Button.svelte';
  import { toast } from '../stores/toast.svelte';
  import type { Snippet } from 'svelte';
  import { getContext, onDestroy } from 'svelte';
  import { MOSAIC_NAVIGATION_CONTEXT, type MosaicNavigate } from '../state/navigation';
  import { ACTION_CONFIRMATION_CONTEXT, type MosaicConfirm } from '../actions/confirmation';
  import { actionScope, createActionRunner, type ActionContext } from '../actions/runner';
  import { createMosaicState, MOSAIC_STATE_CONTEXT, type MosaicState } from '../state/store';
  import Icon from './Icon.svelte';

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
    createFormId?: string;
    editFormId?: string;
    detailFormId?: string;
    readOnly?: boolean;
    rowActions?: TableRowAction[];
    onrowclick?: (row: Record<string, unknown>) => void;
    actions?: Snippet<[Record<string, unknown>]>;
  }

  let { entity, client, title, columns, pageSize = 10, sortable = true, searchable = true, allowCreate = true, allowEdit = true, allowDelete = true, drillDown = true, createFormId, editFormId, detailFormId, readOnly = false, rowActions = [], onrowclick, actions }: Props = $props();

  let rows = $state<Record<string, unknown>[]>([]);
  let total = $state(0);
  let page = $state(1);
  let sortBy = $state('');
  let sortDir = $state<'asc' | 'desc'>('asc');
  let q = $state('');
  let search = $state('');
  let loading = $state(false);
  let entityDef = $state<EntityDef | null>(null);
  let selectedRecord = $state<Record<string, unknown> | null>(null);
  let editorOpen = $state(false);
  let editorMode = $state<'create' | 'edit'>('create');
  let editTarget = $state<Record<string, unknown> | undefined>(undefined);
  let error = $state('');
  let request = 0;
  let controller: AbortController | undefined;
  let capabilities = $state({ read: false, create: false, update: false, delete: false });
  const navigate = getContext<MosaicNavigate | undefined>(MOSAIC_NAVIGATION_CONTEXT);
  const runtime = getContext<MosaicState | undefined>(MOSAIC_STATE_CONTEXT) ?? createMosaicState();
  const actionContext: ActionContext = { state: runtime, navigate, confirm: getContext<MosaicConfirm | undefined>(ACTION_CONFIRMATION_CONTEXT), notify: (variant, title, description) => toast[variant](title, description) };
  const actionRunner = createActionRunner(actionContext);
  let runningAction = $state('');
  let active = true;
  onDestroy(() => { active = false; controller?.abort(); if (runningAction) actionRunner.cancel(runningAction); });

  // Resolve entity def from string or use directly
  $effect(() => {
    const selected = typeof entity === 'string' ? entity : entity.name;
    let active = true;
    entityDef = typeof entity === 'string' ? null : entity;
    rows = []; total = 0; page = 1; sortBy = ''; selectedRecord = null;
    request += 1; controller?.abort();
    capabilities = { read: false, create: false, update: false, delete: false };
    if (client) void client.entityMeta(selected).then((meta) => {
      if (!active) return;
      entityDef = meta.entity;
      capabilities = meta.capabilities ?? { read: true, create: true, update: true, delete: true };
    }).catch((reason) => { if (active) { entityDef = null; error = reason instanceof Error ? reason.message : 'Could not load entity metadata.'; } });
    return () => { active = false; };
  });

  const fields: FieldDef[] = $derived(entityDef ? allFields(entityDef) : []);
  const cols = $derived((columns?.length ? columns : entityDef?.list?.columns?.length ? entityDef.list.columns : fields.slice(0, 6).map((f) => f.name))
    .map((name) => fields.find((f) => f.name === name) ?? { name, label: name, type: 'string' as const, sortable: false }));

  const tableColumns = $derived(cols.map((f) => ({
    key: f.name,
    label: f.label ?? f.name,
    sortable: sortable && f.sortable !== false,
  })));

  $effect(() => {
    if (entityDef) void load();
  });

  async function load() {
    if (!client) return;
    const name = entityDef?.name;
    if (!name) return;
    const current = ++request;
    controller?.abort();
    const abort = new AbortController();
    controller = abort;
    loading = true;
    error = '';
    try {
      const res = await client.listRecords(name, {
        page,
        pageSize,
        sort: sortBy ? [{ field: sortBy, dir: sortDir }] : undefined,
        q: search || undefined,
      }, { signal: abort.signal });
      if (current !== request || abort.signal.aborted) return;
      rows = res.data;
      total = res.total;
    } catch (err) {
      if (current === request && !abort.signal.aborted) { error = err instanceof Error ? err.message : 'Could not load records.'; rows = []; total = 0; }
    } finally {
      if (current === request) loading = false;
    }
  }

  function onsort(key: string) {
    if (sortBy === key) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    else { sortBy = key; sortDir = 'asc'; }
  }

  function navigateForm(id: string, row?: Record<string, unknown>) {
    const href = `/f/${encodeURIComponent(id)}${row?.id ? `?id=${encodeURIComponent(String(row.id))}` : ''}`;
    if (navigate) void navigate(href);
    else window.location.assign(href);
  }
  function openCreate() { if (createFormId) { navigateForm(createFormId); return; } editorMode = 'create'; editTarget = undefined; editorOpen = true; }
  function openEdit(row: Record<string, unknown>) { if (editFormId) { navigateForm(editFormId, row); return; } editorMode = 'edit'; editTarget = row; editorOpen = true; }
  function selectRow(row: Record<string, unknown>) {
    onrowclick?.(row);
    if (drillDown && detailFormId) navigateForm(detailFormId, row);
    else if (drillDown) selectedRecord = row;
  }
  async function deleteRow(row: Record<string, unknown>) {
    if (!client || !entityDef || row.id === undefined || !confirm('Delete this record?')) return;
    try { await client.deleteRecord(entityDef.name, String(row.id)); await load(); toast.success('Record deleted'); }
    catch (err) { toast.error('Delete failed', err instanceof Error ? err.message : String(err)); }
  }
  function showAction(action: TableRowAction, row: Record<string, unknown>) {
    return !action.when || evaluateBoolean(action.when, actionScope({ ...actionContext, data: row }), false);
  }
  async function runRowAction(action: TableRowAction, row: Record<string, unknown>) {
    if (runningAction) return;
    const key = `row:${String(row.id)}:${action.id}`;
    runningAction = key;
    actionContext.client = client; actionContext.data = structuredClone($state.snapshot(row));
    runtime.component.set('selectedRecord', structuredClone($state.snapshot(row)));
    try { await actionRunner.execute(key, action.actions); if (active) await load(); }
    catch (reason) { if (active) toast.error('Row action failed', reason instanceof Error ? reason.message : String(reason)); }
    finally { runningAction = ''; }
  }
</script>

<div class="m-card">
  {#if title || searchable || (allowCreate && capabilities.create && !readOnly)}
    <div class="m-toolbar">
      <div class="m-row">
        {#if title}<strong>{title}</strong>
        {:else}<span class="m-muted">{entityDef ? entityLabelPlural(entityDef) : ''}</span>{/if}
        <span class="m-badge">{total}</span>
      </div>
      <div class="m-row">
        {#if allowCreate && capabilities.create && !readOnly && client && entityDef}<ShadcnButton size="sm" class="m-btn m-btn--primary m-btn--sm" onclick={openCreate}>Add {entityDef.label ?? entityDef.name}</ShadcnButton>{/if}
        {#if searchable}
          <div style="min-width:220px">
            <SearchField bind:value={q} onSearch={() => { search = q; page = 1; }} />
          </div>
        {/if}
      </div>
    </div>
  {/if}
  {#snippet renderRowActions(row: Record<string, unknown>)}
    <div class="m-row" style="gap:4px">
      {#if drillDown}<ShadcnButton variant="ghost" size="sm" class="m-btn m-btn--ghost m-btn--sm" onclick={() => selectRow(row)}>View</ShadcnButton>{/if}
      {#if allowEdit && capabilities.update && !readOnly && client}<ShadcnButton variant="secondary" size="sm" class="m-btn m-btn--secondary m-btn--sm" onclick={() => openEdit(row)}>Edit</ShadcnButton>{/if}
      {#if allowDelete && capabilities.delete && !readOnly && client}<ShadcnButton variant="ghost" size="sm" class="m-btn m-btn--ghost m-btn--sm" onclick={() => deleteRow(row)}>Delete</ShadcnButton>{/if}
      {@render actions?.(row)}
      {#each rowActions.filter(action => showAction(action, row)) as action (action.id)}<ShadcnButton type="button" variant="secondary" size="sm" disabled={!!runningAction} onclick={() => runRowAction(action, row)}>{#if action.icon}<Icon name={action.icon} size={14} />{/if}{action.label}</ShadcnButton>{/each}
    </div>
  {/snippet}
  <DataTable columns={tableColumns} rows={rows} {sortBy} {sortDir} {onsort} onrowclick={selectRow} actions={renderRowActions} {loading} />
  {#if error}<div class="m-alert m-alert--warning" role="alert">{error} <ShadcnButton variant="secondary" size="sm" onclick={() => load()}>Retry</ShadcnButton></div>{/if}
  {#if !client}<p class="m-small m-muted" style="padding:12px 16px">Connect a runtime API client to load this table.</p>{/if}
  <Pagination {page} {pageSize} {total} onpage={(p) => { page = p; }} onpagesize={size => { pageSize = size; page = 1; }} />
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
