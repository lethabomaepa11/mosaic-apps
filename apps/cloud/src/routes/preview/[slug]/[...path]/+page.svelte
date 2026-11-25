<script lang="ts">
  import { page as current } from '$app/state';
  import { PageRenderer, Icon, Toaster, createClient } from '@mosaic-apps/ui';
  let { data } = $props();
  // The preview's API is same-origin and member-only; Cloud forwards it to the project's Mosaic server.
  const client = $derived(createClient({ baseUrl: `${data.app.base}/api` }));
</script>

<svelte:head><title>{data.page?.settings?.title ?? data.page?.name ?? data.app.name} · {data.app.name}</title></svelte:head>

<div class="preview-app min-h-screen bg-base-200 text-base-content" data-theme={data.app.theme}>
  <div class="flex min-h-screen">
    <aside class="hidden w-60 shrink-0 flex-col gap-0.5 border-r border-base-300 bg-base-100 p-3 md:flex">
      <a class="mb-3 flex items-center gap-2 px-2 py-1.5 font-semibold tracking-tight" href={data.app.base}><span class="grid size-7 place-items-center rounded-lg bg-primary text-xs font-bold text-primary-content">{data.app.name.slice(0, 1).toUpperCase()}</span><span class="truncate">{data.app.name}</span></a>
      {#each data.nav as item (item.href)}
        <a class={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition ${current.url.pathname === item.href || (item.route === '/' && current.url.pathname === data.app.base) ? 'bg-primary/10 font-medium text-primary' : 'opacity-75 hover:bg-base-200 hover:opacity-100'}`} href={item.href}><Icon name={item.icon} /> {item.label}</a>
      {/each}
      <div class="mt-auto rounded-lg bg-base-200 px-2.5 py-2 text-[11px] leading-4 opacity-70">Live preview · signed in as the app admin. Data here is sample data.</div>
    </aside>
    <div class="min-w-0 flex-1">
      <nav class="flex gap-1 overflow-x-auto border-b border-base-300 bg-base-100 px-3 py-2 md:hidden">
        {#each data.nav as item (item.href)}<a class={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm ${current.url.pathname === item.href ? 'bg-base-200 font-medium' : 'opacity-70'}`} href={item.href}>{item.label}</a>{/each}
      </nav>
      <main class="mx-auto max-w-6xl p-4 md:p-8">
        {#if data.status === 'ready' && data.page}
          {#key data.page.id}<PageRenderer page={data.page} {client} scope={{ params: {}, query: Object.fromEntries(current.url.searchParams) }} />{/key}
        {:else if data.status === 'building'}
          <div class="grid min-h-[60vh] place-items-center text-center"><div><span class="loading loading-spinner loading-md text-primary"></span><p class="mt-3 font-medium">Mosaic is building this app…</p><p class="text-sm opacity-60">The preview appears as soon as the first verified version is ready.</p></div></div>
        {:else}
          <div class="grid min-h-[60vh] place-items-center text-center"><div><p class="font-medium">No page at {data.path}</p><a class="link link-primary text-sm" href={data.app.base}>Go to the home page</a></div></div>
        {/if}
      </main>
    </div>
  </div>
</div>
<Toaster />
