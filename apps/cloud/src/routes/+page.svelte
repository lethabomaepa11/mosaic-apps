<script lang="ts">
  import { DAISY_THEME_CHOICES } from '#lib/themes';
  let { data, form } = $props();
  const statusClass = (status: string) => status === 'connected' ? 'badge-success' : status === 'queued' ? 'badge-warning' : 'badge-outline';
</script>

<svelte:head><title>Projects · Mosaic Cloud</title><meta name="description" content="Generate, own, and deploy Mosaic applications." /></svelte:head>

<section class="space-y-10">
  <header class="max-w-3xl">
    <p class="section-label">{data.organization?.name ?? 'Workspace'}</p>
    <h1 class="page-title mb-3">Create an application your team can own.</h1>
    <p class="muted text-base leading-7">Describe the business or passion app. Mosaic prepares editable pages, a physical data model, source code, and a single-project deployment.</p>
  </header>

  <div class="grid gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,.55fr)]">
    <form method="POST" action="?/create" class="surface space-y-5 p-5 md:p-7">
      <div><h2 class="text-xl font-semibold">Start a project</h2><p class="mt-1 muted text-sm">This brief starts the project conversation. You can refine it at any time.</p></div>
      <fieldset class="fieldset"><legend class="fieldset-legend">Project name</legend><input class="input input-bordered w-full" id="name" name="name" placeholder="Northstar CRM" required /></fieldset>
      <fieldset class="fieldset"><legend class="fieldset-legend">What should it do?</legend><textarea class="textarea textarea-bordered min-h-36 w-full" id="prompt" name="prompt" placeholder="Build a customer portal for a solar installer with leads, quotes, installation milestones, invoices, and client login…" required></textarea></fieldset>
      <div class="grid gap-4 sm:grid-cols-3">
        <fieldset class="fieldset"><legend class="fieldset-legend">Framework</legend><select class="select select-bordered w-full" name="appFramework"><option value="sveltekit">SvelteKit</option><option disabled>Next.js — planned</option><option disabled>Astro — planned</option></select></fieldset>
        <fieldset class="fieldset"><legend class="fieldset-legend">UI system</legend><select class="select select-bordered w-full" name="uiSystem"><option value="daisyui">DaisyUI</option><option value="mosaic">Mosaic native</option></select></fieldset>
        <fieldset class="fieldset"><legend class="fieldset-legend">Theme</legend><select class="select select-bordered w-full" name="uiTheme">{#each DAISY_THEME_CHOICES as theme}<option value={theme.value}>{theme.label}</option>{/each}</select></fieldset>
      </div>
      <p class="-mt-3 text-xs muted">Framework, component system, and design tokens are stored independently so the app can evolve without rewriting its data model.</p>
      <div class="flex flex-wrap gap-5">
        <label class="label cursor-pointer gap-2"><input class="checkbox checkbox-sm checkbox-primary" name="includeHome" type="checkbox" checked /> Homepage</label>
        <label class="label cursor-pointer gap-2"><input class="checkbox checkbox-sm checkbox-primary" name="includeLogin" type="checkbox" checked /> Login</label>
      </div>
      {#if form?.message}<div class="alert alert-error text-sm" role="alert">{form.message}</div>{/if}
      <button class="btn btn-primary" type="submit">Create project</button>
    </form>

    <aside class="surface h-fit p-5 md:p-7">
      <p class="section-label">Optional</p><h2 class="mb-5 text-xl font-semibold">Delivery providers</h2>
      <div class="divide-y divide-base-300">
        {#each ['github', 'vercel'] as provider}
          {@const connection = data.connections.find((item) => item.provider === provider)}
          <div class="flex items-center justify-between gap-4 py-4 first:pt-0">
            <div><strong class="capitalize">{provider}</strong><div class="mt-0.5 text-xs muted">{connection?.label ?? 'Not connected'}</div></div>
            <span class={`badge badge-sm ${statusClass(connection?.status ?? 'optional')}`}>{connection?.status ?? 'Optional'}</span>
          </div>
        {/each}
      </div>
      <p class="mt-3 text-sm leading-6 muted">Connect GitHub for source delivery and Vercel for managed previews and production. Neither is required to start.</p>
    </aside>
  </div>

  <section>
    <div class="mb-4 flex items-end justify-between"><div><p class="section-label">Workspace</p><h2 class="text-2xl font-semibold">Projects</h2></div><span class="badge badge-neutral">{data.projects.length}</span></div>
    {#if data.projects.length}
      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {#each data.projects as project}
          <a class="surface block p-5 transition-colors hover:border-primary focus:outline-2 focus:outline-primary" href={`/projects/${project.id}`}>
            <div class="mb-3 flex items-start justify-between gap-3"><strong>{project.name}</strong><span class={`badge badge-sm ${statusClass(project.status)}`}>{project.status}</span></div>
            <p class="mb-5 text-sm leading-6 muted">{project.prompt.length > 130 ? `${project.prompt.slice(0,127)}…` : project.prompt}</p>
            <small class="muted">{project.slug}</small>
          </a>
        {/each}
      </div>
    {:else}<div class="surface p-10 text-center muted">Your first application will appear here.</div>{/if}
  </section>
</section>
