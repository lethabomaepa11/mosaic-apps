<script lang="ts">
  import { onMount } from 'svelte';
  import { client } from '#lib/client';
  import { auth } from '#lib/auth.svelte';

  let meta = $state<{ counts: { entities: number; forms: number; pages: number; users: number; migrations: number } } | null>(null);
  let error = $state('');

  onMount(async () => {
    if (!auth.ready) await auth.refresh();
    if (!auth.user) {
      window.location.href = '/login';
      return;
    }
    try {
      meta = await client.meta();
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
  });
</script>

<svelte:head><title>Mosaic Studio</title></svelte:head>

<header class="app-header">
  <div>
    <h1 class="m-h2" style="margin:0">Dashboard</h1>
    <div class="m-muted m-small">Your metadata-driven workspace</div>
  </div>
</header>

{#if error}
  <div class="m-alert m-alert--danger" style="max-width:640px">Cannot reach the API: {error}</div>
{:else if meta}
  <div class="m-stats">
    <div class="m-stat"><div class="m-stat__label">Entities</div><div class="m-stat__value">{meta.counts.entities}</div></div>
    <div class="m-stat"><div class="m-stat__label">Forms</div><div class="m-stat__value">{meta.counts.forms}</div></div>
    <div class="m-stat"><div class="m-stat__label">Pages</div><div class="m-stat__value">{meta.counts.pages}</div></div>
    <div class="m-stat"><div class="m-stat__label">Users</div><div class="m-stat__value">{meta.counts.users}</div></div>
    <div class="m-stat"><div class="m-stat__label">Migrations</div><div class="m-stat__value">{meta.counts.migrations}</div></div>
  </div>
  <div class="cards" style="margin-top:20px">
    <a class="m-card" href="/design/forms"><strong>📝 Design a form</strong><div class="m-small m-muted">Drag & drop, store as JSON, publish</div></a>
    <a class="m-card" href="/design/pages"><strong>📄 Build a page</strong><div class="m-small m-muted">Dashboards from live data</div></a>
    <a class="m-card" href="/data/entities"><strong>🗃️ Model entities</strong><div class="m-small m-muted">Fields, relations, auto CRUD</div></a>
    <a class="m-card" href="/data/migrations"><strong>🧬 Migrations</strong><div class="m-small m-muted">Preview SQL, apply safely</div></a>
  </div>
{:else}
  <div class="m-card"><span class="m-spinner"></span></div>
{/if}
