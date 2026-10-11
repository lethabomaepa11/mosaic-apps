<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { EntityForm, EntityTable, Icon, Modal, toast } from '@mosaic-apps/mosaic-ui';
  import EntityFields from '../../../../components/EntityFields.svelte';
  import type { EntityDef } from '@mosaic-apps/mosaic-core';
  import { client as api } from '#lib/client';

  const name = $derived(page.params.name);

  let entity = $state<EntityDef | null>(null);
  let loading = $state(true);
  let saving = $state(false);
  let plan = $state<{ statements: { sql: string; kind: string; risk: string; description: string }[]; warnings: string[]; empty: boolean } | null>(null);
  let planOpen = $state(false);
  let applying = $state(false);
  let recordModal = $state(false);
  let editRecord = $state<Record<string, unknown> | undefined>(undefined);
  let browseKey = $state(0);

  onMount(async () => {
    try {
      const list = await api.listEntities();
      const found = list.find((e) => e.name === name);
      if (found) entity = found.definition;
    } catch (err) {
      toast.error('Could not load entity', err instanceof Error ? err.message : String(err));
    } finally {
      loading = false;
    }
  });

  async function saveEntity() {
    if (!entity) return;
    saving = true;
    try {
      await api.saveEntity(entity);
      toast.success('Entity saved');
    } catch (err) {
      toast.error('Save failed', err instanceof Error ? err.message : String(err));
    } finally {
      saving = false;
    }
  }

  async function planMigration() {
    try {
      plan = await api.planMigrations(name);
      planOpen = true;
      if (plan.empty) toast.success('Schema is up to date');
    } catch (err) {
      toast.error('Plan failed', err instanceof Error ? err.message : String(err));
    }
  }

  async function applyMigration() {
    applying = true;
    try {
      const res = await api.applyMigrations({ allowDestructive: true, only: name });
      toast.success(`Applied ${res.applied.reduce((n, a) => n + a.statements, 0)} statement(s)`);
      planOpen = false;
      browseKey++;
    } catch (err) {
      toast.error('Migration failed', err instanceof Error ? err.message : String(err));
    } finally {
      applying = false;
    }
  }

  async function deleteEntity() {
    if (!entity) return;
    if (!confirm(`Unregister entity "${entity.name}"? The physical table is kept.`)) return;
    try {
      await api.deleteEntityDef(entity.name);
      toast.success('Entity unregistered');
      window.location.href = '/data/entities';
    } catch (err) {
      toast.error('Delete failed', err instanceof Error ? err.message : String(err));
    }
  }
</script>

<svelte:head><title>{name} · Entities</title></svelte:head>

{#if loading}
  <div class="m-card"><span class="m-spinner"></span></div>
{:else if entity}
  <header class="app-header">
    <div class="m-row" style="gap:10px">
      <h1 class="m-h2" style="margin:0">{entity.label ?? entity.name}</h1>
      <code class="m-badge">{entity.name}</code>
      {#if entity.softDelete}<span class="m-badge m-badge--warning">soft delete</span>{/if}
    </div>
    <div class="m-row">
      <button class="m-btn m-btn--secondary" onclick={planMigration}><Icon name="gitBranch" size={16} /> Plan migration</button>
      <button class="m-btn m-btn--primary" disabled={saving} onclick={saveEntity}>Save entity</button>
      <button class="m-btn m-btn--danger" onclick={deleteEntity}>Unregister</button>
    </div>
  </header>

  <EntityFields {entity} onchange={(next) => (entity = next)} />

  <section class="m-card">
    <header class="m-card__header">
      <strong>Data browser</strong>
      <button class="m-btn m-btn--primary m-btn--sm" onclick={() => { editRecord = undefined; recordModal = true; }}>+ New record</button>
    </header>
    {#key browseKey}
      <EntityTable {entity} client={api} pageSize={10} onrowclick={(row) => { editRecord = row; recordModal = true; }} />
    {/key}
  </section>

  <Modal bind:open={recordModal} title={editRecord ? 'Edit record' : 'New record'} size="lg">
    {#if entity}
      <EntityForm {entity} client={api} record={editRecord} mode={editRecord ? 'edit' : 'create'}
        onsaved={() => { recordModal = false; browseKey++; }} />
    {/if}
  </Modal>

  <Modal bind:open={planOpen} title={`Migration plan · ${name}`} size="lg">
    {#if plan}
      {#if plan.empty}
        <p class="m-muted">Schema is up to date.</p>
      {:else}
        <div class="sql-preview">{plan.statements.map((s) => s.sql).join(';\n')};</div>
        {#if plan.warnings.length}
          <div class="m-alert m-alert--warning" style="margin-top:10px">
            {#each plan.warnings as w (w)}<div>{w}</div>{/each}
          </div>
        {/if}
      {/if}
    {/if}
    {#snippet footer()}
      <button class="m-btn m-btn--ghost" onclick={() => (planOpen = false)}>Close</button>
      {#if plan && !plan.empty}
        <button class="m-btn m-btn--primary" disabled={applying} onclick={applyMigration}>{applying ? 'Applying…' : 'Apply migration'}</button>
      {/if}
    {/snippet}
  </Modal>
{/if}
