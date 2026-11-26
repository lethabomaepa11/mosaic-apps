<script lang="ts">
  import { enhance } from '$app/forms';
  import { page } from '$app/state';
  import { invalidateAll } from '$app/navigation';
  import { onMount, tick } from 'svelte';
  import { ArrowLeft, ArrowUp, ExternalLink, Download, RotateCw, LoaderCircle, Sparkles, CircleAlert, Check, Globe, GitBranch, Database, Cloud, Monitor, Smartphone } from '@lucide/svelte';
  import { DAISY_THEME_CHOICES } from '#lib/themes';
  let { data, form } = $props();

  type Tab = 'preview' | 'blueprint' | 'source' | 'settings';
  let tab = $state<Tab>('preview');
  $effect(() => {
    if (page.url.searchParams.get('tab') === 'source') {
      tab = 'source';
      pane = 'app';
    }
  });
  let device = $state<'desktop' | 'mobile'>('desktop');
  // Phones show one pane at a time; desktop shows both side by side.
  let pane = $state<'chat' | 'app'>('chat');
  let reloads = $state(0);
  let sending = $state(false);
  let thread = $state<HTMLElement>();
  let deleteDialog = $state<HTMLDialogElement>();
  let deleteConfirmation = $state('');
  let deleteChoices = $state<string[]>([]);
  let deleting = $state(false);
  let credentials = $state<{ email: string; password: string }>();
  let credentialsError = $state('');

  async function revealCredentials() {
    if (credentials) { credentials = undefined; return; }
    credentialsError = '';
    try {
      const response = await fetch(`/projects/${data.project.id}/credentials`, { method: 'POST' });
      if (!response.ok) throw new Error('App credentials are unavailable.');
      credentials = await response.json();
    } catch {
      credentialsError = 'Could not load the initial app sign-in.';
    }
  }

  let preview = $derived(data.environments.find((environment) => environment.kind === 'preview'));
  let previewBase = $derived(`/preview/${data.project.slug}`);
  let previewView = $state<'app' | 'login' | 'studio'>('app');
  let iframeUrl = $derived(`${previewBase}${previewView === 'app' ? '' : `/${previewView}`}`);
  let waitingJob = $derived(data.jobs.find((job) => job.status === 'waiting_input'));
  let busy = $derived(!waitingJob && data.jobs.some((job) => ['queued', 'running'].includes(job.status)));
  let activeJob = $derived(data.jobs.find((job) => job.status === 'running')
    ?? (busy ? data.jobs.findLast((job) => job.status === 'queued') : data.jobs.find((job) => job.status === 'failed')));
  let hasPreview = $derived(Boolean(data.releases.length || data.generation?.completed));
  const agentTone: Record<string, string> = { Planner: 'bg-info/15 text-info', Developer: 'bg-primary/15 text-primary', Verifier: 'bg-success/15 text-success', Reviewer: 'bg-warning/15 text-warning' };
  let composer = $state<HTMLTextAreaElement>();
  // Chips build one combined answer in the composer; "Decide for me" sends straight away.
  const addAnswer = (question: string, option: string) => {
    if (!composer) return;
    const line = `${question.replace(/\?$/, '')}: ${option}`;
    composer.value = composer.value.trim() ? `${composer.value.trim()}\n${line}` : line;
    composer.focus();
  };
  const sendNow = (text: string) => { if (!composer) return; composer.value = text; composer.form?.requestSubmit(); };
  let production = $derived(data.environments.find((environment) => environment.kind === 'production'));
  let liveUrl = $derived(production?.status === 'ready' ? production.url?.replace(/\/$/, '') : undefined);
  let canRevealCredentials = $derived(Boolean(liveUrl && ['owner', 'admin'].includes(data.project.role)));
  let appUrl = $derived(liveUrl ?? preview?.url);
  let apiUrl = $derived(appUrl ? `${appUrl}/api/health` : undefined);
  let copied = $state('');
  const copy = async (value: string) => { await navigator.clipboard.writeText(value).catch(() => {}); copied = value; setTimeout(() => (copied = ''), 1500); };
  const tone = (status: string) => ['ready', 'completed', 'connected'].includes(status) ? 'is-ready' : ['failed', 'delete_failed'].includes(status) ? 'is-failed' : ['queued', 'running', 'generating', 'delivering', 'building', 'deleting'].includes(status) ? 'is-busy' : '';
  const jobTitle: Record<string, string> = { generate: 'Building your app', deliver: 'Delivering to your providers', 'vercel-status': 'Deploying on Vercel', delete: 'Deleting selected resources', upgrade: 'Upgrading the framework' };
  const deleteOptions = $derived([
    { provider: 'github', label: 'GitHub repository', target: data.project.github_repository },
    { provider: 'vercel', label: 'Vercel project and deployments', target: data.project.vercel_project_id },
    { provider: 'neon', label: 'Neon project, including all databases and branches', target: data.project.neon_project_id },
  ].filter((item) => item.target));
  const tabs: Array<{ id: Tab; label: string }> = [{ id: 'preview', label: 'Preview' }, { id: 'blueprint', label: 'Blueprint' }, { id: 'source', label: 'Source & delivery' }, { id: 'settings', label: 'Settings' }];

  onMount(() => { const timer = setInterval(() => { if (busy) void invalidateAll(); }, 2000); return () => clearInterval(timer); });
  $effect(() => { void data.messages.length; void activeJob?.stage; void tick().then(() => thread?.scrollTo({ top: thread.scrollHeight, behavior: 'smooth' })); });
