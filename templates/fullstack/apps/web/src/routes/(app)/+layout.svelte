<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { onNavigate } from '$app/navigation';
  import { applyThemeConfig, Icon } from '@mosaic-apps/ui';
  import type { NavItemDef } from '@mosaic-apps/core';
  import { client } from '#lib/client';

  let { children, data } = $props();
  let user = $state<{ email: string; name: string; roles: string[] } | null>(null);
  const navItems = $derived(data.navigation);

  onNavigate((navigation) => {
    if (!document.startViewTransition || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    return new Promise<void>((resolve) => {
      document.startViewTransition(async () => {
        resolve();
        await navigation.complete;
      });
    });
  });

  const navGroups = $derived([...navItems.reduce((groups, item) => {
    const key = item.section?.trim() ?? '';
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
    return groups;
  }, new Map<string, NavItemDef[]>())].map(([section, items]) => ({ section, items })));
  const bareLayout = $derived(['/login', '/signup'].includes(page.url.pathname) || page.data.mosaicPage?.settings?.layout === 'bare');

  onMount(async () => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
    const [me, theme] = await Promise.allSettled([client.me(), client.getTheme()]);
    if (me.status === 'fulfilled') user = me.value;
    if (theme.status === 'fulfilled') applyThemeConfig(theme.value);
  });

  function logout() {
    client.logout().finally(() => {
      client.setToken(null);
      user = null;
      window.location.href = '/login';
    });
  }
</script>

<div class:app-shell={!bareLayout}>
  {#if !bareLayout}
  <nav class="app-nav" aria-label="Main navigation">
    <div class="app-nav__brand"><span class="dot"></span> __PROJECT_NAME__</div>
    {#each navGroups as group (group.section)}
      {#if group.section}<div class="app-nav__section">{group.section}</div>{/if}
      {#each group.items as item}
        <a href={item.href} class:active={page.url.pathname === item.href} aria-current={page.url.pathname === item.href ? 'page' : undefined}><Icon name={item.icon ?? 'link'} /> {item.label}</a>
      {/each}
    {/each}
    <div class="app-nav__spacer"></div>
    {#if user}
      <div style="padding:8px 10px;font-size:.75rem;color:#94a3b8">{user.email}</div>
      <a href="/login" onclick={(e) => { e.preventDefault(); logout(); }}><Icon name="logOut" /> Sign out</a>
    {:else}
      <a href="/login" class:active={page.url.pathname === '/login'}><Icon name="keyRound" /> Sign in</a>
    {/if}
  </nav>
  {/if}
  <main class:app-main={!bareLayout} class:published-page={Boolean(page.data.mosaicPage)}>
    {@render children()}
  </main>
</div>
