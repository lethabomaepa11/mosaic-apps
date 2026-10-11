<script lang="ts">
  import { onMount } from 'svelte';
  import { TextField, toast } from '@mosaic-apps/ui';
  import type { PageDef } from '@mosaic-apps/core';
  import { client } from '#lib/client';

  let pages = $state<PageDef[]>([]);
  let newName = $state('');
  let busy = $state(false);

  onMount(async () => {
    try {
      pages = await client.listPages();
    } catch (err) {
      toast.error('Could not load pages', err instanceof Error ? err.message : String(err));
    }
  });

  async function create() {
    if (!newName.trim()) return;
    busy = true;
    try {
      const page = await client.createPage({
        name: newName.trim(),
        schema: { type: 'page', children: [] },
      });
      window.location.href = `/design/pages/${page.id}`;
    } catch (err) {
      toast.error('Create failed', err instanceof Error ? err.message : String(err));
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head><title>Pages · Mosaic Studio</title></svelte:head>

<header class="app-header">
  <h1 class="m-h2" style="margin:0">Pages</h1>
  <div class="m-row">
    <div style="width:240px"><TextField placeholder="New page name…" bind:value={newName} /></div>
    <button class="m-btn m-btn--primary" disabled={busy || !newName.trim()} onclick={create}>+ Create page</button>
  </div>
</header>

{#if pages.length === 0}
  <div class="m-card"><p class="m-muted">No pages yet.</p></div>
{:else}
  <div class="cards">
    {#each pages as page (page.id)}
      <a class="m-card" href={`/design/pages/${page.id}`}>
        <div class="m-row" style="justify-content:space-between">
          <strong>{page.name}</strong>
          <span class="m-badge" class:m-badge--success={page.published}>v{page.version}{page.published ? ' · live' : ''}</span>
        </div>
        <div class="m-small m-muted" style="margin-top:6px">{page.route} · /p/{page.slug}</div>
      </a>
    {/each}
  </div>
{/if}

