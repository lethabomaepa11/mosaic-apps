<script lang="ts">
  let { data } = $props();
  const label = (path: string) => path === '/' ? 'Home' : (path.split('/').filter((part) => part && !part.startsWith('[')).at(-1) ?? path).replaceAll('-', ' ').replace(/^./, (char) => char.toUpperCase());
  let routes = $derived(data.project.blueprint?.routes ?? []);
  // Nav shows top-level sections only: no params (:id / [id]), sub-pages, or auth actions.
  let navRoutes = $derived(routes.filter((route) => !/[:[]/.test(route.path) && route.path.split('/').filter(Boolean).length <= 1 && !/^\/(login|logout|signin|signup|register)$/.test(route.path)));
  let entities = $derived(data.project.blueprint?.entities ?? []);
</script>

<svelte:head><title>{data.project.name}</title></svelte:head>
<div class="min-h-screen bg-base-200 text-base-content" data-theme={data.project.ui_theme}>
  <header class="border-b border-base-300 bg-base-100">
    <nav class="mx-auto flex h-14 max-w-6xl items-center gap-4 px-5">
      <a class="flex min-w-0 shrink-0 items-center gap-2 font-semibold tracking-tight whitespace-nowrap max-sm:max-w-[45%]" href={`/preview/${data.project.slug}`}><span class="grid size-7 place-items-center rounded-lg bg-primary text-xs font-bold text-primary-content">{data.project.name.slice(0, 1).toUpperCase()}</span><span class="truncate">{data.project.name}</span></a>
      <div class="ml-auto flex min-w-0 gap-1 overflow-x-auto">
        {#each navRoutes as route}
          {@const href = `/preview/${data.project.slug}${route.path === '/' ? '' : route.path}`}
          <a class={`rounded-lg px-3 py-1.5 text-sm whitespace-nowrap transition ${route.path === data.path ? 'bg-base-200 font-medium' : 'opacity-70 hover:bg-base-200 hover:opacity-100'}`} {href}>{label(route.path)}</a>
        {/each}
      </div>
    </nav>
  </header>
  <main class="mx-auto max-w-6xl px-5 py-12 md:py-16">
    {#if data.route}
      <div class="max-w-2xl">
        <span class="inline-flex items-center gap-1.5 rounded-full border border-base-300 bg-base-100 px-2.5 py-1 text-xs opacity-80"><span class={`size-1.5 rounded-full ${data.route.access === 'public' ? 'bg-success' : 'bg-warning'}`}></span>{data.route.access === 'public' ? 'Public page' : data.route.access === 'authenticated' ? 'Signed-in users' : 'Role-based access'}</span>
        <h1 class="mt-4 text-4xl font-bold tracking-tight md:text-5xl">{data.path === '/' ? data.project.name : label(data.path)}</h1>
        <p class="mt-4 text-lg leading-8 opacity-70">{data.route.purpose}</p>
      </div>
      {#if data.path === '/' && entities.length}
        <div class="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {#each entities as entity}<div class="rounded-xl border border-base-300 bg-base-100 p-5 shadow-sm"><div class="mb-1 font-semibold">{entity.name}</div><p class="mb-0 text-sm leading-6 opacity-70">{entity.purpose}</p></div>{/each}
        </div>
      {/if}
    {:else}
      <div class="rounded-xl border border-base-300 bg-base-100 p-6 opacity-80">Mosaic is planning and building this preview…</div>
    {/if}
  </main>
</div>
