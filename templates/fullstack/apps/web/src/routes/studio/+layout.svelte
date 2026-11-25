<script lang="ts">
  import '#lib/studio/studio.css';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { applyThemeConfig } from '@mosaic-apps/ui';
  import { client } from '#lib/client';
  import { auth } from '#lib/studio/auth.svelte';
  import Sidebar from '#lib/studio/components/Sidebar.svelte';

  let { children } = $props();

  const isLogin = $derived(page.url.pathname === '/studio/login');
  // The API enforces permissions; this keeps viewers out of the authoring UI.
  const canAuthor = $derived(Boolean(auth.user && (auth.user.isAdmin || auth.user.roles.includes('editor'))));

  $effect(() => {
    if (!auth.ready) auth.refresh();
  });

  $effect(() => {
    if (auth.ready && !auth.user && !isLogin) void goto('/studio/login', { replaceState: true });
  });

  $effect(() => {
    if (typeof document === 'undefined') return;
    void client.getTheme().then((theme) => applyThemeConfig(theme)).catch(() => {});
  });
</script>

<svelte:head><title>Mosaic Studio</title></svelte:head>

<div class="studio">
  {#if isLogin}
    <main class="studio-main full">{@render children()}</main>
  {:else if canAuthor}
    <Sidebar />
    <main class="studio-main">{@render children()}</main>
  {:else if auth.ready && auth.user}
    <main class="studio-main full">
      <div class="studio-state" role="alert" style="width:min(420px,92vw)">
        <strong>Studio access required</strong>
        <p>{auth.user.email} is signed in, but only administrators and editors can use Studio.</p>
        <div class="m-row" style="gap:8px">
          <a class="m-btn m-btn--secondary m-btn--sm" href="/">Back to app</a>
          <button class="m-btn m-btn--sm" onclick={() => auth.logout()}>Sign in as someone else</button>
        </div>
      </div>
    </main>
  {:else}
    <main class="studio-main full"><div class="studio-state" role="status"><span class="m-spinner"></span> Loading Studio…</div></main>
  {/if}
</div>

<style>
  .full { padding: 0; display: grid; place-items: center; }
</style>
