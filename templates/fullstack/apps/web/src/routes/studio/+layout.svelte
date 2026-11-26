<script lang="ts">
  import '#lib/studio/studio.css';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { applyThemeConfig } from '@mosaic-apps/ui';
  import { client } from '#lib/client';
  import { auth } from '#lib/studio/auth.svelte';
  import Sidebar from '#lib/studio/components/Sidebar.svelte';
  import { cloudRelease } from '#lib/studio/cloud-release';

  let { children } = $props();

  const isLogin = $derived(page.url.pathname === '/studio/login');
  // The API enforces permissions; this keeps viewers out of the authoring UI.
  const canAuthor = $derived(Boolean(auth.user && (auth.user.isAdmin || auth.user.roles.includes('editor'))));
  let upgradeUrl = $state('');

  $effect(() => {
    const release = cloudRelease;
    if (!release || !auth.user?.isAdmin || isLogin) return;
    const controller = new AbortController();
    void fetch(new URL('/api/framework-version', release.origin), { credentials: 'omit', signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then((versions) => {
        if (!controller.signal.aborted && typeof versions?.[release.framework] === 'string' && versions[release.framework] !== release.version) {
          upgradeUrl = new URL(`/projects/${encodeURIComponent(release.projectId)}?tab=source`, release.origin).href;
        }
      }).catch(() => {});
    return () => { controller.abort(); upgradeUrl = ''; };
  });

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
    <main class="studio-main">
      {#if upgradeUrl && auth.user?.isAdmin}
        <div class="m-alert" role="status">A framework update is available. <a href={upgradeUrl} data-sveltekit-reload>Upgrade in Mosaic Cloud</a></div>
      {/if}
      {@render children()}
    </main>
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
