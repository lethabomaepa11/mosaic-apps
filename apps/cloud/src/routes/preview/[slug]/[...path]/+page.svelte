<script lang="ts">
  import { page as current } from '$app/state';
  import { invalidateAll } from '$app/navigation';
  import { FormRenderer, PageRenderer, Icon, Toaster, createClient } from '@mosaic-apps/ui';
  import NavigationEditor from '../../../../../../../templates/fullstack/apps/web/src/lib/studio/components/NavigationEditor.svelte';
  let { data } = $props();
  // The preview's API is same-origin and member-only; Cloud forwards it to the project's Mosaic server.
  const client = $derived(createClient({ baseUrl: `${data.app.base}/api` }));
  const pageKey = $derived(current.url.searchParams.get('page'));
  const formKey = $derived(current.url.searchParams.get('form'));
  const editingPage = $derived(data.status === 'studio' ? data.studioPages.find((item) => item.slug === pageKey || item.id === pageKey) : undefined);
  const editingForm = $derived(data.status === 'studio' ? data.studioForms.find((item) => item.slug === formKey || item.id === formKey) : undefined);
  const artifact = $derived(editingPage ? { kind: 'page' as const, slug: editingPage.slug } : editingForm ? { kind: 'form' as const, slug: editingForm.slug } : undefined);
</script>

<svelte:head><title>{data.page?.settings?.title ?? data.page?.name ?? data.app.name} · {data.app.name}</title></svelte:head>

