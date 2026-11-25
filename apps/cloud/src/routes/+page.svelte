<script lang="ts">
  import { enhance } from '$app/forms';
  import { ArrowUp, GitBranch, Cloud, Database, Settings2, LoaderCircle, Sparkles } from '@lucide/svelte';
  import { DAISY_THEME_CHOICES } from '#lib/themes';
  let { data, form } = $props();

  let prompt = $state('');
  let submitting = $state(false);
  const ideas = [
    { label: 'Solar installer CRM', text: 'A CRM for a solar installer with leads, site surveys, quotes, installation milestones, invoices, and a client login to track progress.' },
    { label: 'Clinic bookings', text: 'An appointment system for a small clinic: practitioners, patients, bookable slots, reminders, and a daily schedule view for reception.' },
    { label: 'Equipment loans', text: 'Track company equipment loans: inventory with serial numbers, who has what, due dates, overdue alerts, and a return checklist.' },
    { label: 'Book club', text: 'A book club app with members, a reading schedule, meeting RSVPs, book votes, and discussion notes for each meeting.' },
  ];
  const providerIcons = { github: GitBranch, vercel: Cloud, neon: Database };
  const tone = (status: string) => ['ready', 'completed'].includes(status) ? 'is-ready' : status === 'failed' ? 'is-failed' : ['queued', 'generating', 'delivering', 'running'].includes(status) ? 'is-busy' : '';
  const ago = (iso: string) => {
    const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (minutes < 1440) return `${Math.round(minutes / 60)}h ago`;
    return new Date(iso).toLocaleDateString();
  };
</script>

<svelte:head><title>Projects · Mosaic Cloud</title><meta name="description" content="Describe an app and Mosaic plans, builds, and deploys it." /></svelte:head>

