<script lang="ts">
  import { CodeEditorField, Modal } from '@mosaic-apps/ui';
  import type { FormDef, PageDef } from '@mosaic-apps/core';
  import { client } from '#lib/client';
  type Definition = FormDef | PageDef;
  let { open = $bindable(false), kind, definition, onresolve }: { open?: boolean; kind: 'form' | 'page'; definition: Definition; onresolve: (definition: Definition, keepLocal: boolean) => void } = $props();
  let published = $state<Definition | null>(null);
  let error = $state('');
  $effect(() => {
    if (!open) return;
    const id = definition.id; const selectedKind = kind;
    let active = true; published = null; error = '';
    void (selectedKind === 'form' ? client.getForm(id) : client.getPage(id)).then(value => { if (active) published = value; })
      .catch(reason => { if (active) error = reason instanceof Error ? reason.message : String(reason); });
    return () => { active = false; };
  });
  function choose(keepLocal: boolean) {
    if (!published) return;
    onresolve(keepLocal ? { ...$state.snapshot(definition), version: published.version } : $state.snapshot(published), keepLocal);
    open = false;
  }
</script>
<Modal bind:open title="Resolve concurrent changes" size="lg">
  <div class="m-stack">
    <p>Another editor published a newer version. Your local changes are preserved.</p>
    {#if published}
      <p class="m-muted">Local base: v{definition.version}. Published: v{published.version}. Choose which definition to keep. Keeping your local work requires another Save before it changes the published app.</p>
      <CodeEditorField label="Local definition" language="json" readOnly value={JSON.stringify(definition, null, 2)} />
      <CodeEditorField label="Published definition" language="json" readOnly value={JSON.stringify(published, null, 2)} />
    {:else if error}<div class="m-alert m-alert--warning" role="alert">{error}</div>
    {:else}<p role="status">Loading the published definition…</p>{/if}
  </div>
  {#snippet footer()}
    <button type="button" class="m-btn m-btn--ghost" onclick={() => open = false}>Keep editing</button>
    <button type="button" class="m-btn m-btn--secondary" disabled={!published} onclick={() => choose(false)}>Use published version</button>
    <button type="button" class="m-btn m-btn--primary" disabled={!published} onclick={() => choose(true)}>Keep my changes for next save</button>
  {/snippet}
</Modal>
