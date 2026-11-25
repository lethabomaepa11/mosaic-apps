<script lang="ts">
  import { onMount } from 'svelte';
  import type { MosaicClient } from '@mosaic-apps/ui';
  import Canvas from '../../../../templates/fullstack/apps/web/src/lib/studio/components/Canvas.svelte';
  import Inspector from '../../../../templates/fullstack/apps/web/src/lib/studio/components/Inspector.svelte';
  import LayersTree from '../../../../templates/fullstack/apps/web/src/lib/studio/components/LayersTree.svelte';
  import Palette from '../../../../templates/fullstack/apps/web/src/lib/studio/components/Palette.svelte';
  import ResizeHandle from '../../../../templates/fullstack/apps/web/src/lib/studio/components/ResizeHandle.svelte';
  import { designer } from '../../../../templates/fullstack/apps/web/src/lib/studio/designer.svelte';
  import '../../../../templates/fullstack/apps/web/src/lib/studio/studio.css';

  let { client, base, artifact, entities, forms, pages }: {
    client: MosaicClient; base: string;
    artifact: { kind: 'page' | 'form'; slug: string };
    entities: { name: string; fields: { name: string }[] }[];
    forms: { slug: string; name: string }[];
    pages: { slug: string; name: string }[];
  } = $props();
  let ready = $state(false);
  let busy = $state(false);
  let error = $state('');
  let status = $state('');
  let paletteWidth = $state(200);
  let inspectorWidth = $state(255);
  let active = true;

  onMount(() => {
    async function open() {
      try {
        const page = artifact.kind === 'page' ? await client.getPage(artifact.slug) : null;
        const form = artifact.kind === 'form' ? await client.getForm(artifact.slug) : null;
        if (!active) return;
        if (page) designer.loadPage(page);
        if (form) designer.loadForm(form);
        designer.entityOptionsByName = Object.fromEntries(entities.map(({ name, fields }) => [name, fields.map((field) => field.name)]));
        designer.bindingOptions = form?.entity ? designer.entityOptionsByName[form.entity] ?? [] : [];
        designer.formOptions = forms.map(({ slug, name }) => ({ value: slug, label: name }));
        designer.artifactOptions = [
          ...designer.formOptions.map((item) => ({ ...item, kind: 'form' as const })),
          ...pages.map(({ slug, name }) => ({ value: slug, label: name, kind: 'page' as const })),
        ];
        ready = true;
      } catch (cause) {
        if (active) error = cause instanceof Error ? cause.message : 'Could not open the artifact.';
      }
    }
    void open();
    return () => { active = false; };
  });

  async function save() {
    busy = true;
    error = '';
    status = '';
    try {
      const page = designer.page;
      const form = designer.form;
      if (page) {
        const saved = await client.saveAndPublishPage({ ...$state.snapshot(page), id: artifact.slug, expectedVersion: page.version });
        if (active) designer.loadPage(saved);
      } else if (form) {
        const saved = await client.saveAndPublishForm({ ...$state.snapshot(form), id: artifact.slug, expectedVersion: form.version });
        if (active) designer.loadForm(saved);
      }
      status = 'Saved to preview';
    } catch (cause) {
      error = cause instanceof Error ? cause.message : 'Could not save the preview.';
    } finally {
      busy = false;
    }
  }
</script>

<div class="studio preview-designer">
  <header class="flex flex-wrap items-center gap-2 border-b border-base-300 bg-base-100 p-3">
    <a class="btn btn-outline btn-sm" href={`${base}/studio`}>Back to Studio</a>
    {#if ready}
      <h1 class="mr-auto text-lg font-semibold">{designer.page?.name ?? designer.form?.name}</h1>
      <button class="btn btn-ghost btn-sm" type="button" disabled={!designer.past.length || busy} onclick={() => designer.undo()}>Undo</button>
      <button class="btn btn-ghost btn-sm" type="button" disabled={!designer.future.length || busy} onclick={() => designer.redo()}>Redo</button>
      <button class="btn btn-primary btn-sm" type="button" disabled={busy || !designer.isDirty} onclick={save}>{busy ? 'Saving…' : 'Save to preview'}</button>
    {/if}
  </header>
  {#if error}<p class="alert alert-error" role="alert">{error}</p>{/if}
  {#if status}<p class="px-3 pt-2 text-sm" role="status">{status}</p>{/if}
  {#if ready}
    <div class="designer" style={`--palette-width:${paletteWidth}px;--inspector-width:${inspectorWidth}px`}>
      <Palette />
      <ResizeHandle value={paletteWidth} min={180} max={380} onresize={(delta) => (paletteWidth = Math.max(180, Math.min(380, paletteWidth + delta)))} />
      <Canvas />
      <ResizeHandle value={inspectorWidth} min={240} max={460} direction={-1} onresize={(delta) => (inspectorWidth = Math.max(240, Math.min(460, inspectorWidth - delta)))} />
      <div class="designer__panel"><Inspector /><LayersTree /></div>
    </div>
  {:else if !error}
    <p class="p-4" role="status">Opening the designer…</p>
  {/if}
</div>

<style>
  .preview-designer { flex-direction:column; min-height:0; overflow-x:auto; }
  .preview-designer .designer { min-width:744px; }
</style>
