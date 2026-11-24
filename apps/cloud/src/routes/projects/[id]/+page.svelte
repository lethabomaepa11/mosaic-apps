<script lang="ts">
  import { DAISY_THEME_CHOICES } from '#lib/themes';
  let { data, form } = $props();
  const statusClass = (status: string) => status === 'completed' || status === 'connected' ? 'badge-success' : status === 'queued' ? 'badge-warning' : 'badge-outline';
</script>

<svelte:head><title>{data.project.name} · Mosaic Cloud</title></svelte:head>

<section class="space-y-8">
  <header>
    <a class="link link-hover text-sm muted" href="/">← Projects</a>
    <div class="mt-5 flex flex-col justify-between gap-4 md:flex-row md:items-start">
      <div class="max-w-3xl"><p class="section-label">{data.project.slug}</p><h1 class="page-title mb-3">{data.project.name}</h1><p class="muted leading-7">{data.project.prompt}</p></div>
      <span class={`badge ${statusClass(data.project.status)}`}>{data.project.status}</span>
    </div>
  </header>

  <div class="grid gap-4 md:grid-cols-3">
    <div class="surface p-5"><p class="section-label">Application</p><h3 class="mb-4 font-semibold">Defaults</h3><div class="flex flex-wrap gap-2"><span class="badge badge-outline">{data.project.include_home ? 'Homepage' : 'No homepage'}</span><span class="badge badge-outline">{data.project.include_login ? 'Login' : 'Public only'}</span><span class="badge badge-outline capitalize">{data.project.app_framework}</span><span class="badge badge-outline capitalize">{form?.uiSystem ?? data.project.ui_system}</span><span class="badge badge-outline capitalize">{form?.uiTheme ?? data.project.ui_theme}</span></div></div>
    <div class="surface p-5"><p class="section-label">GitHub</p><h3 class="font-semibold">{data.project.github_repository ?? 'Not connected'}</h3><p class="mt-2 text-sm muted">{data.project.github_repository ? 'Source repository connected.' : 'Optional source delivery.'}</p></div>
    <div class="surface p-5"><p class="section-label">Vercel</p><h3 class="font-semibold">{data.project.vercel_project_id ?? 'Not connected'}</h3><p class="mt-2 text-sm muted">{data.project.vercel_project_id ? 'Deployment project connected.' : 'Optional previews and production.'}</p></div>
  </div>

  {#if data.project.blueprint}
    <section class="surface p-5 md:p-7">
      <div class="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div><p class="section-label">Application blueprint</p><h2 class="text-2xl font-semibold">What Mosaic will build</h2></div>
        {#if data.project.planner_model}<span class="badge badge-outline">Planned by {data.project.planner_model}</span>{/if}
      </div>
      <p class="mt-4 max-w-4xl leading-7 muted">{data.project.blueprint.summary}</p>
      <div class="mt-6 grid gap-6 lg:grid-cols-2">
        <div><h3 class="mb-3 font-semibold">Routes</h3><div class="divide-y divide-base-300 rounded-box border border-base-300">{#each data.project.blueprint.routes as route}<div class="flex items-start justify-between gap-4 p-3"><div><code class="text-sm font-semibold">{route.path}</code><p class="mt-1 text-sm muted">{route.purpose}</p></div><span class="badge badge-sm badge-ghost whitespace-nowrap">{route.access}</span></div>{/each}</div></div>
        <div><h3 class="mb-3 font-semibold">Business data</h3>{#if data.project.blueprint.entities.length}<div class="divide-y divide-base-300 rounded-box border border-base-300">{#each data.project.blueprint.entities as entity}<div class="p-3"><div class="font-semibold">{entity.name}</div><p class="mt-1 text-sm muted">{entity.purpose}</p><div class="mt-2 flex flex-wrap gap-1">{#each entity.fields as field}<span class="badge badge-sm badge-outline">{field}</span>{/each}</div></div>{/each}</div>{:else}<div class="rounded-box border border-dashed border-base-300 p-5 text-sm muted">No persistent business entities were inferred.</div>{/if}</div>
      </div>
    </section>
  {/if}

  <details class="surface group p-5">
    <summary class="cursor-pointer list-none font-semibold">Application design settings <span class="float-right muted group-open:rotate-180">⌄</span></summary>
    <form method="POST" action="?/settings" class="mt-5 grid gap-4 border-t border-base-300 pt-5 sm:grid-cols-3">
      <fieldset class="fieldset"><legend class="fieldset-legend">Framework</legend><select class="select select-bordered w-full" name="appFramework"><option value="sveltekit">SvelteKit</option><option disabled>Next.js — planned</option><option disabled>Astro — planned</option></select></fieldset>
      <fieldset class="fieldset"><legend class="fieldset-legend">UI system</legend><select class="select select-bordered w-full" name="uiSystem" value={form?.uiSystem ?? data.project.ui_system}><option value="daisyui">DaisyUI</option><option value="mosaic">Mosaic native</option></select></fieldset>
      <fieldset class="fieldset"><legend class="fieldset-legend">Global theme</legend><select class="select select-bordered w-full" name="uiTheme" value={form?.uiTheme ?? data.project.ui_theme}>{#each DAISY_THEME_CHOICES as theme}<option value={theme.value}>{theme.label}</option>{/each}</select></fieldset>
      <p class="text-sm muted sm:col-span-2">Saved in PostgreSQL as project-level settings. The generation runtime applies this theme to the whole application; page content does not carry its own color copy.</p>
      <div class="flex items-end justify-end"><button class="btn btn-primary" type="submit">Save design settings</button></div>
      {#if form?.settingsMessage}<div class="alert alert-error text-sm sm:col-span-3" role="alert">{form.settingsMessage}</div>{/if}
      {#if form?.settingsSaved}<div class="alert alert-success text-sm sm:col-span-3" role="status">Design settings saved.</div>{/if}
    </form>
  </details>

  <div class="grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(300px,.75fr)]">
    <section class="surface p-5 md:p-7">
      <p class="section-label">Workspace</p><h2 class="mb-6 text-2xl font-semibold">Conversation</h2>
      <div class="mb-6 space-y-3">
        {#each data.messages as message}
          <div class="rounded-box border border-base-300 bg-base-200 p-4"><span class="badge badge-sm badge-ghost">{message.role}</span><p class="mb-0 mt-2 leading-6">{message.content}</p></div>
        {/each}
      </div>
      <form method="POST" action="?/iterate" class="space-y-4">
        <fieldset class="fieldset"><legend class="fieldset-legend">What should Mosaic change?</legend><textarea class="textarea textarea-bordered min-h-28 w-full" id="prompt" name="prompt" placeholder="Add an approvals dashboard and notify managers when a request is submitted…"></textarea></fieldset>
        {#if form?.message}<div class="alert alert-error text-sm" role="alert">{form.message}</div>{/if}
        <button class="btn btn-primary" type="submit">Queue change</button>
      </form>
    </section>

    <div class="space-y-5">
      <section class="surface p-5"><p class="section-label">Delivery</p><h2 class="mb-4 text-xl font-semibold">Environments</h2><div class="divide-y divide-base-300">{#each data.environments as environment}<div class="flex items-center justify-between gap-4 py-3"><div><strong class="text-sm">{environment.name}</strong><div class="mt-0.5 text-xs muted">{environment.url ?? environment.kind}</div></div><span class={`badge badge-sm ${statusClass(environment.status)}`}>{environment.status.replaceAll('_',' ')}</span></div>{/each}</div></section>
      <section class="surface p-5"><p class="section-label">Automation</p><h2 class="mb-4 text-xl font-semibold">Jobs</h2>{#if data.jobs.length}<ul class="divide-y divide-base-300">{#each data.jobs as job}<li class="py-3"><div class="flex items-center justify-between gap-3"><strong class="text-sm">{job.kind}</strong><span class={`badge badge-sm ${statusClass(job.status)}`}>{job.status}</span></div><div class="mt-1 text-xs muted">{job.stage ?? `${job.progress}%`}</div></li>{/each}</ul>{:else}<div class="py-6 text-center text-sm muted">No jobs yet.</div>{/if}</section>
    </div>
  </div>
</section>
