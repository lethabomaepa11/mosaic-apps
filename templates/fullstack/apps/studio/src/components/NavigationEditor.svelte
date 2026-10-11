<script lang="ts">
  import { onMount } from 'svelte';
  import { Icon, TextField, toast } from '@mosaic-apps/ui';
  import type { NavItemDef } from '@mosaic-apps/core';
  import { client } from '#lib/client';

  const icons = ['home', 'layoutGrid', 'fileText', 'database', 'chartNoAxesCombined', 'settings', 'users', 'bookOpen', 'calendar', 'folder', 'briefcase', 'helpCircle'];
  let items = $state<NavItemDef[]>([]);
  let saving = $state(false);
  onMount(async () => {
    try { items = (await client.getNav()).items.map((item) => ({ ...item, section: item.section ?? '' })); }
    catch (err) { toast.error('Could not load navigation', err instanceof Error ? err.message : String(err)); }
  });
  function add() { items = [...items, { label: 'New link', href: '/', icon: 'link', section: '' }]; }
  function move(index: number, amount: number) {
    const target = index + amount;
    if (target < 0 || target >= items.length) return;
    const next = [...items]; [next[index], next[target]] = [next[target]!, next[index]!]; items = next;
  }
  async function save() {
    saving = true;
    try {
      const clean = items.map(({ label, href, icon, section }) => ({ label: label.trim(), href: href.trim(), icon, section: section?.trim() || undefined }));
      if (clean.some((item) => !item.label || !item.href.startsWith('/'))) throw new Error('Every link needs a label and an app-relative path starting with /.');
      await client.setSetting('app.nav', clean, 'Application navigation items');
      items = clean;
      toast.success('Navigation saved');
    } catch (err) { toast.error('Could not save navigation', err instanceof Error ? err.message : String(err)); }
    finally { saving = false; }
  }
</script>

<section class="m-card nav-editor">
  <header class="m-card__header"><div><strong class="m-card__title">Navigation</strong><p class="m-muted m-small">These links appear in the generated app sidebar.</p></div><div class="m-row"><button class="m-btn m-btn--secondary" onclick={add}>Add link</button><button class="m-btn m-btn--primary" disabled={saving} onclick={save}>{saving ? 'Saving…' : 'Save navigation'}</button></div></header>
  {#each items as item, i (i)}
    <div class="nav-row">
      <div class="nav-preview"><Icon name={item.icon ?? 'link'} size={16} /></div>
      <TextField label="Label" bind:value={item.label} />
      <TextField label="Path" bind:value={item.href} placeholder="/orders" />
      <label>Icon<select class="m-select" bind:value={item.icon}>{#each icons as icon (icon)}<option value={icon}>{icon}</option>{/each}</select></label>
      <TextField label="Section" bind:value={item.section} placeholder="Optional" />
      <div class="nav-actions"><button class="m-btn m-btn--ghost m-btn--icon" title="Move up" onclick={() => move(i, -1)}><Icon name="arrowUp" size={14} /></button><button class="m-btn m-btn--ghost m-btn--icon" title="Move down" onclick={() => move(i, 1)}><Icon name="arrowDown" size={14} /></button><button class="m-btn m-btn--ghost m-btn--icon" title="Remove" onclick={() => items = items.filter((_, index) => index !== i)}><Icon name="trash2" size={14} /></button></div>
    </div>
  {/each}
  <aside class="nav-live"><strong>Live preview</strong>{#each items as item, i (i)}<div><Icon name={item.icon ?? 'link'} size={15} /> {item.label}<span>{item.section}</span></div>{/each}</aside>
</section>

<style>
  .nav-editor { display:grid; gap:14px; }
  .nav-row { display:grid; grid-template-columns:26px minmax(120px,1fr) minmax(140px,1fr) 150px minmax(110px,.7fr) auto; gap:10px; align-items:end; padding:10px 0; border-bottom:1px solid var(--m-border); }
  .nav-preview { padding-bottom:8px; color:var(--m-primary); }
  .nav-row label { display:grid; gap:5px; font-size:.75rem; font-weight:650; }
  .nav-actions { display:flex; }
  .nav-live { display:grid; gap:4px; padding:14px; background:#101827; color:#cbd5e1; border-radius:var(--m-radius); }
  .nav-live div { display:flex; gap:9px; align-items:center; padding:5px 8px; border-radius:5px; }
  .nav-live span { margin-left:auto; opacity:.55; font-size:.72rem; }
  @media(max-width:900px) { .nav-row { grid-template-columns:24px 1fr 1fr; } .nav-row > :nth-child(n+4) { grid-column:auto; } }
</style>

