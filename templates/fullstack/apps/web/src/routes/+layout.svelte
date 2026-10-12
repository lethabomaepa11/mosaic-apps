<script lang="ts">
  import { onMount, setContext } from 'svelte';
  import { page } from '$app/state';
  import { goto, onNavigate } from '$app/navigation';
  import '../app.css';
  import { applyThemeConfig, createMosaicState, Icon, MOSAIC_NAVIGATION_CONTEXT, MOSAIC_STATE_CONTEXT, Toaster } from '@mosaic-apps/ui';
  import type { NavItemDef, ThemeConfig } from '@mosaic-apps/core';
  import { client } from '#lib/client';

  let { children } = $props();
  const runtime = createMosaicState();
  setContext(MOSAIC_STATE_CONTEXT, runtime);
  setContext(MOSAIC_NAVIGATION_CONTEXT, (href: string, newTab = false) => {
    if (newTab) { window.open(href, '_blank', 'noopener,noreferrer'); return; }
    if (href.startsWith('/') && !href.startsWith('//')) return goto(href);
    window.location.assign(href);
  });
  $effect(() => { runtime.page.update(() => ({ params: page.params, query: Object.fromEntries(page.url.searchParams) })); });
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

  onMount(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
    let request = 0;
    async function refresh() {
      const current = ++request;
      const [me, nav, theme] = await Promise.allSettled([client.me(), client.getNav(), client.getTheme()]);
      if (current !== request) return;
      if (me.status === 'fulfilled') { user = me.value; runtime.application.set('user', { id: me.value.id, name: me.value.name, roles: me.value.roles }); }
      else { user = null; runtime.application.set('user', null); }
      if (nav.status === 'fulfilled') navItems = nav.value.items.length ? nav.value.items : [{ label: 'Home', href: '/', icon: 'home' }];
      if (theme.status === 'fulfilled') applyThemeConfig(theme.value);
    }
    const unsubscribe = client.subscribeSession(() => { runtime.application.reset(); void refresh(); });
    void refresh();
    return () => { request += 1; unsubscribe(); };
  });

  function logout() {
    client.logout().finally(() => {
      client.setToken(null);
      runtime.application.reset(); runtime.page.reset(); runtime.form.reset(); runtime.component.reset();
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
