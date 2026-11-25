<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { toast } from '@mosaic-apps/ui';
  import type { EntityDef } from '@mosaic-apps/core';
  import { client } from '#lib/client';

  let entities = $state<{ name: string; definition?: EntityDef; label?: string; version: number; rowCount?: number }[]>([]);
  let newName = $state('');
  let busy = $state(false);
  let loaded = $state(false);

  onMount(async () => {
    try {
      entities = await client.listEntities();
    } catch (err) {
      toast.error('Could not load entities', err instanceof Error ? err.message : String(err));
    } finally {
      loaded = true;
    }
  });

  async function createEntity() {
    const name = newName.trim();
    if (!name) return;
    busy = true;
    try {
      const entity: EntityDef = {
        name: name.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
        label: name,
        labelPlural: `${name}s`,
        fields: [{ name: 'name', label: 'Name', type: 'string', required: true }],
        list: { defaultSort: '-createdAt' },
        permissions: { read: ['*'], create: ['admin', 'editor'], update: ['admin', 'editor'], delete: ['admin'] },
      };
      await client.saveEntity(entity);
      void goto(`/studio/data/entities/${entity.name}`);
    } catch (err) {
      toast.error('Create failed', err instanceof Error ? err.message : String(err));
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head><title>Entities · Mosaic Studio</title></svelte:head>

<header class="app-header">
  <h1 class="m-h2" style="margin:0">Entities</h1>
  <div class="m-row">
    <input class="m-input" style="width:220px" bind:value={newName} placeholder="New entity name…" />
    <button class="m-btn m-btn--primary" disabled={busy || !newName.trim()} onclick={createEntity}>+ Create entity</button>
  </div>
</header>

{#if !loaded}
  <div class="studio-state" role="status"><span class="m-spinner"></span> Loading entities…</div>
{:else if entities.length === 0}
  <div class="studio-state"><strong>No entities yet</strong><p>Name your first entity above and choose “Create entity” to get a table and CRUD API.</p></div>
{/if}
<div class="cards">
  {#each entities as e (e.name)}
    <a class="m-card" href={`/studio/data/entities/${e.name}`}>
      <div class="m-row" style="justify-content:space-between">
        <strong>{e.label ?? e.definition?.label ?? e.name}</strong>
        {#if typeof e.rowCount === 'number'}<span class="m-badge">{e.rowCount} rows</span>{/if}
      </div>
      <div class="m-small m-muted" style="margin-top:6px">
        <code>{e.name}</code> · v{e.version} · /api/entities/{e.name}
      </div>
    </a>
  {/each}
</div>

