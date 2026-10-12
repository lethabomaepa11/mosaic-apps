<script lang="ts">
  import { onMount, setContext } from 'svelte';
  import { page } from '$app/state';
  import { goto, onNavigate } from '$app/navigation';
  import '../app.css';
  import { applyThemeConfig, browserStateStorage, persistState, StateStore, SelectField, createMosaicState, Icon, MOSAIC_NAVIGATION_CONTEXT, MOSAIC_STATE_CONTEXT, Toaster } from '@mosaic-apps/ui';
  import type { NavItemDef, ThemeConfig } from '@mosaic-apps/core';
  import { client } from '#lib/client';

  let { children } = $props();
  const runtime = createMosaicState();
  let pageLayout = $state<'app' | 'bare'>('app');
  let layoutOwner = 0;
  setContext('mosaic:page-layout', (layout: 'app' | 'bare') => {
    const owner = ++layoutOwner;
    pageLayout = layout;
    return () => { if (owner === layoutOwner) pageLayout = 'app'; };
  });
  setContext(MOSAIC_STATE_CONTEXT, runtime);
  setContext(MOSAIC_NAVIGATION_CONTEXT, (href: string, newTab = false) => {
    if (newTab) { window.open(href, '_blank', 'noopener,noreferrer'); return; }
    if (href.startsWith('/') && !href.startsWith('//')) return goto(href);
    window.location.assign(href);
  });
  $effect(() => { runtime.page.update(() => ({ params: page.params, query: Object.fromEntries(page.url.searchParams) })); });
  let user = $state<{ email: string; name: string; roles: string[] } | null>(null);
  let brandName = $state('__PROJECT_NAME__');
  let brandLogo = $state('');
  type AppearanceMode = 'default' | 'light' | 'dark' | 'system';
  const preferences = new StateStore<{ mode: AppearanceMode }>({ mode: 'default' });
  let appearanceMode = $state<AppearanceMode>('default');
  let configuredTheme: ThemeConfig = {};
  function applyAppearance() { applyThemeConfig({ ...configuredTheme, mode: appearanceMode === 'default' ? configuredTheme.mode : appearanceMode }); }
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
    let persistence: ReturnType<typeof persistState> | undefined;
    try { persistence = persistState(preferences, browserStateStorage('local'), { key: `mosaic-appearance:${client.apiBase}`, keys: ['mode'], syncTabs: true }); } catch { /* Preferences still work for this session. */ }
    const unsubscribePreference = preferences.subscribe(value => {
      appearanceMode = ['default','light','dark','system'].includes(value.mode) ? value.mode : 'default';
      runtime.application.set('appearance', { mode: appearanceMode }); applyAppearance();
    });
    async function refresh() {
      const current = ++request;
      const [me, nav, theme, branding] = await Promise.allSettled([client.me(), client.getNav(), client.getTheme(), client.branding()]);
      if (current !== request) return;
      if (me.status === 'fulfilled') { user = me.value; runtime.application.set('user', { id: me.value.id, name: me.value.name, roles: me.value.roles }); }
      else { user = null; runtime.application.set('user', null); }
      if (nav.status === 'fulfilled') navItems = nav.value.items.length ? nav.value.items : [{ label: 'Home', href: '/', icon: 'home' }];
      if (theme.status === 'fulfilled') { configuredTheme = theme.value; applyAppearance(); }
      runtime.application.set('appearance', { mode: appearanceMode });
      if (branding.status === 'fulfilled') {
        if (branding.value.name && branding.value.name !== 'Mosaic App') brandName = branding.value.name;
        brandLogo = branding.value.logo.startsWith('/files/') ? client.fileUrl(branding.value.logo.slice('/files/'.length)) : branding.value.logo;
      }
    }
    const unsubscribe = client.subscribeSession(() => { runtime.application.reset(); void refresh(); });
    void refresh();
    return () => { request += 1; unsubscribe(); unsubscribePreference(); persistence?.dispose(); };
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

<div class="app-shell" class:app-shell--bare={pageLayout === 'bare'}>
  {#if pageLayout !== 'bare'}
  <nav class="app-nav">
    <div class="app-nav__brand">{#if brandLogo}<img src={brandLogo} alt="" style="max-height:36px;max-width:110px;object-fit:contain" />{:else}<span class="dot"></span>{/if} {brandName}</div>
    {#each navGroups as group (group.section)}
      {#if group.section}<div class="app-nav__section">{group.section}</div>{/if}
      {#each group.items as item (item.href)}
        <a href={item.href} class:active={page.url.pathname === item.href}><Icon name={item.icon ?? 'link'} /> {item.label}</a>
      {/each}
    {/each}
    <div class="app-nav__spacer"></div>
    <div style="padding:8px 10px"><SelectField label="Appearance" value={appearanceMode} clearable={false} options={[{value:'default',label:'Application default'},{value:'system',label:'System'},{value:'light',label:'Light'},{value:'dark',label:'Dark'}]} oninput={value => preferences.set('mode', value as AppearanceMode)} /></div>
    {#if user}
      <div style="padding:8px 10px;font-size:.75rem;color:var(--m-fg-muted)">{user.email}</div>
      <a href="/login" onclick={(e) => { e.preventDefault(); logout(); }}><Icon name="logOut" /> Sign out</a>
    {:else}
      <a href="/login" class:active={page.url.pathname === '/login'}><Icon name="keyRound" /> Sign in</a>
    {/if}
  </nav>
  {/if}
  <main class="app-main">
    {@render children()}
  </main>
</div>
<Toaster />
