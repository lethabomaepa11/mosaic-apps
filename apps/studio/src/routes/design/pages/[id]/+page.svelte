<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { CodeBlock, PageRenderer, Modal, toast } from '@mosaic/ui';
  import type { PageDef } from '@mosaic/core';
  import { client } from '#lib/client';
  import { designer } from '#lib/designer.svelte';
  import Palette from '../../../../components/Palette.svelte';
  import Canvas from '../../../../components/Canvas.svelte';
  import Inspector from '../../../../components/Inspector.svelte';
  import LayersTree from '../../../../components/LayersTree.svelte';

  const id = $derived(page.params.id ?? '');
  let loading = $state(true);
  let showJson = $state(false);
  let showPreview = $state(false);
  let saving = $state(false);
  let jsonText = $state('');
  let name = $state('');
  let route = $state('/');

  onMount(async () => {
    try {
      const pageDef = await client.getPage(id);
      designer.loadPage(pageDef);
      name = pageDef.name;
      route = pageDef.route;
    } catch (err) {
      toast.error('Could not load page', err instanceof Error ? err.message : String(err));
    } finally {
      loading = false;
    }
  });

  async function save() {
    if (!designer.page) return;
    saving = true;
    try {
      await client.savePage({
        id: designer.page.id,
        name,
        route,
        root: designer.page.root,
        settings: designer.page.settings,
      });
      toast.success('Page saved');
    } catch (err) {
      toast.error('Save failed', err instanceof Error ? err.message : String(err));
    } finally {
      saving = false;
    }
  }

  async function publish() {
    if (!designer.page) return;
    await save();
    try {
      await client.publishPage(designer.page.id);
      toast.success('Page published');
    } catch (err) {
      toast.error('Publish failed', err instanceof Error ? err.message : String(err));
    }
  }

  async function remove() {
    if (!designer.page) return;
    if (!confirm(`Delete page "${designer.page.name}"?`)) return;
    try {
      await client.deletePage(designer.page.id);
      toast.success('Page deleted');
      window.location.href = '/design/pages';
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
      const parsed = JSON.parse(jsonText) as PageDef;
      designer.loadPage(parsed);
      name = parsed.name;
      route = parsed.route;
      showJson = false;
      toast.success('Applied JSON');
    } catch (err) {
      toast.error('Invalid JSON', err instanceof Error ? err.message : String(err));
    }
  }

  function onKey(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
      e.preventDefault();
      if (e.shiftKey) designer.redo();
      else designer.undo();
    }
  }
</script>

<svelte:window onkeydown={onKey} />
<svelte:head><title>{name || 'Page'} · Mosaic Studio</title></svelte:head>

{#if loading}
  <div class="m-card"><span class="m-spinner"></span> Loading…</div>
{:else if designer.page}
  <header class="app-header">
    <div class="m-row" style="gap:10px">
      <input class="m-input" style="width:260px;font-weight:700" bind:value={name} placeholder="Page name" />
      <input class="m-input" style="width:180px" bind:value={route} placeholder="/route" />
      <span class="m-badge">v{designer.page.version}{designer.page.published ? ' · published' : ''}</span>
    </div>
    <div class="m-row">
      <button class="m-btn m-btn--ghost m-btn--sm" onclick={() => designer.undo()} disabled={designer.past.length === 0}>↶ Undo</button>
      <button class="m-btn m-btn--ghost m-btn--sm" onclick={() => designer.redo()} disabled={designer.future.length === 0}>↷ Redo</button>
      <button class="m-btn m-btn--secondary m-btn--sm" onclick={openJson}>{'{ }'} JSON</button>
      <button class="m-btn m-btn--secondary m-btn--sm" onclick={() => (showPreview = true)}>▶ Preview</button>
      <button class="m-btn m-btn--secondary m-btn--sm" disabled={saving} onclick={save}>Save</button>
      <button class="m-btn m-btn--primary m-btn--sm" onclick={publish}>Publish</button>
      <button class="m-btn m-btn--danger m-btn--sm" onclick={remove}>Delete</button>
    </div>
  </header>

  <div class="designer">
    <Palette />
    <Canvas />
    <div class="designer__panel">
      <Inspector />
      <LayersTree />
    </div>
  </div>
{/if}

<Modal bind:open={showJson} title="Page JSON" size="lg">
  <textarea class="m-textarea m-mono" rows="18" bind:value={jsonText} spellcheck="false"></textarea>
  {#snippet footer()}
    <button class="m-btn m-btn--ghost" onclick={() => (showJson = false)}>Close</button>
    <button class="m-btn m-btn--primary" onclick={applyJson}>Apply to canvas</button>
  {/snippet}
</Modal>

<Modal bind:open={showPreview} title="Preview" size="lg">
  {#if designer.page}
    <PageRenderer page={{ ...designer.page, name, route }} {client} />
  {/if}
</Modal>