<section class="hero-glow -mx-4 -mt-8 px-4 pb-4 pt-10 md:-mt-12 md:pt-16">
  <div class="mx-auto max-w-3xl text-center">
    <span class="chip mb-5"><Sparkles size={14} class="text-primary" /> {data.organization?.name ?? 'AI app builder on Mosaic'}</span>
    <h1 class="page-title mb-4">What do you want to build?</h1>
    <p class="mx-auto mb-8 max-w-xl text-base leading-7 muted">Describe it in plain words. Mosaic plans the pages and data, writes a real SvelteKit app, and shows it live while it builds.</p>
  </div>

  <form method="POST" action="?/create" class="surface-raised mx-auto max-w-3xl p-2 text-left"
    use:enhance={() => { submitting = true; return async ({ update }) => { await update(); submitting = false; }; }}>
    <label class="sr-only" for="prompt">Describe your app</label>
    <textarea class="block min-h-32 w-full resize-none rounded-xl bg-transparent px-4 pt-4 text-base leading-7 outline-none placeholder:text-base-content/40"
      id="prompt" name="prompt" bind:value={prompt} required minlength="10"
      placeholder="A customer portal for a solar installer with leads, quotes, installation milestones and invoices…"
      onkeydown={(event) => { if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) event.currentTarget.form?.requestSubmit(); }}></textarea>

    <div class="flex flex-wrap items-center gap-2 border-t border-base-300 px-2 pt-2">
      <label class="sr-only" for="name">Project name</label>
      <input class="input input-sm input-ghost w-44 focus:bg-base-200" id="name" name="name" placeholder="Project name (optional)" maxlength="60" />
      <details class="dropdown">
        <summary class="btn btn-ghost btn-sm gap-1.5 font-normal muted"><Settings2 size={15} /> Options</summary>
        <div class="dropdown-content z-20 mt-2 w-80 space-y-3 rounded-box border border-base-300 bg-base-100 p-4 shadow-lg">
          <label class="block text-xs font-medium">Framework<select class="select select-sm select-bordered mt-1 w-full" name="appFramework"><option value="sveltekit">SvelteKit</option><option disabled>Next.js (planned)</option><option disabled>Astro (planned)</option></select></label>
          <label class="block text-xs font-medium">Components<select class="select select-sm select-bordered mt-1 w-full" name="uiSystem"><option value="daisyui">DaisyUI</option><option value="mosaic">Mosaic native</option></select></label>
          <label class="block text-xs font-medium">Theme<select class="select select-sm select-bordered mt-1 w-full" name="uiTheme">{#each DAISY_THEME_CHOICES as theme}<option value={theme.value}>{theme.label}</option>{/each}</select></label>
          <div class="flex gap-5 pt-1 text-sm">
            <label class="flex cursor-pointer items-center gap-2"><input class="checkbox checkbox-xs checkbox-primary" name="includeHome" type="checkbox" checked /> Homepage</label>
            <label class="flex cursor-pointer items-center gap-2"><input class="checkbox checkbox-xs checkbox-primary" name="includeLogin" type="checkbox" checked /> Sign-in</label>
          </div>
        </div>
      </details>
      <span class="ml-auto hidden text-xs muted sm:inline">Ctrl + Enter</span>
      <button class="btn btn-primary btn-sm btn-circle" type="submit" disabled={submitting || prompt.trim().length < 10} aria-label="Create project">
        {#if submitting}<LoaderCircle size={16} class="animate-spin" />{:else}<ArrowUp size={16} />{/if}
      </button>
    </div>
  </form>
  {#if form?.message}<div class="alert alert-error mx-auto mt-4 max-w-3xl text-sm" role="alert">{form.message}</div>{/if}

  <div class="mx-auto mt-5 flex max-w-3xl flex-wrap justify-center gap-2">
    {#each ideas as idea}<button class="chip" type="button" onclick={() => { prompt = idea.text; document.getElementById('prompt')?.focus(); }}>{idea.label}</button>{/each}
  </div>

  {#if data.organization}
  <div class="mx-auto mt-6 flex max-w-3xl flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs muted">
    {#each ['github', 'vercel', 'neon'] as provider}
      {@const connection = data.connections.find((item) => item.provider === provider)}
      {@const Icon = providerIcons[provider as keyof typeof providerIcons]}
      <span class="inline-flex items-center gap-1.5"><Icon size={13} /> <span>{({ github: 'GitHub', vercel: 'Vercel', neon: 'Neon' } as Record<string, string>)[provider]}</span> <span class={`status-dot ${connection ? 'is-ready' : ''}`}></span></span>
    {/each}
    <a class="link link-hover text-primary" href="/settings/connections">{data.connections.length ? 'Manage connections' : 'Connect providers (optional)'}</a>
  </div>
  {/if}
</section>

{#if data.organization}
<section class="mt-14">
  <div class="mb-4 flex items-baseline justify-between">
    <h2 class="text-lg font-semibold">Your projects</h2>
    {#if data.projects.length}<span class="text-sm muted">{data.projects.length} {data.projects.length === 1 ? 'project' : 'projects'}</span>{/if}
  </div>
  {#if data.projects.length}
    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {#each data.projects as project}
        <a class="surface group flex flex-col p-4 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md" href={`/projects/${project.id}`}>
          <div class="mb-3 grid h-24 place-items-center rounded-lg bg-gradient-to-br from-primary/10 via-base-200 to-accent/10 text-2xl font-bold text-primary/70">{project.name.slice(0, 1).toUpperCase()}</div>
          <div class="flex items-center justify-between gap-3"><strong class="truncate">{project.name}</strong><span class="flex shrink-0 items-center gap-1.5 text-xs muted"><span class={`status-dot ${tone(project.status)}`}></span>{project.status}</span></div>
          <p class="mb-3 mt-1 line-clamp-2 text-sm leading-6 muted">{project.prompt}</p>
          <small class="mt-auto muted">Edited {ago(project.updated_at)}</small>
        </a>
      {/each}
    </div>
  {:else}
    <div class="surface grid place-items-center gap-2 p-12 text-center"><Sparkles size={22} class="text-primary" /><p class="mb-0 font-medium">No projects yet</p><p class="mb-0 text-sm muted">Describe an app above, or start from one of the ideas.</p></div>
  {/if}
</section>
{/if}
