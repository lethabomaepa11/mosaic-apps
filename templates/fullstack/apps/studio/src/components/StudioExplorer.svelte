<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { Icon, Menu, TextField, toast } from '$ui';
  import type { FormDef, PageDef } from '@mosaic-apps/core';
  import { client } from '#lib/client';
  import ResizeHandle from './ResizeHandle.svelte';

  type Artifact = FormDef | PageDef;
  type Kind = 'form' | 'page';
  let forms = $state<FormDef[]>([]);
  let pages = $state<PageDef[]>([]);
  let formFolders = $state<string[]>([]);
  let pageFolders = $state<string[]>([]);
  let query = $state('');
  let newName = $state('');
  let loading = $state(true);
  let busy = $state(false);
  let treeWidth = $state(280);
  const kind = $derived(page.url.searchParams.get('kind') === 'page' ? 'page' : 'form');

  const activeArtifacts = $derived(kind === 'form' ? forms : pages);
  const filteredArtifacts = $derived(activeArtifacts.filter((item) => `${item.name} ${item.slug} ${item.folder ?? ''}`.toLowerCase().includes(query.trim().toLowerCase())));
  function matches(item: Artifact) { return `${item.name} ${item.slug} ${item.folder ?? ''}`.toLowerCase().includes(query.trim().toLowerCase()); }
  const treeSections = $derived([
    { kind: 'form' as const, label: 'Forms', icon: 'fileText', all: forms.filter(matches), root: forms.filter((item) => matches(item) && (!item.folder || query.trim())), folders: query.trim() ? [] : formFolders },
    { kind: 'page' as const, label: 'Pages', icon: 'layoutGrid', all: pages.filter(matches), root: pages.filter((item) => matches(item) && (!item.folder || query.trim())), folders: query.trim() ? [] : pageFolders },
  ]);
  const treeSection = $derived(treeSections.find((section) => section.kind === kind)!);
  const visibleFolders = $derived(treeSection.folders);
  const rootItems = $derived(treeSection.root);

  onMount(() => { void reload(); });

  async function reload() {
    loading = true;
    try {
      const [f, p, ff, pf] = await Promise.all([client.listForms(), client.listPages(), client.listFormFolders(), client.listPageFolders()]);
      forms = f; pages = p; formFolders = ff; pageFolders = pf;
    } catch (err) {
      toast.error('Could not load Studio files', err instanceof Error ? err.message : String(err));
    } finally { loading = false; }
  }

  function href(item: Artifact, itemKind: Kind) {
    return `/studio/${itemKind === 'form' ? 'forms' : 'pages'}/${item.id}`;
  }

  async function createArtifact() {
    if (!newName.trim() || busy) return;
    busy = true;
    try {
      const schema = { type: kind, children: [] };
      const item = kind === 'form'
        ? await client.createForm({ name: newName.trim(), schema })
        : await client.createPage({ name: newName.trim(), schema });
      await goto(href(item, kind));
    } catch (err) { toast.error('Create failed', err instanceof Error ? err.message : String(err)); }
    finally { busy = false; }
  }

  async function createFolder(parent = '', targetKind: Kind = kind) {
    const name = prompt(parent ? `New folder inside ${parent}` : 'New folder name');
    if (!name?.trim()) return;
    const path = [parent, name.trim()].filter(Boolean).join('/');
    try {
      if (targetKind === 'form') await client.createFormFolder(path);
      else await client.createPageFolder(path);
      await reload();
    } catch (err) { toast.error('Could not create folder', err instanceof Error ? err.message : String(err)); }
  }

  async function renameFolder(from: string, targetKind: Kind = kind) {
    const to = prompt('Rename folder', from);
    if (!to?.trim() || to.trim() === from) return;
    try {
      if (targetKind === 'form') await client.renameFormFolder(from, to.trim());
      else await client.renamePageFolder(from, to.trim());
      await reload();
    } catch (err) { toast.error('Could not rename folder', err instanceof Error ? err.message : String(err)); }
  }

  async function deleteFolder(path: string, targetKind: Kind = kind) {
    if (!confirm(`Delete “${path}” and move its files to the root?`)) return;
    try {
      if (targetKind === 'form') await client.deleteFormFolder(path);
      else await client.deletePageFolder(path);
      await reload();
    } catch (err) { toast.error('Could not delete folder', err instanceof Error ? err.message : String(err)); }
  }

  async function moveItem(item: Artifact, itemKind: Kind, folder: string) {
    try {
      if (itemKind === 'form') await client.saveForm({ ...item as FormDef, folder: folder || undefined });
      else await client.savePage({ ...item as PageDef, folder: folder || undefined });
      await reload();
    } catch (err) { toast.error('Could not move file', err instanceof Error ? err.message : String(err)); }
  }

  function onDrop(e: DragEvent, folder: string, targetKind: Kind) {
    e.preventDefault();
    const value = e.dataTransfer?.getData('application/mosaic-file');
    if (!value) return;
    const payload = JSON.parse(value) as { id: string; kind: Kind };
    if (payload.kind !== targetKind) return;
    const item = (payload.kind === 'form' ? forms : pages).find((entry) => entry.id === payload.id);
    if (item) void moveItem(item, payload.kind, folder);
  }

  function duplicate(item: Artifact, itemKind: Kind) {
    const input = { name: `${item.name} copy`, folder: item.folder, schema: item.root, settings: item.settings };
    const request = itemKind === 'form'
      ? client.createForm({ ...input, entity: (item as FormDef).entity, dataSource: (item as FormDef).dataSource })
      : client.createPage({ ...input, route: (item as PageDef).route });
    void request.then(reload).catch((err) => toast.error('Duplicate failed', String(err)));
  }

  async function remove(item: Artifact, itemKind: Kind) {
    if (!confirm(`Delete “${item.name}”?`)) return;
    try {
      if (itemKind === 'form') await client.deleteForm(item.id);
      else await client.deletePage(item.id);
      await reload();
    } catch (err) { toast.error('Delete failed', err instanceof Error ? err.message : String(err)); }
  }
