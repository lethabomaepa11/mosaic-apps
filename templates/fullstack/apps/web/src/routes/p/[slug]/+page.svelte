<script lang="ts">
  import { page } from '$app/state';
  import { PageRenderer } from '@mosaic-apps/ui';
  import type { PageDef } from '@mosaic-apps/core';
  import { client } from '#lib/client';

  const slug = $derived(page.params.slug ?? '');

  let pageDef = $state<PageDef | null>(null);
  let error = $state('');

  let request = 0;
  $effect(() => {
    const current = ++request;
    const selected = slug;
    pageDef = null; error = '';
    void client.getPage(selected).then((result) => { if (current === request) pageDef = result; })
      .catch((reason) => { if (current === request) error = reason instanceof Error ? reason.message : String(reason); });
    return () => { request += 1; };
  });
</script>

<svelte:head><title>{pageDef?.settings?.title ?? pageDef?.name ?? 'Page'} · __PROJECT_NAME__</title></svelte:head>

{#if error}
  <div class="m-alert m-alert--warning">{error}</div>
{:else if pageDef}
  <PageRenderer page={pageDef} {client} scope={{ params: page.params, query: Object.fromEntries(page.url.searchParams) }} />
{:else}
  <div class="m-card"><span class="m-spinner"></span> Loading page…</div>
{/if}
