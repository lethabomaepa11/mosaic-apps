<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { Icon, Modal, PageRenderer, toast } from '@mosaic/ui';
  import type { PageDef, PageSettings } from '@mosaic/core';
  import { client } from '#lib/client';
  import { designer } from '#lib/designer.svelte';
  import Palette from '../../../../components/Palette.svelte';
  import Canvas from '../../../../components/Canvas.svelte';
  import Inspector from '../../../../components/Inspector.svelte';
  import LayersTree from '../../../../components/LayersTree.svelte';
  import ResizeHandle from '../../../../components/ResizeHandle.svelte';
  import PageSettingsEditor from '../../../../components/PageSettingsEditor.svelte';

  const id = $derived(page.params.id ?? '');
  let loading = $state(true);
  let showJson = $state(false);
  let showPreview = $state(false);
  let showSettings = $state(false);
  let saving = $state(false);
  let jsonText = $state('');
  let name = $state('');
  let description = $state('');
  let route = $state('/');
  let folder = $state('');
  let settings = $state<PageSettings>({});
  let paletteWidth = $state(232);
  let inspectorWidth = $state(300);

  onMount(async () => {
    try {
      const entityList = await client.listEntities();
      designer.entityOptionsByName = Object.fromEntries(entityList.map((entry) => [entry.name, entry.definition.fields.map((field) => field.name)]));
      const [forms, pages] = await Promise.all([client.listForms(), client.listPages()]);
      designer.formOptions = forms.map((item) => ({ value: item.id, label: `${item.name} · /${item.slug}` }));
      designer.artifactOptions = [
        ...forms.map((item) => ({ value: item.id, label: `${item.name} · /${item.slug}`, kind: 'form' as const })),
        ...pages.map((item) => ({ value: item.id, label: `${item.name} · ${item.route}`, kind: 'page' as const })),
      ];
      const pageDef = await client.getPage(id);
      designer.loadPage(pageDef);
      name = pageDef.name;
      description = pageDef.description ?? '';
      route = pageDef.route;
      folder = pageDef.folder ?? '';
      settings = pageDef.settings ?? {};
    } catch (err) {
      toast.error('Could not load page', err instanceof Error ? err.message : String(err));
    } finally {
      loading = false;
    }
  });

  async function save(): Promise<boolean> {
    if (!designer.page || saving) return false;
    saving = true;
    try {
      if (folder.trim()) await client.createPageFolder(folder.trim());
      const published = await client.saveAndPublishPage({
        id: designer.page.id,
        name,
        description,
        route,
        folder: folder.trim() || undefined,
        root: designer.page.root,
        expectedVersion: designer.page.version,
        settings,
      });
      designer.page.version = published.version;
      designer.page.published = published.published;
      designer.page.name = published.name;
      designer.page.description = published.description;
      designer.page.route = published.route;
      designer.page.folder = published.folder;
      designer.page.settings = published.settings;
      designer.markSaved();
      toast.success(`Saved and published${published.version ? ` v${published.version}` : ''}`);
      return true;
    } catch (err) {
      toast.error('Save failed', err instanceof Error ? err.message : String(err));
      return false;
    } finally {
      saving = false;
    }
  }

  async function remove() {
    if (!designer.page || !confirm(`Delete page "${designer.page.name}"?`)) return;
    try {
      await client.deletePage(designer.page.id);
      toast.success('Page deleted');
      window.location.href = '/design/pages';
    } catch (err) {
      toast.error('Delete failed', err instanceof Error ? err.message : String(err));
    }
  }

  function openJson() { jsonText = designer.toJson(); showJson = true; }
  function applyJson() {
    try {
      const parsed = JSON.parse(jsonText) as PageDef;
      designer.loadPage({ ...parsed, id: designer.page?.id ?? parsed.id, slug: designer.page?.slug ?? parsed.slug });
      name = parsed.name;
      description = parsed.description ?? '';
      route = parsed.route;
      folder = parsed.folder ?? '';
      settings = parsed.settings ?? {};
      showJson = false;
      toast.success('Applied JSON');
    } catch (err) { toast.error('Invalid JSON', err instanceof Error ? err.message : String(err)); }
  }

  function onKey(event: KeyboardEvent) {
    const target = event.target;
    if (target instanceof HTMLElement && (target.isContentEditable || target.closest('input, textarea, select, [contenteditable="true"]'))) return;
    if ((event.metaKey || event.ctrlKey) && event.key === 'z') { event.preventDefault(); event.shiftKey ? designer.redo() : designer.undo(); }
    else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'd') { event.preventDefault(); designer.duplicateSelection(); }
    else if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); designer.deleteSelection(); }
  }
  function beforeUnload(event: BeforeUnloadEvent) {
    if (!designer.isDirty) return;
    event.preventDefault();
    event.returnValue = '';
  }