<div class="preview-app min-h-screen bg-base-200 text-base-content" data-theme={data.app.theme}>
  {#if data.status === 'sidebar'}
    <main class="mx-auto max-w-4xl p-4 md:p-8">
      <div class="mb-4 flex gap-2">
        <a class="btn btn-outline btn-sm" href={`${data.app.base}/studio`}>Back to Studio</a>
        <a class="btn btn-outline btn-sm" href={data.app.base}>Open app preview</a>
      </div>
      <NavigationEditor {client} initial={data.navigation} name={data.app.name} onsave={invalidateAll} />
    </main>
  {:else if data.status === 'studio' && artifact}
    {#key `${artifact.kind}:${artifact.slug}`}
      {#await import('#lib/PreviewDesigner.svelte')}
        <p class="p-4" role="status">Opening the designer…</p>
      {:then { default: PreviewDesigner }}
        <PreviewDesigner {client} base={data.app.base} {artifact} entities={data.studioEntities} forms={data.studioForms} pages={data.studioPages} />
      {:catch}
        <p class="p-4" role="alert">The designer could not open. <a class="link" href={`${data.app.base}/studio`}>Back to Studio</a></p>
      {/await}
    {/key}
  {:else}
  <div class="flex min-h-screen">
    <aside class="hidden w-60 shrink-0 flex-col gap-0.5 border-r border-base-300 bg-base-100 p-3 md:flex">
      <a class="mb-3 flex items-center gap-2 px-2 py-1.5 font-semibold tracking-tight" href={data.app.base}><span class="grid size-7 place-items-center rounded-lg bg-primary text-xs font-bold text-primary-content">{data.app.name.slice(0, 1).toUpperCase()}</span><span class="truncate">{data.app.name}</span></a>
      {#each data.nav as item, index}
        {#if item.section && item.section !== data.nav[index - 1]?.section}<p class="px-2.5 pt-2 text-xs font-medium opacity-70">{item.section}</p>{/if}
        <a class={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition ${current.url.pathname === item.href ? 'bg-primary/10 font-medium text-primary' : 'opacity-75 hover:bg-base-200 hover:opacity-100'}`} href={item.href}><Icon name={item.icon} /> {item.label}</a>
      {/each}
      <div class="mt-auto flex flex-col gap-1 pt-3">
        <a class="btn btn-outline btn-sm justify-start" href={`${data.app.base}/studio`}>Open Studio</a>
        <a class="btn btn-ghost btn-sm justify-start" href={`${data.app.base}/studio?sidebar`}>Edit sidebar</a>
        <a class="btn btn-ghost btn-sm justify-start" href={`${data.app.base}/login`}>Sign in</a>
      </div>
    </aside>
    <div class="min-w-0 flex-1">
      <nav class="flex gap-1 overflow-x-auto border-b border-base-300 bg-base-100 px-3 py-2 md:hidden">
        {#each data.nav as item}<a class={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm ${current.url.pathname === item.href ? 'bg-base-200 font-medium' : 'opacity-70'}`} href={item.href}>{item.label}</a>{/each}
        <a class="btn btn-outline btn-sm whitespace-nowrap" href={`${data.app.base}/studio`}>Open Studio</a>
        <a class="btn btn-ghost btn-sm whitespace-nowrap" href={`${data.app.base}/studio?sidebar`}>Edit sidebar</a>
        <a class="btn btn-ghost btn-sm whitespace-nowrap" href={`${data.app.base}/login`}>Sign in</a>
      </nav>
      <main class={data.status === 'ready' ? '' : 'mx-auto max-w-6xl p-4 md:p-8'}>
        {#if data.status === 'ready' && data.page}
          {#key data.page.id}<PageRenderer page={data.page} {client} scope={{ params: {}, query: Object.fromEntries(current.url.searchParams) }} />{/key}
        {:else if data.status === 'form' && data.form}
          <section class="mx-auto max-w-3xl rounded-xl border border-base-300 bg-base-100 p-6">
            <h1 class="mb-2 text-2xl font-semibold">{data.form.name}</h1>
            <p class="mb-5 text-sm opacity-70">{data.form.description}</p>
            {#key data.form.id}<FormRenderer form={data.form} {client} />{/key}
          </section>
        {:else if data.status === 'sign-in'}
          <section class="mx-auto mt-10 max-w-sm rounded-xl border border-base-300 bg-base-100 p-8">
            <h1 class="text-2xl font-semibold">{data.authTitle ?? (data.registering ? 'Create an account' : `Sign in to ${data.app.name}`)}</h1>
            <p class="my-4 text-sm opacity-70">Use your Cloud session to open this private preview.</p>
            <a class="btn btn-primary w-full" href={data.app.base}>Continue to preview</a>
            {#if data.app.liveUrl}<a class="btn btn-outline mt-2 w-full" href={`${data.app.liveUrl}/${data.registering ? 'signup' : 'login'}`} target="_blank" rel="noreferrer">{data.registering ? 'Create a live app account' : 'Sign in to live app'}</a>{/if}
            {#if data.app.allowRegistration}<a class="btn btn-ghost mt-2 w-full" href={`${data.app.base}/${data.registering ? 'login' : 'signup'}`}>{data.registering ? 'Back to sign in' : 'Create an account'}</a>{/if}
          </section>
        {:else if data.status === 'studio'}
          <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div><h1 class="text-2xl font-semibold">Preview Studio</h1><p class="text-sm opacity-70">Edit pages, forms and navigation in this preview.</p></div>
            {#if data.app.liveUrl && data.app.studioAvailable}
              <a class="btn btn-primary btn-sm" href={`${data.app.liveUrl}/studio`} target="_blank" rel="noreferrer">Open live Studio</a>
            {:else}
              <a class="btn btn-outline btn-sm" href={`/projects/${data.app.id}`} target="_top">Open Cloud builder</a>
            {/if}
          </div>
          <div class="grid gap-4 lg:grid-cols-2">
            <section class="rounded-xl border border-base-300 bg-base-100 p-5">
              <h2 class="mb-2 font-semibold">Pages</h2>
              <ul class="divide-y divide-base-300">
                {#each data.studioPages as item (item.route)}<li class="flex items-center justify-between gap-3 py-2 text-sm"><a class="link" href={`${data.app.base}${item.route}`}>{item.name}</a><a class="btn btn-outline btn-xs" aria-label={`Edit ${item.name}`} href={`?page=${encodeURIComponent(item.slug)}`}>Edit</a></li>{/each}
              </ul>
            </section>
            <section class="rounded-xl border border-base-300 bg-base-100 p-5">
              <h2 class="mb-2 font-semibold">Forms</h2>
              <ul class="divide-y divide-base-300">
                {#each data.studioForms as item (item.slug)}<li class="flex items-center justify-between gap-3 py-2 text-sm"><a class="link" href={`${data.app.base}/f/${item.slug}`}>{item.name}</a><a class="btn btn-outline btn-xs" aria-label={`Edit ${item.name}`} href={`?form=${encodeURIComponent(item.slug)}`}>Edit</a></li>{/each}
              </ul>
            </section>
          </div>
          <section class="mt-4 rounded-xl border border-base-300 bg-base-100 p-5">
            <h2 class="mb-2 font-semibold">Data model</h2>
            {#each data.studioEntities as entity (entity.name)}
              <details class="border-b border-base-300 py-2 last:border-0"><summary class="cursor-pointer text-sm font-medium">{entity.label}</summary>
                <ul class="mt-2 space-y-1 pl-4 text-sm">{#each entity.fields as field}<li>{field.label} <code class="ml-2 opacity-60">{field.type}</code></li>{/each}</ul>
              </details>
            {/each}
          </section>
        {:else if data.status === 'unavailable'}
          <div class="grid min-h-[60vh] place-items-center text-center"><div><p class="font-medium">The preview could not start.</p><a class="btn btn-outline btn-sm" href={current.url.pathname} data-sveltekit-reload>Reload preview</a></div></div>
        {:else if data.status === 'building'}
          <div class="grid min-h-[60vh] place-items-center text-center"><div><span class="loading loading-spinner loading-md text-primary"></span><p class="mt-3 font-medium">Mosaic is building this app…</p><p class="text-sm opacity-60">The preview appears as soon as the first verified version is ready.</p></div></div>
        {:else}
          <div class="grid min-h-[60vh] place-items-center text-center"><div><p class="font-medium">No page at {data.path}</p><a class="link link-primary text-sm" href={data.app.base}>Go to the home page</a></div></div>
        {/if}
      </main>
    </div>
  </div>
  {/if}
</div>
<Toaster />
