<script lang="ts">
  import { onMount } from 'svelte';
  import { Icon, TextField, type MosaicClient } from '@mosaic-apps/ui';
  import type { NavItemDef } from '@mosaic-apps/core';

  let { client, initial, name = 'App', onsave }: { client: MosaicClient; initial?: NavItemDef[]; name?: string; onsave?: () => void | Promise<void> } = $props();
  let items = $state<NavItemDef[]>([]);
  let selected = $state(0);
  let saving = $state(false);
  let ready = $state(false);
  let error = $state('');
  let status = $state('');

  onMount(async () => {
    try {
      let navigation = initial;
      if (!navigation) {
        const setting = (await client.listSettings()).find((item) => item.key === 'app.nav');
        navigation = Array.isArray(setting?.value) ? (await client.getNav()).items : (await client.listPages(true))
          .filter((page) => page.settings?.menu?.show !== false && !page.route.split('/').some((part) => part.startsWith(':')))
          .sort((a, b) => (a.settings?.menu?.order ?? 99) - (b.settings?.menu?.order ?? 99))
          .map((page) => ({ label: page.settings?.title ?? page.name, href: page.route, icon: page.settings?.menu?.icon, section: page.settings?.menu?.group }));
      }
      items = navigation.map((item) => ({ ...item }));
      ready = true;
    } catch (cause) {
      error = cause instanceof Error ? cause.message : 'Could not load the sidebar.';
    }
  });

  function add() {
    selected = items.length;
    items = [...items, { label: 'New link', href: '', icon: 'link' }];
  }
  function move(offset: number) {
    const index = selected + offset;
    if (index < 0 || index >= items.length) return;
    const next = [...items];
    [next[selected], next[index]] = [next[index]!, next[selected]!];
    items = next;
    selected = index;
  }
  function remove() {
    items = items.filter((_, index) => index !== selected);
    selected = Math.max(0, Math.min(selected, items.length - 1));
  }
  async function save() {
    saving = true;
    error = status = '';
    try {
      const clean = items.map(({ label, href, icon, section }) => ({ label: label.trim(), href: href.trim(), icon: icon?.trim() || undefined, section: section?.trim() || undefined }));
      if (clean.some((item) => !item.label || !item.href.startsWith('/') || item.href.startsWith('//') || /[\\\u0000-\u001f]/.test(item.href))) {
        throw new Error('Every link needs a label and a safe app-relative path.');
      }
      if (new Set(clean.map((item) => item.href)).size !== clean.length) throw new Error('Use a different path for each link.');
      await client.setSetting('app.nav', clean, 'Application navigation items');
      items = clean;
      await onsave?.();
      status = 'Sidebar saved';
    } catch (cause) {
      error = cause instanceof Error ? cause.message : 'Could not save the sidebar.';
    } finally {
      saving = false;
    }
  }
</script>

<section class="m-card sidebar-editor">
  <header class="m-card__header">
    <h1 class="m-card__title">Sidebar</h1>
    <div class="m-row">
      <button class="m-btn m-btn--secondary" type="button" disabled={!ready || saving} onclick={add}>Add link</button>
      <button class="m-btn m-btn--primary" type="button" disabled={!ready || saving} onclick={save}>{saving ? 'Saving…' : 'Save sidebar'}</button>
    </div>
  </header>
  {#if error}<p role="alert">{error}</p>{/if}
  {#if status}<p role="status">{status}</p>{/if}
  <div class="sidebar-canvas">
    <aside class="sidebar-preview" aria-label="Sidebar canvas">
      <strong>{name}</strong>
      {#each items as item, index}
        {#if item.section && item.section !== items[index - 1]?.section}<small>{item.section}</small>{/if}
        <button type="button" aria-pressed={index === selected} onclick={() => (selected = index)}>
          <Icon name={item.icon || 'link'} size={16} /> {item.label || 'Untitled link'}
        </button>
      {/each}
    </aside>
    {#if items[selected]}
      {@const item = items[selected]}
      <div class="sidebar-properties" aria-label="Link properties">
        <TextField label="Label" bind:value={item.label} />
        <TextField label="Path" bind:value={item.href} placeholder="/orders" />
        <TextField label="Icon" bind:value={item.icon} placeholder="link" />
        <TextField label="Section" bind:value={item.section} placeholder="Optional" />
        <div class="m-row">
          <button class="m-btn m-btn--ghost" type="button" disabled={selected === 0 || saving} onclick={() => move(-1)}>Move up</button>
          <button class="m-btn m-btn--ghost" type="button" disabled={selected === items.length - 1 || saving} onclick={() => move(1)}>Move down</button>
          <button class="m-btn m-btn--ghost" type="button" disabled={saving} onclick={remove}>Remove</button>
        </div>
      </div>
    {/if}
  </div>
</section>

<style>
  .sidebar-editor { display:grid; gap:12px; padding:16px; }
  .sidebar-canvas { display:grid; grid-template-columns:minmax(150px,240px) minmax(0,1fr); gap:16px; }
  .sidebar-preview { display:flex; flex-direction:column; gap:4px; padding:12px; min-height:270px; border:1px solid var(--m-border); border-radius:var(--m-radius); background:var(--color-base-100,var(--m-surface)); }
  .sidebar-preview strong, .sidebar-preview small { padding:6px 10px; }
  .sidebar-preview button { display:flex; align-items:center; gap:8px; color:inherit; text-align:left; padding:8px 10px; border-radius:8px; }
  .sidebar-preview button[aria-pressed="true"] { background:color-mix(in srgb,var(--color-primary,var(--m-primary)) 13%,transparent); color:var(--color-primary,var(--m-primary)); }
  .sidebar-properties { display:grid; gap:10px; align-content:start; max-width:420px; min-width:0; }
  @media (max-width:560px) { .sidebar-canvas { grid-template-columns:1fr; } .sidebar-preview { min-height:auto; } }
</style>
