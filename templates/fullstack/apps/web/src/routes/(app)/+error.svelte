<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import type { PageDef } from '@mosaic-apps/core';
  import { PageRenderer } from '@mosaic-apps/ui';
  import { client } from '#lib/client';

  let notFoundPage = $state<PageDef | null>(null);

  onMount(async () => {
    if (page.status !== 404) return;
    try {
      notFoundPage = (await client.listPages(true)).find((candidate) => candidate.route === '/404') ?? null;
    } catch {
      // Keep the accessible built-in fallback when the API is unavailable.
    }
  });
</script>

<svelte:head>
  <title>{page.status === 404 ? 'Page not found' : 'Something went wrong'} - __PROJECT_NAME__</title>
  <meta name="robots" content="noindex,nofollow" />
</svelte:head>

{#if notFoundPage}
  <PageRenderer page={notFoundPage} {client} scope={{ params: {}, query: Object.fromEntries(page.url.searchParams) }} />
{:else}
  <section class="m-card m-stack" style="max-width:720px;margin:8vh auto">
    <p class="m-muted" style="margin:0">Error {page.status}</p>
    <h1 class="m-h2" style="margin:0">{page.status === 404 ? 'Page not found' : 'Something went wrong'}</h1>
    <p>{page.error?.message ?? 'Please try again.'}</p>
    <a class="m-btn m-btn--primary" href="/">Return home</a>
  </section>
{/if}
