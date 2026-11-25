<script lang="ts">
  import { page } from '$app/state';
  import { PageRenderer } from '@mosaic-apps/ui';
  import { client } from '#lib/client';

  let { data } = $props();
  const seo = $derived(data.mosaicPage.settings?.seo ?? {});
  const title = $derived(seo.title ?? data.mosaicPage.settings?.title ?? data.mosaicPage.name);
  const description = $derived(seo.description ?? data.mosaicPage.settings?.description ?? data.mosaicPage.description);
</script>

<svelte:head>
  <title>{title} - __PROJECT_NAME__</title>
  {#if description}<meta name="description" content={description} />{/if}
  {#if seo.canonicalUrl}<link rel="canonical" href={seo.canonicalUrl} />{/if}
  {#if seo.robots}<meta name="robots" content={seo.robots} />{/if}
  <meta property="og:title" content={seo.socialTitle ?? title} />
  {#if seo.socialDescription ?? description}<meta property="og:description" content={seo.socialDescription ?? description} />{/if}
  {#if seo.socialImage}<meta property="og:image" content={seo.socialImage} />{/if}
</svelte:head>

<PageRenderer page={data.mosaicPage} {client} scope={{ params: data.mosaicParams, query: Object.fromEntries(page.url.searchParams) }} />
