<script lang="ts">
  import { onDestroy, setContext } from 'svelte';
  import { createMosaicState, FormRenderer, PageRenderer, JsonEditor, MOSAIC_NAVIGATION_CONTEXT, MOSAIC_STATE_CONTEXT, TextField, type MosaicClient } from '@mosaic-apps/ui';
  import type { FormDef, PageDef } from '@mosaic-apps/core';
  let { form, page, client }: { form?: FormDef; page?: PageDef; client: MosaicClient } = $props();
  const previewRuntime = createMosaicState(); setContext(MOSAIC_STATE_CONTEXT, previewRuntime);
  let destination = $state<FormDef | PageDef | null>(null);
  let kind = $state<'form' | 'page'>('form');
  let query = $state<Record<string, unknown>>({}); let params = $state<Record<string, unknown>>({});
  let path = $state(''); let loading = $state(false); let error = $state('');
  let request = 0; let rootIdentity = '';
  onDestroy(() => { request += 1; });
  const root = $derived(form ?? page);
  const selected = $derived(destination?.id === root?.id ? root : destination);
  const shown = $derived(kind === 'form' && selected && 'entity' in selected && selected.entity && query.id
    ? { ...selected, dataSource: { kind: 'entity' as const, entity: selected.entity, recordId: String(query.id) } }
    : selected);
  $effect(() => {
    const id = root?.id ?? '';
    if (rootIdentity === id) return;
    rootIdentity = id; destination = root ?? null; kind = form ? 'form' : 'page';
    path = form ? `/f/${id}` : `/p/${id}`; query = {}; params = {}; error = '';
  });
  $effect(() => { previewRuntime.page.update(() => ({ params, query })); });
  async function navigate(href: string) {
    const url = new URL(href, location.origin);
    if (url.origin !== location.origin) { window.open(url.href, '_blank', 'noopener,noreferrer'); return; }
    const current = ++request; loading = true; error = '';
    try {
      let result: FormDef | PageDef; let nextKind: 'form' | 'page'; let routeParams: Record<string, string> = {};
      if (url.pathname.startsWith('/f/')) { result = await client.getForm(decodeURIComponent(url.pathname.slice(3))); nextKind = 'form'; }
      else if (url.pathname.startsWith('/p/')) { result = await client.getPage(decodeURIComponent(url.pathname.slice(3))); nextKind = 'page'; }
      else { const resolved = await client.resolvePage(url.pathname); result = resolved.page; routeParams = resolved.params; nextKind = 'page'; }
      if (current !== request) return;
      destination = result; kind = nextKind; path = url.pathname + url.search; params = routeParams; query = Object.fromEntries(url.searchParams);
      if (nextKind === 'form' && result && 'entity' in result && result.entity && query.id) destination = { ...result, dataSource: { kind: 'entity', entity: result.entity, recordId: String(query.id) } } as FormDef;
    } catch (reason) { if (current === request) error = reason instanceof Error ? reason.message : String(reason); }
    finally { if (current === request) loading = false; }
  }
  setContext(MOSAIC_NAVIGATION_CONTEXT, navigate);
  function home() { request += 1; destination = root ?? null; kind = form ? 'form' : 'page'; path = form ? `/f/${root?.id}` : `/p/${root?.id}`; query = {}; params = {}; loading = false; error = ''; }
  function object(value: unknown) { return value && typeof value === 'object' && !Array.isArray(value) ? undefined : 'Preview scope must be a JSON object.'; }
</script>
<div class="runtime-preview m-stack">
  <div class="preview-scope">
    <TextField label="Preview record id" value={String(query.id ?? '')} oninput={id => query = { ...query, id: id || undefined }} placeholder="Optional record for edit/detail views" />
    <JsonEditor label="Preview route parameters" value={params} validate={object} oninput={value => params = value as Record<string, unknown>} />
    <JsonEditor label="Preview query" value={query} validate={object} oninput={value => query = value as Record<string, unknown>} />
  </div>
  {#if destination?.id !== root?.id}<div class="m-row"><button type="button" class="m-btn m-btn--secondary m-btn--sm" onclick={home}>Back to original preview</button><span class="m-small m-muted">{destination?.name} · {path}</span></div>{/if}
  {#if error}<div class="m-alert m-alert--warning" role="alert">{error}</div>{/if}
  {#if loading}<div role="status">Loading preview destination…</div>{:else if shown}
    {#key `${kind}:${shown.id}:${path}`}
      {#if kind === 'form'}<FormRenderer form={shown as FormDef} {client} includeMetadata={false} />{:else}<PageRenderer page={shown as PageDef} {client} includeMetadata={false} scope={{ params, query }} />{/if}
    {/key}
  {/if}
</div>
<style>.preview-scope { display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;padding-bottom:12px;border-bottom:1px solid var(--m-border); } @media(max-width:720px) { .preview-scope { grid-template-columns:1fr; } }</style>
