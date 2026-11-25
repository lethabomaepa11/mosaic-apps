<script lang="ts">
  import { enhance } from '$app/forms';
  import { page } from '$app/state';
  import { BookOpen, Plug, LogOut } from '@lucide/svelte';
  import '../app.css';
  let { children, data } = $props();
  // The builder is a full-height workspace; every other page sits in the centred container.
  let workspace = $derived(page.url.pathname.startsWith('/projects/'));
  let initials = $derived((data.user?.name ?? data.user?.email ?? '?').split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((part: string) => part[0]!.toUpperCase()).join(''));
</script>

<svelte:head><meta name="theme-color" content="#ffffff" /></svelte:head>

<!-- Previews render inside the builder iframe, so they get no Cloud chrome. -->
{#if page.url.pathname.startsWith('/preview/')}{@render children()}{:else}
<!-- The builder is pinned to the viewport so its panels scroll on their own; other pages scroll normally. -->
<div class={`flex flex-col bg-base-200 text-base-content ${workspace ? 'h-dvh overflow-hidden' : 'min-h-screen'}`}>
  <header class="sticky top-0 z-30 border-b border-base-300 bg-base-100/85 backdrop-blur">
    <div class={`${workspace ? 'px-4' : 'app-container'} flex h-14 items-center gap-3`}>
      <a class="flex items-center gap-2.5 font-semibold tracking-tight" href="/" aria-label="Mosaic Cloud home">
        <span class="grid size-7 place-items-center rounded-lg bg-gradient-to-br from-primary to-violet-500 text-[13px] font-bold text-primary-content shadow-sm">M</span>
        <span class="hidden min-[430px]:inline">Mosaic Cloud</span>
      </a>
      <a class="btn btn-ghost btn-sm gap-1.5" href="https://docs-mosaic-apps.vercel.app/docs/cloud-studio" aria-label="Docs" title="Docs">
        <BookOpen size={16} /><span class="hidden min-[380px]:inline">Docs</span>
      </a>
      {#if data.user}
        <nav class="ml-4 hidden items-center gap-1 sm:flex" aria-label="Main">
          <a class="tab-link" href="/" aria-current={page.url.pathname === '/' ? 'page' : undefined}>Projects</a>
          <a class="tab-link" href="/settings/connections" aria-current={page.url.pathname.startsWith('/settings') ? 'page' : undefined}>Settings</a>
        </nav>
        <div class="ml-auto flex items-center gap-2">
          <a class="btn btn-ghost btn-sm btn-square sm:hidden" href="/settings/connections" aria-label="Connections"><Plug size={16} /></a>
          <span class="grid size-8 place-items-center rounded-full bg-base-200 text-xs font-semibold" title={data.user.email}>{initials}</span>
          <form method="POST" action="/logout" use:enhance><button class="btn btn-ghost btn-sm btn-square" aria-label="Sign out" title="Sign out"><LogOut size={16} /></button></form>
        </div>
      {:else if !['/login', '/signup'].includes(page.url.pathname)}
        <div class="ml-auto flex items-center gap-1.5"><a class="btn btn-ghost btn-sm" href="/login">Sign in</a><a class="btn btn-primary btn-sm" href="/signup">Get started</a></div>
      {/if}
    </div>
  </header>
  <main class={workspace ? 'flex min-h-0 flex-1 flex-col' : 'app-container flex-1 py-8 md:py-12'}>{@render children()}</main>
</div>
{/if}
