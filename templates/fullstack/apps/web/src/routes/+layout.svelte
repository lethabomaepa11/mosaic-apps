<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { onNavigate } from '$app/navigation';
  import '../app.css';
  import { applyThemeConfig, Icon, Toaster } from '@mosaic-apps/ui';
  import type { NavItemDef, ThemeConfig } from '@mosaic-apps/core';
  import { client } from '#lib/client';

  let { children } = $props();
  let user = $state<{ email: string; name: string; roles: string[] } | null>(null);
  let navItems = $state<NavItemDef[]>([{ label: 'Home', href: '/', icon: 'home' }]);

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

  onMount(async () => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
    const [me, nav, theme] = await Promise.allSettled([client.me(), client.getNav(), client.getTheme()]);
    if (me.status === 'fulfilled') user = me.value;
    if (nav.status === 'fulfilled' && nav.value.items.length) navItems = nav.value.items;
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

<div class="app-shell">
  <nav class="app-nav">
    <div class="app-nav__brand"><span class="dot"></span> __PROJECT_NAME__</div>
    {#each navGroups as group (group.section)}
      {#if group.section}<div class="app-nav__section">{group.section}</div>{/if}
      {#each group.items as item (item.href)}
        <a href={item.href} class:active={page.url.pathname === item.href}><Icon name={item.icon ?? 'link'} /> {item.label}</a>
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
  <main class="app-main">
    {@render children()}
  </main>
</div>
<Toaster />
