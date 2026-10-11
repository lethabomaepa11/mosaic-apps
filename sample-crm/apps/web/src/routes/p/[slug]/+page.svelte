<script lang="ts">
  import { page } from '$app/state';
  import { onMount } from 'svelte';
  import { PageRenderer } from '@mosaic/ui';
  import type { PageDef } from '@mosaic/core';
  import { client } from '#lib/client';

  const slug = $derived(page.params.slug);

  let pageDef = $state<PageDef | null>(null);
  let error = $state('');

  onMount(async () => {
    try {
      pageDef = await client.getPage(slug);
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
  });
</script>

<svelte:head><title>{pageDef?.settings?.title ?? pageDef?.name ?? 'Page'} · Sample Crm</title></svelte:head>

{#if error}
  <div class="m-alert m-alert--warning">{error}</div>
{:else if pageDef}
  <PageRenderer page={pageDef} {client} scope={{ params: page.params, query: Object.fromEntries(page.url.searchParams) }} />
{:else}
  <div class="m-card"><span class="m-spinner"></span> Loading page…</div>
{/if}