</script>

<svelte:window onkeydown={onKey} onbeforeunload={beforeUnload} />
<svelte:head><title>{name || 'Page'} · Mosaic Studio</title></svelte:head>

{#if loading}
  <div class="m-card"><span class="m-spinner"></span> Loading…</div>
{:else if designer.page}
  <header class="app-header">
    <div class="m-row" style="gap:10px">
      <a class="m-small m-muted" href="/studio?kind=page">Studio</a><span class="m-muted">/</span><span class="m-small m-muted">{folder || 'Root'}</span>
      <strong>{name || 'Untitled page'}</strong>
      <span class="m-badge" class:m-badge--warning={designer.isDirty}>{designer.isDirty ? 'Unsaved changes' : `v${designer.page.version}${designer.page.published ? ' · published' : ''}`}</span>
    </div>
    <div class="m-row">
      <button class="m-btn m-btn--ghost m-btn--sm" onclick={() => designer.undo()} disabled={designer.past.length === 0} title="Undo"><Icon name="rotateCcw" size={14} /> Undo</button>
      <button class="m-btn m-btn--ghost m-btn--sm" onclick={() => designer.redo()} disabled={designer.future.length === 0} title="Redo"><Icon name="rotateCw" size={14} /> Redo</button>
      <button class="m-btn m-btn--secondary m-btn--sm" onclick={openJson}><Icon name="braces" size={14} /> JSON</button>
      <button class="m-btn m-btn--secondary m-btn--sm" aria-pressed={showPreview} onclick={() => { showPreview = !showPreview; showSettings = false; }}><Icon name={showPreview ? 'pencil' : 'play'} size={14} /> {showPreview ? 'Edit' : 'Preview'}</button>
      <button class="m-btn m-btn--secondary m-btn--sm" aria-pressed={showSettings} onclick={() => { showSettings = !showSettings; showPreview = false; }}><Icon name="settings" size={14} /> Page settings</button>
      <button class="m-btn m-btn--primary m-btn--sm" disabled={saving} onclick={save}>{saving ? 'Saving…' : 'Save'}</button>
      <button class="m-btn m-btn--danger m-btn--sm" onclick={remove}>Delete</button>
    </div>
  </header>

  {#if showSettings}
    <PageSettingsEditor {name} {description} {route} {folder} {settings}
      onname={(value) => { name = value; designer.markChanged(); }}
      ondescription={(value) => { description = value; designer.markChanged(); }}
      onroute={(value) => { route = value; designer.markChanged(); }}
      onfolder={(value) => { folder = value; designer.markChanged(); }}
      onsettings={(value) => { settings = value; designer.markChanged(); }} />
  {:else if showPreview}
    <main class="page-preview" aria-label="Inline page preview">
      <div class="page-preview__toolbar"><span class="m-badge">Local preview · Save publishes live</span><button class="m-btn m-btn--primary m-btn--sm" disabled={saving} onclick={save}>{saving ? 'Saving…' : 'Save'}</button></div>
      <article class="page-preview__surface"><PageRenderer page={{ ...designer.page, name, description, route, settings }} {client} /></article>
    </main>
  {:else}
    <div class="designer" style={`--palette-width:${paletteWidth}px;--inspector-width:${inspectorWidth}px`}>
      <Palette />
      <ResizeHandle value={paletteWidth} min={180} max={380} onresize={(delta) => (paletteWidth = Math.max(180, Math.min(380, paletteWidth + delta)))} />
      <Canvas />
      <ResizeHandle value={inspectorWidth} min={240} max={460} direction={-1} onresize={(delta) => (inspectorWidth = Math.max(240, Math.min(460, inspectorWidth - delta)))} />
      <div class="designer__panel"><Inspector /><LayersTree /></div>
    </div>
  {/if}
{/if}

<Modal bind:open={showJson} title="Page JSON" size="lg">
  <textarea class="m-textarea m-mono" rows="18" bind:value={jsonText} spellcheck="false"></textarea>
  {#snippet footer()}
    <button class="m-btn m-btn--ghost" onclick={() => (showJson = false)}>Close</button>
    <button class="m-btn m-btn--primary" onclick={applyJson}>Apply to canvas</button>
  {/snippet}
</Modal>

<style>
  .page-preview { min-height:calc(100vh - 76px); padding:24px; overflow:auto; background:var(--m-bg); }
  .page-preview__toolbar { display:flex; justify-content:flex-end; gap:10px; max-width:1200px; margin:0 auto 12px; }
  .page-preview__surface { max-width:1200px; min-height:65vh; margin:0 auto; padding:clamp(16px,3vw,40px); background:var(--m-surface); border:1px solid var(--m-border); border-radius:var(--m-radius-lg); box-shadow:var(--m-shadow-sm); }
</style>