</script>

<svelte:head><title>{data.project.name} · Mosaic Cloud</title></svelte:head>

<div class="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] overflow-hidden lg:grid-cols-[400px_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)]">
  <div class="flex gap-1 border-b border-base-300 bg-base-100 p-1.5 lg:hidden" role="tablist" aria-label="Builder panes">
    <button class="tab-link flex-1" type="button" role="tab" aria-selected={pane === 'chat'} onclick={() => (pane = 'chat')}>Chat{#if busy}<span class="status-dot is-busy ml-1.5"></span>{/if}</button>
    <button class="tab-link flex-1" type="button" role="tab" aria-selected={pane === 'app'} onclick={() => (pane = 'app')}>Preview</button>
  </div>
  <!-- Conversation -->
  <aside class={`min-h-0 flex-col overflow-hidden border-base-300 bg-base-100 lg:flex lg:border-r ${pane === 'chat' ? 'flex' : 'hidden'}`}>
    <div class="flex items-center gap-2 border-b border-base-300 px-3 py-2.5">
      <a class="btn btn-ghost btn-sm btn-square" href="/" aria-label="Back to projects"><ArrowLeft size={16} /></a>
      <div class="min-w-0 flex-1"><h1 class="truncate text-sm font-semibold">{data.project.name}</h1><p class="mb-0 flex items-center gap-1.5 text-xs muted"><span class={`status-dot ${tone(data.project.status)}`}></span>{data.project.status}</p></div>
    </div>

    <div class="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-5" bind:this={thread}>
      {#each data.messages as message}
        {#if message.role === 'user'}
          <div class="ml-10 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-2xl rounded-tr-md bg-primary px-4 py-2.5 text-sm leading-6 text-primary-content shadow-sm">{message.content}</div>
        {:else}
          <div class="flex gap-2.5"><span class="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary to-violet-500 text-primary-content"><Sparkles size={13} /></span><div class="min-w-0 rounded-2xl rounded-tl-md bg-base-200 px-4 py-2.5 text-sm leading-6">{message.content}</div></div>
        {/if}
      {/each}

      {#if data.generation?.features}
        <div class="ml-9 rounded-xl border border-base-300 bg-base-100 p-3.5 text-sm">
          <div class="mb-2 flex items-center justify-between gap-2"><span class="font-medium">Feature plan</span><button class="link link-hover text-xs text-primary" type="button" onclick={() => { tab = 'blueprint'; pane = 'app'; }}>View spec</button></div>
          <ol class="space-y-1.5">
            {#each data.generation.features as feature, index}
              <li class="flex items-center gap-2">
                {#if index < (data.generation.completed ?? 0)}<Check size={14} class="shrink-0 text-success" aria-label="In preview" />{:else}<span class="status-dot shrink-0"></span>{/if}
                {feature.name}
              </li>
            {/each}
          </ol>
        </div>
      {:else if data.project.blueprint}
        {@const plan = data.project.blueprint}
        <div class="ml-9 rounded-xl border border-base-300 bg-base-100 p-3.5 text-sm">
          <div class="mb-2 flex items-center justify-between"><span class="font-medium">Plan</span><button class="link link-hover text-xs text-primary" type="button" onclick={() => (tab = 'blueprint')}>Full blueprint</button></div>
          <p class="section-label mb-1">Pages</p>
          <ul class="mb-3 space-y-1">{#each plan.routes.slice(0, 6) as route}<li class="flex gap-2"><code class="shrink-0 text-xs font-semibold">{route.path}</code><span class="truncate text-xs muted">{route.purpose}</span></li>{/each}{#if plan.routes.length > 6}<li class="text-xs muted">+{plan.routes.length - 6} more</li>{/if}</ul>
          {#if plan.entities.length}<p class="section-label mb-1">Data</p><div class="flex flex-wrap gap-1">{#each plan.entities as entity}<span class="badge badge-sm badge-ghost">{entity.name}</span>{/each}</div>{/if}
        </div>
      {/if}

      {#if waitingJob}
        <div class="ml-9 rounded-xl border border-primary/30 bg-primary/5 p-3.5 text-sm">
          <p class="mb-2 font-medium">A few quick questions</p>
          <div class="space-y-3">
            {#each waitingJob.questions ?? [] as item}
              <div><p class="mb-1.5">{item.question}</p><div class="flex flex-wrap gap-1.5">{#each item.options as option}<button class="chip !py-1 text-xs" type="button" onclick={() => addAnswer(item.question, option)}>{option}</button>{/each}</div></div>
            {/each}
          </div>
          <div class="mt-3 flex flex-wrap items-center gap-2 border-t border-primary/15 pt-3">
            <button class="btn btn-primary btn-xs" type="button" onclick={() => sendNow('Decide everything sensibly yourself and build it.')}>Decide for me</button>
            <span class="text-xs muted">or pick answers above / type your own below</span>
          </div>
        </div>
      {/if}

      {#if activeJob}
        <div class={`rounded-xl border p-3.5 text-sm ${activeJob.status === 'failed' ? 'border-error/30 bg-error/5' : 'border-base-300 bg-base-100'}`}>
          <div class="flex items-center gap-2 font-medium">
            {#if activeJob.status === 'failed'}<CircleAlert size={15} class="text-error" />{:else}<LoaderCircle size={15} class="animate-spin text-primary" />{/if}
            {jobTitle[activeJob.kind] ?? activeJob.kind}
            <span class="ml-auto text-xs font-normal muted">{activeJob.progress}%</span>
          </div>
          {#if activeJob.status !== 'failed'}<progress class="progress progress-primary mt-2.5 h-1.5 w-full" value={activeJob.progress} max="100"></progress>{/if}
          {#if activeJob.log.length}
            <!-- Live thinking: what each agent is working on right now. -->
            <ol class="mt-3 space-y-2">
              {#each activeJob.log.slice(-8) as entry, index}
                {@const last = index === Math.min(activeJob.log.length, 8) - 1}
                <li class="flex items-start gap-2 text-xs">
                  <span class="mt-0.5 shrink-0">{#if last && activeJob.status !== 'completed'}{#if activeJob.status === 'failed'}<CircleAlert size={12} class="text-error" />{:else}<LoaderCircle size={12} class="animate-spin muted" />{/if}{:else}<Check size={12} class="text-success" />{/if}</span>
                  <span class="min-w-0">{#if entry.agent}<span class={`mr-1.5 inline-block rounded px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide ${agentTone[entry.agent] ?? 'bg-base-200'}`}>{entry.agent}</span>{/if}<span class={last ? '' : 'muted'}>{entry.message}</span></span>
                </li>
              {/each}
            </ol>
          {:else}<p class="mb-0 mt-2 text-xs muted">{activeJob.stage ?? 'Waiting to start…'}</p>{/if}
          {#if activeJob.status === 'failed'}
            <form method="POST" action="?/retry" use:enhance class="mt-3"><input type="hidden" name="jobId" value={activeJob.id} /><button class="btn btn-sm btn-outline" type="submit"><RotateCw size={14} /> Try again</button></form>
          {/if}
        </div>
      {/if}
      {#if canRevealCredentials}
        <div class="rounded-xl border border-success/25 bg-success/5 p-3.5 text-sm" aria-label="Deployment sign-in">
          <p class="font-semibold">Your app is live</p>
          <p class="mt-1 text-xs muted">Use your generated administrator account to sign in for the first time.</p>
          <button class="btn btn-outline btn-xs mt-2" type="button" onclick={() => { tab = 'source'; pane = 'app'; }}>View admin sign-in</button>
        </div>
      {/if}
    </div>

    <form method="POST" action="?/iterate" class="border-t border-base-300 p-3"
      use:enhance={() => { sending = true; return async ({ update }) => { await update(); sending = false; }; }}>
      {#if form?.message}<div class="alert alert-error mb-2 py-2 text-sm" role="alert">{form.message}</div>{/if}
      <div class="rounded-xl border border-base-300 bg-base-100 p-1.5 shadow-sm transition focus-within:border-primary/50 focus-within:ring-4 focus-within:ring-primary/10">
        <label class="sr-only" for="prompt">What should Mosaic change?</label>
        <textarea class="block max-h-48 min-h-16 w-full resize-none bg-transparent px-2.5 py-1.5 text-sm leading-6 outline-none placeholder:text-base-content/40" id="prompt" name="prompt" required minlength="3" bind:this={composer}
          placeholder={waitingJob ? 'Answer the questions, or tell me to decide…' : busy ? 'Mosaic is working. Queue your next change…' : 'Ask for a change: add an approvals dashboard…'}
          onkeydown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }}></textarea>
        <div class="flex items-center justify-between px-1"><span class="text-[11px] muted">Enter to send · Shift+Enter for a new line</span><button class="btn btn-primary btn-sm btn-circle" type="submit" disabled={sending} aria-label="Send change">{#if sending}<LoaderCircle size={15} class="animate-spin" />{:else}<ArrowUp size={15} />{/if}</button></div>
      </div>
    </form>
  </aside>

  <!-- Workspace -->
  <section class={`min-h-0 min-w-0 flex-col overflow-hidden lg:flex ${pane === 'app' ? 'flex' : 'hidden'}`}>
    <div class="flex flex-wrap items-center gap-2 border-b border-base-300 bg-base-100 px-3 py-2">
      <div class="-mx-1 flex min-w-0 gap-0.5 overflow-x-auto px-1 whitespace-nowrap" role="tablist" aria-label="Workspace views">
        {#each tabs as item}<button class="tab-link" type="button" role="tab" aria-selected={tab === item.id} onclick={() => (tab = item.id)}>{item.label}</button>{/each}
      </div>
      {#if tab === 'preview'}
        <div class="ml-auto flex min-w-0 flex-wrap items-center gap-1" aria-label="Preview controls">
          {#if hasPreview}
            <button class={`btn btn-sm ${previewView === 'app' ? 'btn-primary' : 'btn-outline'}`} type="button" aria-pressed={previewView === 'app'} onclick={() => (previewView = 'app')}>App</button>
            <button class={`btn btn-sm ${previewView === 'login' ? 'btn-primary' : 'btn-outline'}`} type="button" aria-pressed={previewView === 'login'} onclick={() => (previewView = 'login')}>Sign in</button>
            <button class={`btn btn-sm ${previewView === 'studio' ? 'btn-primary' : 'btn-outline'}`} type="button" aria-pressed={previewView === 'studio'} onclick={() => (previewView = 'studio')}>Open Studio</button>
          {/if}
          {#if liveUrl}<a class="btn btn-outline btn-sm" href={liveUrl} target="_blank" rel="noreferrer"><Globe size={14} /> Live app</a>{/if}
          <div class="join hidden sm:flex"><button class={`btn btn-ghost btn-sm join-item btn-square ${device === 'desktop' ? 'btn-active' : ''}`} type="button" aria-label="Desktop width" aria-pressed={device === 'desktop'} onclick={() => (device = 'desktop')}><Monitor size={15} /></button><button class={`btn btn-ghost btn-sm join-item btn-square ${device === 'mobile' ? 'btn-active' : ''}`} type="button" aria-label="Phone width" aria-pressed={device === 'mobile'} onclick={() => (device = 'mobile')}><Smartphone size={15} /></button></div>
          <button class="btn btn-ghost btn-sm btn-square" type="button" aria-label="Reload preview" onclick={() => reloads++}><RotateCw size={15} /></button>
          {#if preview?.url && hasPreview}<a class="btn btn-ghost btn-sm btn-square" href={iframeUrl} target="_blank" rel="noreferrer" aria-label="Open preview in new tab"><ExternalLink size={15} /></a>{/if}
        </div>
      {/if}
    </div>

    <div class="min-h-0 flex-1 overflow-auto overscroll-contain bg-base-200">
      {#if tab === 'preview'}
        <div class={`mx-auto h-full p-3 transition-all ${device === 'mobile' ? 'max-w-[400px]' : ''}`}>
          <div class="relative h-full overflow-hidden rounded-xl border border-base-300 bg-white shadow-sm">
            {#if preview?.url && hasPreview}
              {#key `${iframeUrl}#${data.generation?.completed ?? 0}#${data.releases[0]?.version ?? 0}#${data.project.ui_theme}#${reloads}`}<iframe class="absolute inset-0 h-full w-full" src={iframeUrl} title={`${data.project.name} preview`}></iframe>{/key}
            {:else}
              {#if activeJob?.status === 'failed'}
                <div class="absolute inset-0 grid place-items-center p-8 text-center"><div class="max-w-sm"><div class="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-error/10 text-error"><CircleAlert size={22} /></div><p class="mb-1 font-medium">The build stopped</p><p class="mb-4 text-sm muted">{activeJob.error}</p><form method="POST" action="?/retry" use:enhance><input type="hidden" name="jobId" value={activeJob.id} /><button class="btn btn-primary btn-sm" type="submit"><RotateCw size={14} /> Try again</button></form></div></div>
              {:else if waitingJob}
                <div class="absolute inset-0 grid place-items-center p-8 text-center"><p class="text-sm muted">Answer in Chat to continue planning your app.</p></div>
              {:else}
                <div class="absolute inset-0 grid place-items-center p-8 text-center"><div><div class="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary"><LoaderCircle size={22} class="animate-spin" /></div><p class="mb-1 font-medium">Your app is taking shape</p><p class="mb-0 text-sm muted">{activeJob?.stage ?? 'Planning pages and data…'}</p></div></div>
              {/if}
            {/if}
            {#if busy && hasPreview}<div class="absolute bottom-3 right-3 flex items-center gap-2 rounded-full bg-neutral/85 px-3 py-1.5 text-xs text-neutral-content shadow-lg backdrop-blur"><LoaderCircle size={12} class="animate-spin" /> Updating…</div>{/if}
          </div>
        </div>

      {:else if tab === 'blueprint'}
        <div class="mx-auto max-w-4xl space-y-5 p-5 md:p-8">
          {#if data.generation?.spec}
            <section class="rounded-xl border border-base-300 bg-base-100 p-5">
              <h2 class="mb-3 text-xl font-semibold">Refined specification</h2>
              <div class="whitespace-pre-wrap break-words text-sm leading-6">{data.generation.spec}</div>
            </section>
            {#if data.generation.features}
              <section class="rounded-xl border border-base-300 bg-base-100 p-5">
                <h2 class="mb-3 text-xl font-semibold">Build order</h2>
                <ol class="list-decimal space-y-4 pl-5 text-sm">
                  {#each data.generation.features as feature}
                    <li><h3 class="font-semibold">{feature.name}</h3><p class="muted">{feature.scope}</p>
                      <ul class="my-1 list-disc pl-5">{#each feature.acceptance as check}<li>{check}</li>{/each}</ul>
                    </li>
                  {/each}
                </ol>
              </section>
            {/if}
          {/if}
          {#if data.project.blueprint}
            <div class="flex flex-wrap items-start justify-between gap-3"><div><p class="section-label">Blueprint</p><h2 class="text-xl font-semibold">What Mosaic is building</h2></div>{#if data.project.planner_model}<span class="chip">Planned by {data.project.planner_model}</span>{/if}</div>
            <p class="max-w-3xl leading-7 muted">{data.project.blueprint.summary}</p>
            <div class="grid gap-5 lg:grid-cols-2">
              <div class="surface overflow-hidden"><h3 class="border-b border-base-300 px-4 py-3 text-sm font-semibold">Pages <span class="font-normal muted">· {data.project.blueprint.routes.length}</span></h3><ul class="divide-y divide-base-300">{#each data.project.blueprint.routes as route}<li class="flex items-start justify-between gap-4 px-4 py-3"><div class="min-w-0"><code class="text-sm font-semibold">{route.path}</code><p class="mb-0 mt-0.5 text-sm muted">{route.purpose}</p></div><span class="badge badge-sm badge-ghost whitespace-nowrap">{route.access}</span></li>{/each}</ul></div>
              <div class="surface overflow-hidden"><h3 class="border-b border-base-300 px-4 py-3 text-sm font-semibold">Data <span class="font-normal muted">· {data.project.blueprint.entities.length}</span></h3>{#if data.project.blueprint.entities.length}<ul class="divide-y divide-base-300">{#each data.project.blueprint.entities as entity}<li class="px-4 py-3"><div class="text-sm font-semibold">{entity.name}</div><p class="mb-2 mt-0.5 text-sm muted">{entity.purpose}</p><div class="flex flex-wrap gap-1">{#each entity.fields as field}<span class="badge badge-sm badge-outline font-mono">{field}</span>{/each}</div></li>{/each}</ul>{:else}<p class="mb-0 p-4 text-sm muted">No stored business data was needed.</p>{/if}</div>
            </div>
            {#if data.project.blueprint.roles.length || data.project.blueprint.workflows.length}
              <div class="grid gap-5 lg:grid-cols-2">
                {#if data.project.blueprint.roles.length}<div class="surface p-4"><h3 class="mb-2 text-sm font-semibold">Roles</h3><div class="flex flex-wrap gap-1.5">{#each data.project.blueprint.roles as role}<span class="badge badge-ghost">{role}</span>{/each}</div></div>{/if}
                {#if data.project.blueprint.workflows.length}<div class="surface p-4"><h3 class="mb-2 text-sm font-semibold">Workflows</h3><ul class="mb-0 list-disc space-y-1 pl-4 text-sm muted">{#each data.project.blueprint.workflows as workflow}<li>{workflow}</li>{/each}</ul></div>{/if}
              </div>
            {/if}
          {:else}
            <div class="surface grid place-items-center gap-2 p-12 text-center"><LoaderCircle size={20} class="animate-spin text-primary" /><p class="mb-0 text-sm muted">Mosaic is planning the pages and data…</p></div>
          {/if}
        </div>

      {:else if tab === 'source'}
        {#if data.upgradeAvailable || (form?.upgradeQueued && busy) || form?.upgradeMessage}
          <div class="surface mb-3 space-y-2 p-4">
            {#if data.upgradeAvailable}
              <h3 class="text-sm font-semibold">Framework update available</h3>
              <p class="text-sm muted">Push the latest framework files to GitHub main. Your app data and published Studio changes stay in place.</p>
              <form method="POST" action="?/upgrade" use:enhance><button class="btn btn-primary btn-sm" disabled={busy || Boolean(waitingJob)}>Upgrade framework and push to main</button></form>
            {/if}
            {#if form?.upgradeQueued && busy}<p class="text-sm muted" role="status">Upgrade queued. Follow the GitHub push in Activity.</p>{/if}
            {#if form?.upgradeMessage}<p class="text-sm text-error" role="alert">{form.upgradeMessage}</p>{/if}
          </div>
        {/if}
        <div class="mx-auto grid max-w-4xl gap-5 p-5 md:p-8">
          <div class="surface overflow-hidden">
            <h3 class="border-b border-base-300 px-4 py-3 text-sm font-semibold">Endpoints</h3>
            <dl class="divide-y divide-base-300">
              {#each [{ label: 'App URL', value: appUrl }, { label: 'API URL', value: apiUrl }] as endpoint}
                <div class="flex items-center gap-3 px-4 py-3 text-sm"><dt class="w-20 shrink-0 muted">{endpoint.label}</dt><dd class="min-w-0 flex-1 truncate font-mono text-xs">{endpoint.value ?? 'Preparing…'}</dd>{#if endpoint.value}<button class="btn btn-ghost btn-xs" type="button" onclick={() => copy(endpoint.value!)}>{copied === endpoint.value ? 'Copied' : 'Copy'}</button><a class="btn btn-ghost btn-xs btn-square" href={endpoint.value} target="_blank" rel="noreferrer" aria-label={`Open ${endpoint.label}`}><ExternalLink size={13} /></a>{/if}</div>
              {/each}
            </dl>
            <p class="mb-0 border-t border-base-300 px-4 py-2.5 text-xs muted">{preview?.kind === 'production' ? 'Live on your Vercel account.' : 'Mosaic-hosted preview. Connect Vercel to deploy to your own account.'}</p>
          </div>
          <div class="surface overflow-hidden">
            <div class="flex items-center justify-between border-b border-base-300 px-4 py-3"><h3 class="text-sm font-semibold">Releases</h3>{#if data.releases.length}<a class="btn btn-primary btn-sm" href={`/projects/${data.project.id}/download`}><Download size={14} /> Download latest</a>{/if}</div>
            {#if data.releases.length}
              <ul class="divide-y divide-base-300">{#each data.releases as release, index}<li class="flex items-center justify-between gap-3 px-4 py-3 text-sm"><div><strong>v{release.version}</strong>{#if index === 0}<span class="badge badge-sm badge-primary badge-soft ml-2">latest</span>{/if}<p class="mb-0 mt-0.5 text-xs muted">{release.file_count} files · <span class="font-mono">{release.checksum.slice(0, 10)}</span> · {new Date(release.created_at).toLocaleString()}</p></div></li>{/each}</ul>
            {:else}<p class="mb-0 p-4 text-sm muted">The first release appears once generation finishes.</p>{/if}
          </div>
          <div class="grid gap-4 sm:grid-cols-3">
            <div class="surface p-4"><div class="mb-2 flex items-center gap-2 text-sm font-semibold"><GitBranch size={15} /> GitHub</div>{#if data.project.github_repository}<a class="link link-hover break-all text-sm" href={`https://github.com/${data.project.github_repository}`} target="_blank" rel="noreferrer">{data.project.github_repository}</a>{:else}<p class="mb-0 text-sm muted">No repository yet</p>{/if}</div>
            <div class="surface p-4"><div class="mb-2 flex items-center gap-2 text-sm font-semibold"><Cloud size={15} /> Vercel</div>{#if production?.url}<a class="link link-hover break-all text-sm" href={production.url} target="_blank" rel="noreferrer">{production.url.replace('https://', '')}</a>{:else}<p class="mb-0 flex items-center gap-1.5 text-sm muted"><span class={`status-dot ${tone(production?.status ?? '')}`}></span>{!production || production.status === 'not_configured' ? 'No deployment yet' : production.status.replaceAll('_', ' ')}</p>{/if}</div>
            <div class="surface p-4"><div class="mb-2 flex items-center gap-2 text-sm font-semibold"><Database size={15} /> Database</div><p class="mb-0 text-sm muted">{data.project.neon_project_id ? 'Neon PostgreSQL provisioned' : 'Not provisioned'}</p></div>
          </div>
          <div class="flex flex-wrap items-center gap-3">
            {#if data.releases.length && ['owner', 'admin'].includes(data.project.role)}
              <form method="POST" action="?/deliver" use:enhance><button class="btn btn-primary btn-sm" disabled={busy}>Deliver latest</button></form>
            {/if}
            <a class="link link-primary text-sm" href="/settings/connections">Manage connections</a>
          </div>
          {#if !data.project.neon_project_id}<p class="text-sm muted">Vercel delivery requires a Neon connection to provision PostgreSQL.</p>{/if}
          {#if form?.deliveryMessage}<div class="alert alert-error text-sm" role="alert">{form.deliveryMessage}</div>{/if}
          {#if form?.deliveryQueued}<p class="text-sm muted" role="status">Delivery queued. Follow its progress in the activity feed.</p>{/if}
          {#if canRevealCredentials}
            <div class="surface space-y-2 p-4">
              <h3 class="text-sm font-semibold">Administrator sign-in</h3>
              <div class="flex flex-wrap items-center gap-2">
                <a class="btn btn-primary btn-sm" href={`${liveUrl}/login`} target="_blank" rel="noreferrer">Open sign-in page</a>
                <button class="btn btn-outline btn-sm" type="button" onclick={revealCredentials}>{credentials ? 'Hide initial app sign-in' : 'Reveal initial app sign-in'}</button>
              </div>
              {#if credentials}
                <p class="mb-0 flex flex-wrap items-center gap-2 text-sm">Email <code>{credentials.email}</code> <button class="btn btn-ghost btn-xs" type="button" onclick={() => copy(credentials!.email)}>{copied === credentials.email ? 'Copied' : 'Copy email'}</button></p>
                <p class="mb-0 flex flex-wrap items-center gap-2 text-sm">Password <code>{credentials.password}</code> <button class="btn btn-ghost btn-xs" type="button" onclick={() => copy(credentials!.password)}>{copied === credentials.password ? 'Copied' : 'Copy password'}</button></p>
              {/if}
              {#if credentialsError}<p class="mb-0 text-sm text-error" role="alert">{credentialsError}</p>{/if}
            </div>
          {/if}
          <div class="surface overflow-hidden">
            <h3 class="border-b border-base-300 px-4 py-3 text-sm font-semibold">Activity</h3>
            {#if data.jobs.length}
              <ul class="divide-y divide-base-300">{#each data.jobs as job}<li class="px-4 py-3 text-sm"><div class="flex items-center justify-between gap-3"><span class="flex items-center gap-2"><span class={`status-dot ${tone(job.status)}`}></span>{jobTitle[job.kind] ?? job.kind}</span><span class="text-xs muted">{new Date(job.created_at).toLocaleString()}</span></div><p class={`mb-0 mt-1 text-xs ${job.error ? 'text-error' : 'muted'}`}>{job.error ?? job.stage}</p>{#if job.status === 'failed'}<form method="POST" action="?/retry" use:enhance class="mt-2"><input type="hidden" name="jobId" value={job.id} /><button class="btn btn-outline btn-xs" type="submit">Retry</button></form>{/if}{#if job.log.length}<details class="mt-1.5"><summary class="cursor-pointer text-xs muted">Log</summary><ol class="mt-1 space-y-0.5 font-mono text-[11px] muted">{#each job.log as entry}<li>{new Date(entry.at).toLocaleTimeString()} · {entry.message}</li>{/each}</ol></details>{/if}</li>{/each}</ul>
            {:else}<p class="mb-0 p-4 text-sm muted">No activity yet.</p>{/if}
          </div>
        </div>

      {:else}
        <div class="mx-auto max-w-2xl p-5 md:p-8">
          <form method="POST" action="?/settings" use:enhance class="surface space-y-5 p-5">
            <div><h2 class="text-base font-semibold">Design settings</h2><p class="mb-0 mt-1 text-sm muted">Applied to the whole app on the next build. Pages never carry their own colours.</p></div>
            <div class="grid gap-4 sm:grid-cols-3">
              <div class="block text-xs font-medium">Framework<p class="mt-2 text-sm">{data.project.app_framework === 'nextjs' ? 'Next.js' : 'SvelteKit'}</p></div>
              {#if data.project.app_framework !== 'nextjs'}
              <label class="block text-xs font-medium">Components<select class="select select-sm select-bordered mt-1 w-full" name="uiSystem" value={form?.uiSystem ?? data.project.ui_system}><option value="daisyui">DaisyUI</option><option value="mosaic">Mosaic native</option></select></label>
              {/if}
              <label class="block text-xs font-medium">Theme<select class="select select-sm select-bordered mt-1 w-full" name="uiTheme" value={form?.uiTheme ?? data.project.ui_theme}>{#each DAISY_THEME_CHOICES as theme}<option value={theme.value}>{theme.label}</option>{/each}</select></label>
            </div>
            {#if data.project.blueprint && ['owner', 'admin'].includes(data.project.role)}
              <input type="hidden" name="registrationSettings" value="1" />
              <label class="flex items-start gap-3 text-sm">
                <input class="checkbox checkbox-primary checkbox-sm mt-0.5" type="checkbox" name="allowRegistration" checked={data.project.allow_registration} />
                <span><strong>Allow public sign-up</strong><span class="block text-xs muted">Anyone with the app URL can create an account after the next release.</span></span>
              </label>
            {/if}
            <div class="flex flex-wrap gap-2 text-xs"><span class="chip">{data.project.include_home ? 'Homepage' : 'No homepage'}</span><span class="chip">{data.project.include_login ? 'Sign-in' : 'Public only'}</span><span class="chip font-mono">{data.project.slug}</span></div>
            {#if form?.settingsMessage}<div class="alert alert-error text-sm" role="alert">{form.settingsMessage}</div>{/if}
            {#if form?.settingsSaved}<div class="alert alert-success text-sm" role="status">Design settings saved.</div>{/if}
            <div class="flex justify-end"><button class="btn btn-primary btn-sm" type="submit">Save settings</button></div>
          </form>
          {#if ['owner', 'admin'].includes(data.project.role)}
            <section class="surface mt-5 flex flex-wrap items-center justify-between gap-4 p-5">
              <div><h2 class="text-base font-semibold">Delete project</h2><p class="mb-0 mt-1 text-sm muted">Permanently remove this project and its releases from Mosaic Cloud.</p></div>
              <button type="button" class="btn btn-error btn-outline btn-sm" disabled={data.project.status === 'deleting'} onclick={() => {
                deleteConfirmation = '';
                deleteChoices = [];
                deleteDialog?.showModal();
              }}>Delete project</button>
            </section>
            <dialog bind:this={deleteDialog} class="modal" aria-labelledby="delete-project-title" oncancel={(event) => { if (deleting) event.preventDefault(); }}>
              <form method="POST" action="?/delete" class="modal-box space-y-4" use:enhance={() => {
                deleting = true;
                return async ({ update }) => { try { await update({ reset: false }); } finally { deleting = false; } };
              }}>
                <h2 id="delete-project-title" class="text-lg font-semibold">Delete {data.project.name}?</h2>
                <p class="text-sm muted">This permanently removes the Cloud project, its preview, chat, and releases.</p>
                {#if deleteOptions.length}
                  <fieldset class="space-y-2">
                    <legend class="text-sm font-medium">Also permanently delete</legend>
                    {#each deleteOptions as option (option.provider)}
                      <label class="flex items-start gap-2 text-sm">
                        <input class="checkbox checkbox-error checkbox-sm mt-0.5" type="checkbox" name="deleteResources" value={option.provider} bind:group={deleteChoices} />
                        <span>{option.label}<span class="block break-all text-xs muted">{option.target}</span></span>
                      </label>
                    {/each}
                  </fieldset>
                  <p class="text-xs muted">Provider resources stay in your accounts unless you select them here.</p>
                {/if}
                <label class="block text-sm font-medium">Type <strong>{data.project.name}</strong> to confirm
                  <input class="input input-bordered mt-1 w-full" name="projectName" bind:value={deleteConfirmation} autocomplete="off" spellcheck={false} required />
                </label>
                {#if form?.deleteMessage}<div class="alert alert-error text-sm" role="alert">{form.deleteMessage}</div>{/if}
                <div class="modal-action">
                  <button type="button" class="btn btn-ghost" disabled={deleting} onclick={() => deleteDialog?.close()}>Cancel</button>
                  <button type="submit" class="btn btn-error" disabled={deleting || deleteConfirmation !== data.project.name}>{deleting ? 'Deleting…' : deleteChoices.length ? 'Delete project and selected resources' : 'Remove from Cloud'}</button>
                </div>
              </form>
            </dialog>
          {/if}
        </div>
      {/if}
    </div>
  </section>
</div>
