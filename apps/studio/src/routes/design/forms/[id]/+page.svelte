<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { FormRenderer, Modal, toast, Icon } from '@mosaic/ui';
  import type { FormDataSource, FormDef, EntityDef, FormSettings } from '@mosaic/core';
  import { client } from '#lib/client';
  import { designer } from '#lib/designer.svelte';
  import Palette from '../../../../components/Palette.svelte';
  import Canvas from '../../../../components/Canvas.svelte';
  import Inspector from '../../../../components/Inspector.svelte';
  import LayersTree from '../../../../components/LayersTree.svelte';
  import ResizeHandle from '../../../../components/ResizeHandle.svelte';
  import FormSettingsEditor from '../../../../components/FormSettingsEditor.svelte';

  const id = $derived(page.params.id ?? '');
  let loading = $state(true);
  let showJson = $state(false);
  let showPreview = $state(false);
  let showSettings = $state(false);
  let saving = $state(false);
  let saveAgain = false;
  let jsonText = $state('');
  let name = $state('');
  let description = $state('');
  let folder = $state('');
  let settings = $state<FormSettings>({});
  let dataSource = $state<FormDataSource>({ kind: 'none' });
  let previewWidth = $state<'desktop' | 'tablet' | 'mobile'>('desktop');
  let paletteWidth = $state(232);
  let inspectorWidth = $state(300);
  let entity = $state('');
  let entities = $state<EntityDef[]>([]);

  $effect(() => {
    designer.bindingOptions = entities.find((e) => e.name === entity)?.fields.map((field) => field.name) ?? [];
  });

  async function loadEntities() {
    try {
      const res = await client.listEntities();
      entities = res.map((e) => e.definition);
      designer.entityOptionsByName = Object.fromEntries(entities.map((definition) => [definition.name, definition.fields.map((field) => field.name)]));
    } catch { /* ignore */ }
  }

  onMount(async () => {
    try {
      await loadEntities();
      const [forms, pages] = await Promise.all([client.listForms(), client.listPages()]);
      designer.formOptions = forms.map((item) => ({ value: item.id, label: `${item.name} · /${item.slug}` }));
      designer.artifactOptions = [
        ...forms.map((item) => ({ value: item.id, label: `${item.name} · /${item.slug}`, kind: 'form' as const })),
        ...pages.map((item) => ({ value: item.id, label: `${item.name} · ${item.route}`, kind: 'page' as const })),
      ];
      const form = await client.getForm(id);
      designer.loadForm(form);
      name = form.name;
      description = form.description ?? '';
      folder = form.folder ?? '';
      settings = form.settings ?? {};
      dataSource = form.dataSource ?? { kind: 'none' };
      entity = form.entity ?? '';
    } catch (err) {
      toast.error('Could not load form', err instanceof Error ? err.message : String(err));
    } finally {
      loading = false;
    }
  });

  function draftSignature(): string {
    return JSON.stringify({ name, description, folder: folder.trim(), entity, settings, dataSource, root: designer.form?.root });
  }

  async function save(): Promise<boolean> {
    if (!designer.form) return false;
    if (saving) {
      saveAgain = true;
      return false;
    }
    saving = true;
    const submittedSignature = draftSignature();
    try {
      const payload: Partial<FormDef> & { id: string; name: string } = {
        id: designer.form.id,
        name,
        description,
        folder: folder.trim() || undefined,
        entity: entity || undefined,
        root: structuredClone(designer.form.root),
        settings: structuredClone(settings),
        dataSource: structuredClone(dataSource),
      };
      if (folder.trim()) await client.createFormFolder(folder.trim());
      const published = await client.saveAndPublishForm({ ...payload, expectedVersion: designer.form.version });
      designer.form.version = published.version;
      designer.form.published = published.published;
      designer.form.name = name;
      designer.form.folder = folder.trim() || undefined;
      designer.form.entity = entity || undefined;
      designer.form.description = description;
      designer.form.settings = structuredClone(settings);
      designer.form.dataSource = structuredClone(dataSource);
      if (draftSignature() === submittedSignature) {
        designer.markSaved();
        toast.success(`Saved and published${published.version ? ` v${published.version}` : ''}`);
      } else {
        saveAgain = true;
      }
      return true;
    } catch (err) {
      toast.error('Save failed', err instanceof Error ? err.message : String(err));
      return false;
    } finally {
      saving = false;
      if (saveAgain) {
        saveAgain = false;
        queueMicrotask(() => void save());
      }
    }
  }

  async function remove() {
    if (!designer.form) return;
    if (!confirm(`Delete form "${designer.form.name}"?`)) return;
    try {
      await client.deleteForm(designer.form.id);
      toast.success('Form deleted');
      window.location.href = '/design/forms';
    } catch (err) {
      toast.error('Delete failed', err instanceof Error ? err.message : String(err));
    }
  }

  function openJson() {
    jsonText = designer.toJson();
    showJson = true;
  }

  function applyJson() {
    try {
      const parsed = JSON.parse(jsonText) as FormDef;
      designer.loadForm({ ...parsed, id: designer.form?.id ?? parsed.id, slug: designer.form?.slug ?? parsed.slug });
      name = parsed.name;
      description = parsed.description ?? '';
      folder = parsed.folder ?? '';
      settings = parsed.settings ?? {};
      dataSource = parsed.dataSource ?? { kind: 'none' };
      entity = parsed.entity ?? '';
      showJson = false;
      toast.success('Applied JSON');
    } catch (err) {
      toast.error('Invalid JSON', err instanceof Error ? err.message : String(err));
    }
  }

  function onKey(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      void save();
      return;
    }
    const target = e.target;
    if (target instanceof HTMLElement && (target.isContentEditable || target.closest('input, textarea, select, [contenteditable="true"]'))) return;
    if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
      e.preventDefault();
      if (e.shiftKey) designer.redo();
      else designer.undo();
    } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd') {
      e.preventDefault();
      designer.duplicateSelection();
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      designer.deleteSelection();
    }
  }

  function beforeUnload(e: BeforeUnloadEvent) {
    if (!designer.isDirty) return;
    e.preventDefault();
    e.returnValue = '';
  }