</script>

<svelte:head><title>Studio explorer · Mosaic</title></svelte:head>

<div class="explorer" style={`--tree-width:${treeWidth}px`}>
  <aside class="explorer-tree">
    <div class="explorer-tree__header">
      <strong>Files</strong>
      <button class="m-btn m-btn--ghost m-btn--icon" title="New folder" onclick={() => createFolder()}><Icon name="folderPlus" size={16} /></button>
    </div>
    <div class="explorer-tree__search"><TextField placeholder="Search files" bind:value={query} /></div>
    {#each treeSections as section (section.kind)}
      <section class="explorer-section">
        <div class="explorer-section__heading">
          <a class="explorer-root" href={section.kind === 'form' ? '/studio' : '/studio?kind=page'}><Icon name={section.icon} size={15} /> {section.label} <span>{section.all.length}</span></a>
          <button class="m-btn m-btn--ghost m-btn--icon" title={`New ${section.kind} folder`} onclick={() => createFolder('', section.kind)}><Icon name="folderPlus" size={14} /></button>
        </div>
        {#each section.root as item (item.id)}
          <div class="explorer-file">
            <a href={href(item, section.kind)} draggable="true" ondragstart={(e) => e.dataTransfer?.setData('application/mosaic-file', JSON.stringify({ id: item.id, kind: section.kind }))}><Icon name="file" size={14} /> {item.name}</a>
            <Menu icon="moreVertical" items={[
              { label: 'Open', icon: 'externalLink', onclick: () => goto(href(item, section.kind)) },
              { label: 'Duplicate', icon: 'copy', onclick: () => duplicate(item, section.kind) },
              { label: 'Move to…', icon: 'folderInput', onclick: () => { const target = prompt('Folder path (blank for root)', item.folder ?? ''); if (target !== null) void moveItem(item, section.kind, target.trim()); } },
              { label: 'Delete', icon: 'trash2', danger: true, onclick: () => remove(item, section.kind) },
            ]} />
          </div>
        {/each}
        {#each section.folders as folder (folder)}
          <div class="explorer-folder" aria-selected="false" role="treeitem" tabindex="0" style={`--depth:${folder.split('/').length - 1}`} ondragover={(e) => e.preventDefault()} ondrop={(e) => onDrop(e, folder, section.kind)}>
            <details open={query.length > 0}>
              <summary><Icon name="folder" size={14} /> {folder.split('/').at(-1)}</summary>
              <div class="explorer-folder__actions">
                <button title="New subfolder" onclick={() => createFolder(folder, section.kind)}><Icon name="folderPlus" size={13} /></button>
                <button title="Rename folder" onclick={() => renameFolder(folder, section.kind)}><Icon name="pencil" size={13} /></button>
                <button title="Delete folder" onclick={() => deleteFolder(folder, section.kind)}><Icon name="trash2" size={13} /></button>
              </div>
              {#each section.all.filter((entry) => entry.folder === folder) as item (item.id)}
                <div class="explorer-file">
                  <a href={href(item, section.kind)} draggable="true" ondragstart={(e) => e.dataTransfer?.setData('application/mosaic-file', JSON.stringify({ id: item.id, kind: section.kind }))}><Icon name="file" size={14} /> {item.name}</a>
                  <Menu icon="moreVertical" items={[
                    { label: 'Open', icon: 'externalLink', onclick: () => goto(href(item, section.kind)) },
                    { label: 'Duplicate', icon: 'copy', onclick: () => duplicate(item, section.kind) },
                    { label: 'Move to…', icon: 'folderInput', onclick: () => { const target = prompt('Folder path (blank for root)', item.folder ?? ''); if (target !== null) void moveItem(item, section.kind, target.trim()); } },
                    { label: 'Delete', icon: 'trash2', danger: true, onclick: () => remove(item, section.kind) },
                  ]} />
                </div>
              {/each}
            </details>
          </div>
        {/each}
      </section>
    {/each}
  </aside>
  <ResizeHandle value={treeWidth} min={220} max={420} onresize={(delta) => (treeWidth = Math.max(220, Math.min(420, treeWidth + delta)))} />

  <main class="explorer-home">
    <header class="app-header">
      <div><h1 class="m-h2" style="margin:0">{kind === 'form' ? 'Forms' : 'Pages'}</h1><p class="m-muted m-small">Browse, organize, and open your {kind === 'form' ? 'forms' : 'pages'}.</p></div>
      <div class="m-row"><div style="width:230px"><TextField placeholder={`New ${kind} name`} bind:value={newName} /></div><button class="m-btn m-btn--primary" disabled={busy || !newName.trim()} onclick={createArtifact}>Create {kind}</button></div>
    </header>
    {#if loading}<div class="m-card">Loading files…</div>
    {:else if filteredArtifacts.length === 0}<div class="m-card"><h2 class="m-h3">Nothing here yet</h2><p class="m-muted">Create a {kind}, or drag a file onto a folder to organize it.</p></div>
    {:else}
      <h2 class="m-h3">Recent {kind === 'form' ? 'forms' : 'pages'}</h2>
      <div class="cards">{#each [...filteredArtifacts].sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '')).slice(0, 8) as item (item.id)}
        <a class="m-card explorer-recent" href={href(item, kind)}><div class="m-row" style="justify-content:space-between"><strong>{item.name}</strong><span class="m-badge" class:m-badge--success={item.published}>v{item.version}{item.published ? ' · live' : ''}</span></div><div class="m-small m-muted">{item.folder || 'Root'} · {item.slug}</div></a>
      {/each}</div>
    {/if}
  </main>
</div>

<style>
  .explorer { display:grid; grid-template-columns:minmax(220px, var(--tree-width, 280px)) 6px minmax(0,1fr); min-height:calc(100vh - 44px); margin:-22px; }
  .explorer-tree { background:var(--m-surface); border-right:1px solid var(--m-border); padding:12px; overflow:auto; }
  .explorer-tree__header,.explorer-file,.explorer-folder summary { display:flex; align-items:center; justify-content:space-between; gap:8px; }
  .explorer-tree__search { margin:10px 0 16px; }
  .explorer-section { margin-bottom:12px; }
  .explorer-section__heading { display:flex; align-items:center; justify-content:space-between; }
  .explorer-root { display:flex; align-items:center; gap:8px; padding:8px; font-size:.8rem; font-weight:750; }
  .explorer-root span { margin-left:auto; color:var(--m-fg-muted); font-size:.7rem; }
  .explorer-file { min-width:0; padding:5px 4px 5px 22px; border-radius:6px; font-size:.78rem; }
  .explorer-file:hover,.explorer-folder summary:hover { background:var(--m-surface-2); }
  .explorer-file a { min-width:0; display:flex; align-items:center; gap:7px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1; }
  .explorer-folder { padding-left:calc(var(--depth) * 12px); }
  .explorer-folder summary { padding:6px 4px; list-style:none; cursor:pointer; font-size:.78rem; }
  .explorer-folder summary::-webkit-details-marker { display:none; }
  .explorer-folder__actions { display:flex; justify-content:flex-end; gap:3px; }
  .explorer-folder__actions button { background:none; border:0; cursor:pointer; color:var(--m-fg-muted); }
  .explorer-home { min-width:0; padding:22px; }
  .explorer-recent { display:flex; flex-direction:column; gap:8px; }
  @media(max-width:760px) { .explorer { grid-template-columns:1fr; } .explorer-tree { max-height:42vh; border-right:0; border-bottom:1px solid var(--m-border); } .explorer > :global(.resize-handle) { display:none; } }
</style>

