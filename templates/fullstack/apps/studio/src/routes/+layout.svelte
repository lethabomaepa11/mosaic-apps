<script lang="ts">
  import '../app.css';
  import { page } from '$app/state';
  import { applyThemeConfig, Toaster } from '@mosaic-apps/ui';
  import { client } from '#lib/client';
  import { auth } from '#lib/auth.svelte';
  import Sidebar from '../components/Sidebar.svelte';

  let { children } = $props();

  $effect(() => {
    if (!auth.ready) auth.refresh();
  });

  $effect(() => {
    if (typeof document === 'undefined') return;
    void client.getTheme().then((theme) => applyThemeConfig(theme)).catch(() => {});
  });

  const publicPaths = ['/login'];
</script>

<div class="studio">
  {#if !publicPaths.includes(page.url.pathname)}
    <Sidebar />
  {/if}
  <main class="studio-main" class:full={publicPaths.includes(page.url.pathname)}>
    {@render children()}
  </main>
</div>
<Toaster />

<style>
  .full { padding: 0; display: grid; place-items: center; }
</style>