</script>

<svelte:window onkeydown={onKey} onbeforeunload={beforeUnload} />
<svelte:head><title>{name || 'Form'} · Mosaic Studio</title></svelte:head>

{#if loading}
  <div class="m-card"><span class="m-spinner"></span> Loading…</div>
{:else if designer.form}
  <header class="app-header">
    <div class="m-row" style="gap:10px">
      <a class="m-small m-muted" href="/studio">Studio</a><span class="m-muted">/</span><span class="m-small m-muted">{folder || 'Root'}</span>
      <strong>{name || 'Untitled form'}</strong>
      <span class="m-badge" class:m-badge--warning={designer.isDirty}>{designer.isDirty ? 'Unsaved changes' : `v${designer.form.version}${designer.form.published ? ' · published' : ''}`}</span>
    </div>
    <div class="m-row">
      <button class="m-btn m-btn--ghost m-btn--sm" onclick={() => designer.undo()} disabled={designer.past.length === 0} title="Undo"><Icon name="rotateCcw" size={14} /> Undo</button>
      <button class="m-btn m-btn--ghost m-btn--sm" onclick={() => designer.redo()} disabled={designer.future.length === 0} title="Redo"><Icon name="rotateCw" size={14} /> Redo</button>
      <button class="m-btn m-btn--secondary m-btn--sm" onclick={openJson} title="JSON"><Icon name="braces" size={14} /> JSON</button>
      <button class="m-btn m-btn--secondary m-btn--sm" aria-pressed={showPreview} onclick={() => { showPreview = !showPreview; showSettings = false; }} title="Preview"><Icon name={showPreview ? 'pencil' : 'play'} size={14} /> {showPreview ? 'Edit' : 'Preview'}</button>
      <button class="m-btn m-btn--secondary m-btn--sm" aria-pressed={showSettings} onclick={() => { showSettings = !showSettings; showPreview = false; }}><Icon name="settings" size={14} /> Form settings</button>
      <button class="m-btn m-btn--primary m-btn--sm" disabled={saving} onclick={save}>{saving ? 'Saving…' : 'Save'}</button>
      <button class="m-btn m-btn--danger m-btn--sm" onclick={remove}>Delete</button>
    </div>
  </header>

  {#if showSettings}
    <FormSettingsEditor {name} {description} {folder} {entity} {settings} {dataSource} {entities}
      onname={(value) => { name = value; designer.markChanged(); }}
      ondescription={(value) => { description = value; designer.markChanged(); }}
      onfolder={(value) => { folder = value; designer.markChanged(); }}
      onentity={(value) => { entity = value; designer.markChanged(); }}
      onsettings={(value) => { settings = value; designer.markChanged(); }}
      ondatasource={(value) => { dataSource = value; designer.markChanged(); }} />
  {:else if showPreview}
    <main class="designer-preview" aria-label="Inline form preview">
      <div class="designer-preview__toolbar">
        <span class="m-badge">Local preview · Save publishes live</span>
        <div class="preview-widths" aria-label="Preview width">
          <button class="m-btn m-btn--ghost m-btn--sm" class:m-btn--primary={previewWidth === 'desktop'} onclick={() => (previewWidth = 'desktop')}>Desktop</button>
          <button class="m-btn m-btn--ghost m-btn--sm" class:m-btn--primary={previewWidth === 'tablet'} onclick={() => (previewWidth = 'tablet')}>Tablet</button>
          <button class="m-btn m-btn--ghost m-btn--sm" class:m-btn--primary={previewWidth === 'mobile'} onclick={() => (previewWidth = 'mobile')}>Mobile</button>
        </div>
        <button class="m-btn m-btn--primary m-btn--sm" disabled={saving} onclick={save}>{saving ? 'Saving…' : 'Save'}</button>
      </div>
      {#if designer.form}
        <article class="designer-preview__page" class:designer-preview__page--tablet={previewWidth === 'tablet'} class:designer-preview__page--mobile={previewWidth === 'mobile'}>
          <h1>{settings.seo?.title || name}</h1>
          {#if settings.seo?.description}<p>{settings.seo.description}</p>{/if}
          <FormRenderer form={{ ...designer.form, name, description, entity: entity || undefined, settings, dataSource }} {client} />
        </article>
      {/if}
    </main>
  {:else}
    <div class="designer" style={`--palette-width:${paletteWidth}px;--inspector-width:${inspectorWidth}px`}>
      <Palette />
      <ResizeHandle value={paletteWidth} min={180} max={380} onresize={(delta) => (paletteWidth = Math.max(180, Math.min(380, paletteWidth + delta)))} />
      <Canvas />
      <ResizeHandle value={inspectorWidth} min={240} max={460} direction={-1} onresize={(delta) => (inspectorWidth = Math.max(240, Math.min(460, inspectorWidth - delta)))} />
      <div class="designer__panel">
        <Inspector />
        <LayersTree />
      </div>
    </div>
  {/if}
{/if}

<Modal bind:open={showJson} title="Form JSON" size="lg">
  <textarea class="m-textarea m-mono" rows="18" bind:value={jsonText} spellcheck="false"></textarea>
  {#snippet footer()}
    <button class="m-btn m-btn--ghost" onclick={() => (showJson = false)}>Close</button>
    <button class="m-btn m-btn--primary" onclick={applyJson}>Apply to canvas</button>
  {/snippet}
</Modal>

<style>
  .designer-preview { min-height: calc(100vh - 76px); padding: 24px; overflow: auto; background: var(--m-bg); }
  .designer-preview__toolbar { display:flex; justify-content:flex-end; gap:10px; max-width:960px; margin:0 auto 16px; }
  .preview-widths { display:flex; gap:2px; padding:2px; background:var(--m-surface-2); border:1px solid var(--m-border); border-radius:var(--m-radius); }
  .designer-preview__page { width:100%; max-width:960px; min-height:65vh; margin:0 auto; padding:clamp(20px,5vw,56px); background:var(--m-surface); border:1px solid var(--m-border); border-radius:var(--m-radius-lg); box-shadow:var(--m-shadow-sm); transition:max-width 160ms ease; }
  .designer-preview__page--tablet { max-width:768px; }
  .designer-preview__page--mobile { max-width:390px; }
</style>
