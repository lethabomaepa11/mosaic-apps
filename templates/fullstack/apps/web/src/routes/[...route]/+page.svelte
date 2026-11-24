<script lang="ts">
  import { page } from '$app/state';
  import { PageRenderer } from '@mosaic-apps/ui';
  import { client } from '#lib/client';

  let { data } = $props();
</script>

<svelte:head>
  <title>{data.mosaicPage.settings?.title ?? data.mosaicPage.name} - __PROJECT_NAME__</title>
  {#if data.mosaicPage.settings?.description}<meta name="description" content={data.mosaicPage.settings.description} />{/if}
</svelte:head>

<PageRenderer page={data.mosaicPage} {client} scope={{ params: page.params, query: Object.fromEntries(page.url.searchParams) }} />
