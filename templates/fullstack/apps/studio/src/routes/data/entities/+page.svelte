<script lang="ts">
  import { onMount } from 'svelte';
  import { TextField, toast } from '@mosaic-apps/ui';
  import type { EntityDef } from '@mosaic-apps/core';
  import { client } from '#lib/client';

  let entities = $state<{ name: string; label: string; labelPlural: string; version: number; rowCount: number }[]>([]);
  let newName = $state('');
  let busy = $state(false);

  onMount(async () => {
    try {
      entities = await client.listEntities();
    } catch (err) {
      toast.error('Could not load entities', err instanceof Error ? err.message : String(err));
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
      window.location.href = `/data/entities/${entity.name}`;
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
    <TextField label="New entity name" bind:value={newName} placeholder="New entity name…" />
    <button class="m-btn m-btn--primary" disabled={busy || !newName.trim()} onclick={createEntity}>+ Create entity</button>
  </div>
</header>

<div class="cards">
  {#each entities as e (e.name)}
    <a class="m-card" href={`/data/entities/${e.name}`}>
      <div class="m-row" style="justify-content:space-between">
        <strong>{e.label}</strong>
        <span class="m-badge">{e.rowCount} rows</span>
      </div>
      <div class="m-small m-muted" style="margin-top:6px">
        <code>{e.name}</code> · v{e.version} · /api/entities/{e.name}
      </div>
    </a>
  {/each}
</div>

