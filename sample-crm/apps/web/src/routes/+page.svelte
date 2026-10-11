<script lang="ts">
  import { onMount } from 'svelte';
  import { client } from '#lib/client';
  import type { FormDef, PageDef } from '@mosaic-apps/core';

  let forms = $state<FormDef[]>([]);
  let pages = $state<PageDef[]>([]);
  let error = $state('');

  onMount(async () => {
    try {
      const [f, p] = await Promise.all([client.listForms(true), client.listPages(true)]);
      forms = f;
      pages = p;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
  });
</script>

<svelte:head><title>Sample Crm</title></svelte:head>

<header class="app-header">
  <div>
    <h1 class="m-h2" style="margin:0">Welcome to Sample Crm</h1>
    <div class="m-muted m-small">Published apps from your Mosaic workspace</div>
  </div>
</header>

{#if error}
  <div class="m-alert m-alert--warning">Could not load apps: {error}</div>
{/if}

{#if pages.length}
  <h2 class="m-h3">Pages</h2>
  <div class="m-row" style="gap:12px;margin-bottom:24px">
    {#each pages as p (p.id)}
      <a class="m-card" href={`/p/${p.slug}`} style="min-width:220px">
        <strong>{p.settings?.title ?? p.name}</strong>
        <div class="m-small m-muted">{p.route}</div>
      </a>
    {/each}
  </div>
{/if}

{#if forms.length}
  <h2 class="m-h3">Forms</h2>
  <div class="m-row" style="gap:12px">
    {#each forms as f (f.id)}
      <a class="m-card" href={`/f/${f.slug}`} style="min-width:220px">
        <strong>{f.name}</strong>
        <div class="m-small m-muted">{f.entity ? `bound to ${f.entity}` : 'standalone'} · v{f.version}</div>
      </a>
    {/each}
  </div>
{:else if !error}
  <div class="m-card" style="max-width:560px">
    <strong>Nothing published yet</strong>
    <div class="m-small m-muted" style="margin-top:6px">
      Open the Mosaic Studio (<code>mosaic studio</code>), design a form or page, and hit <strong>Publish</strong>.
    </div>
  </div>
{/if}
