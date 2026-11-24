<script lang="ts">
  import { enhance } from '$app/forms';
  import { GitBranch, Cloud, Database, Check, KeyRound } from '@lucide/svelte';
  const icons = { github: GitBranch, vercel: Cloud, neon: Database };
  let { data, form } = $props();
  const providers = [
    { id: 'github', name: 'GitHub', description: 'A private repository in your account, with a commit for every release.', credential: 'Fine-grained access token', hint: 'All repositories · Administration, Contents: read & write', href: 'https://github.com/settings/personal-access-tokens/new' },
    { id: 'vercel', name: 'Vercel', description: 'A Vercel project in your account or team, deployed on every release.', credential: 'Access token', hint: 'Personal account scope', href: 'https://vercel.com/account/settings/tokens' },
    { id: 'neon', name: 'Neon', description: 'A PostgreSQL database in your Neon account, migrated on every release.', credential: 'API key', hint: 'Personal API key', href: 'https://console.neon.tech/app/settings/api-keys' },
  ] as const;
  let notice = $derived(form?.message ? { success: Boolean(form.success), message: form.message } : data.notice);
</script>

<svelte:head><title>Connections · Mosaic Cloud</title><meta name="description" content="Connect your GitHub, Vercel and Neon accounts to Mosaic Cloud." /></svelte:head>

<section class="mx-auto max-w-3xl space-y-6">
  <header><p class="section-label">{data.organization.name}</p><h1 class="mb-2 text-2xl font-semibold tracking-tight">Connections</h1><p class="mb-0 max-w-2xl leading-7 muted">Connect your own accounts and Mosaic creates each project's repository, deployment and database there. You own everything. Credentials are encrypted and never sent back to the browser.</p></header>
  {#if notice}<div class={`alert text-sm ${notice.success ? 'alert-success' : 'alert-error'}`} role="status">{notice.message}</div>{/if}
  <div class="space-y-3">
    {#each providers as provider}
      {@const connection = data.connections.find((item) => item.provider === provider.id)}
      {@const ProviderIcon = icons[provider.id]}
      {@const oauth = data.oauth[provider.id]}
      <article class="surface p-5">
        <div class="flex items-start gap-4">
          <span class="grid size-10 shrink-0 place-items-center rounded-xl bg-base-200"><ProviderIcon size={18} /></span>
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2"><h2 class="text-base font-semibold">{provider.name}</h2>{#if connection}<span class="badge badge-sm badge-success badge-soft gap-1"><Check size={11} /> Connected</span>{/if}</div>
            <p class="mb-0 mt-1 text-sm leading-6 muted">{connection ? `Signed in as ${connection.label}` : provider.description}</p>
          </div>
          {#if connection}
            <form method="POST" action="?/disconnect" use:enhance><input type="hidden" name="provider" value={provider.id} /><button class="btn btn-ghost btn-sm" type="submit">Disconnect</button></form>
          {:else if oauth}
            <!-- OAuth leaves the app by design: the provider's consent screen is on its own site. -->
            <a class="btn btn-primary btn-sm" href={`/settings/connections/${provider.id}/authorize`} data-sveltekit-reload>Connect {provider.name}</a>
          {/if}
        </div>
        {#if !connection}
          <details class="group mt-4 border-t border-base-300 pt-3" open={!oauth}>
            <summary class={`flex cursor-pointer list-none items-center gap-1.5 text-xs muted ${oauth ? '' : 'hidden'}`}><KeyRound size={12} /> Use a token instead</summary>
            <form method="POST" action="?/connect" use:enhance class="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
              <input type="hidden" name="provider" value={provider.id} />
              <label class="sr-only" for={`token-${provider.id}`}>{provider.name} {provider.credential}</label>
              <input class="input input-sm input-bordered w-full" id={`token-${provider.id}`} name="token" type="password" autocomplete="off" required minlength="10" placeholder={`Paste your ${provider.name} ${provider.credential.toLowerCase()}`} />
              <button class={`btn btn-sm ${oauth ? 'btn-outline' : 'btn-primary'}`} type="submit">Connect</button>
              <p class="mb-0 text-xs muted sm:col-span-2">Create one in <a class="link" href={provider.href} target="_blank" rel="noreferrer">{provider.name} settings</a> ({provider.hint}). Mosaic checks it before saving.</p>
            </form>
          </details>
        {/if}
      </article>
    {/each}
  </div>
</section>
