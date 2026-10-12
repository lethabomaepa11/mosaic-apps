<script lang="ts">
  import { page } from '$app/state';
  import { PageRenderer } from '@mosaic-apps/ui';
  import type { PageDef } from '@mosaic-apps/core';
  import { client } from '#lib/client';
  let definition = $state<PageDef | null>(null);
  let params = $state<Record<string, string>>({});
  let error = $state('');
  let request = 0;
  $effect(() => {
    const path = page.url.pathname;
    const current = ++request;
    definition = null; error = '';
    void client.resolvePage(path).then(result => {
      if (current === request) { definition = result.page; params = result.params; }
    }).catch(reason => { if (current === request) error = reason instanceof Error ? reason.message : 'Could not load this page.'; });
    return () => { request += 1; };
  });
</script>

<svelte:head><title>{definition?.settings?.title ?? definition?.name ?? 'Page'} · __PROJECT_NAME__</title></svelte:head>
{#if error}<div class="m-alert m-alert--warning" role="alert">{error}</div>
{:else if definition}<PageRenderer page={definition} {client} scope={{ params, query: Object.fromEntries(page.url.searchParams) }} />
{:else}<div class="m-card" role="status"><span class="m-spinner"></span> Loading page…</div>{/if}
