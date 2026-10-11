<script lang="ts">
  import { onMount } from 'svelte';
  import { TextField, toast } from '@mosaic-apps/mosaic-ui';
  import type { FormDef } from '@mosaic-apps/mosaic-core';
  import { client } from '#lib/client';

  let forms = $state<FormDef[]>([]);
  let newName = $state('');
  let busy = $state(false);

  onMount(async () => {
    try {
      forms = await client.listForms();
    } catch (err) {
      toast.error('Could not load forms', err instanceof Error ? err.message : String(err));
    }
  });

  async function create() {
    if (!newName.trim()) return;
    busy = true;
    try {
      const form = await client.createForm({
        name: newName.trim(),
        schema: { type: 'form', children: [] },
      });
      window.location.href = `/design/forms/${form.id}`;
    } catch (err) {
      toast.error('Create failed', err instanceof Error ? err.message : String(err));
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head><title>Forms · Mosaic Studio</title></svelte:head>

<header class="app-header">
  <h1 class="m-h2" style="margin:0">Forms</h1>
  <div class="m-row">
    <div style="width:240px"><TextField placeholder="New form name…" bind:value={newName} /></div>
    <button class="m-btn m-btn--primary" disabled={busy || !newName.trim()} onclick={create}>+ Create form</button>
  </div>
</header>

{#if forms.length === 0}
  <div class="m-card"><p class="m-muted">No forms yet — create one to start designing.</p></div>
{:else}
  <div class="cards">
    {#each forms as form (form.id)}
      <a class="m-card" href={`/design/forms/${form.id}`}>
        <div class="m-row" style="justify-content:space-between">
          <strong>{form.name}</strong>
          <span class="m-badge" class:m-badge--success={form.published}>v{form.version}{form.published ? ' · live' : ''}</span>
        </div>
        <div class="m-small m-muted" style="margin-top:6px">
          {form.entity ? `entity: ${form.entity}` : 'standalone'} · /f/{form.slug}
        </div>
      </a>
    {/each}
  </div>
{/if}

