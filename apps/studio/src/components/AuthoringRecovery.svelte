<script lang="ts">
  import { browserDraftStorage, encryptedDraftStore, toast, type RecoveredDraft } from '@mosaic-apps/ui';
  import { validateDefinitionTree, type FormDef, type PageDef } from '@mosaic-apps/core';
  import { client } from '#lib/client';
  type Definition = FormDef | PageDef;
  let { kind, definition, dirty, onrecover }: { kind: 'form' | 'page'; definition: Definition; dirty: boolean; onrecover: (definition: Definition) => void } = $props();
  let storage = $state.raw<ReturnType<typeof encryptedDraftStore<Definition>> | null>(null);
  let recovered = $state<RecoveredDraft<Definition> | null>(null);
  let status = $state('Preparing draft recovery…');
  let error = $state('');
  let revision = 0;
  function content(value: Definition) { const { version, createdAt, updatedAt, published, ...rest } = value; return JSON.stringify(rest); }
  $effect(() => {
    const id = definition.id;
    const artifactKind = kind;
    let active = true;
    storage = null; recovered = null; error = '';
    void (async () => {
      const me = await client.me();
      const adapter = await browserDraftStorage();
      let tab = sessionStorage.getItem('mosaic-draft-tab');
      if (!tab) { tab = crypto.randomUUID(); sessionStorage.setItem('mosaic-draft-tab', tab); }
      const scoped = encryptedDraftStore<Definition>(adapter, JSON.stringify([client.apiBase, me.id, artifactKind, id, tab]));
      const saved = await scoped.load();
      if (!active) return;
      if (saved && saved.definition.id === id && content(saved.definition) !== content(definition)) recovered = saved;
      storage = scoped; status = 'Draft recovery ready';
    })().catch(reason => { if (active) { error = reason instanceof Error ? reason.message : 'Draft recovery is unavailable.'; status = ''; } });
    return () => { active = false; revision += 1; };
  });
  $effect(() => {
    const selected = storage;
    if (!selected || recovered) return;
    const snapshot = $state.snapshot(definition);
    const current = ++revision;
    if (!dirty) {
      void selected.clear().catch(reason => { error = String(reason); });
      status = 'All changes published'; return;
    }
    status = 'Saving local draft…';
    void selected.save(snapshot, snapshot.version).then(() => { if (current === revision) status = 'Draft saved locally'; })
      .catch(reason => { if (current === revision) { error = reason instanceof Error ? reason.message : 'Draft could not be saved.'; status = ''; } });
  });
  function recover() {
    if (!recovered) return;
    try {
      validateDefinitionTree(recovered.definition.root);
      const next = { ...$state.snapshot(recovered.definition), version: definition.version };
      onrecover(next); recovered = null; error = '';
      toast.success('Draft recovered', 'Save publishes these changes.');
    } catch (reason) { error = reason instanceof Error ? reason.message : 'The draft is invalid.'; }
  }
  async function discard() { try { await storage?.clear(); recovered = null; } catch (reason) { error = String(reason); } }
</script>

<section class="recovery" aria-label="Draft recovery">
  {#if recovered}
    <div class="m-alert m-alert--warning" role="status">
      <strong>An unpublished draft from {new Date(recovered.savedAt).toLocaleString()} is available.</strong>
      {#if recovered.baseVersion !== definition.version}<p>The published definition has changed. Recovering this draft keeps your local work; Save will publish it over the current version.</p>{/if}
      <div class="m-row"><button type="button" class="m-btn m-btn--secondary m-btn--sm" onclick={recover}>Recover draft</button><button type="button" class="m-btn m-btn--ghost m-btn--sm" onclick={discard}>Discard draft</button></div>
    </div>
  {:else if error}<span class="m-field__error" role="status">Draft recovery unavailable: {error}</span>
  {:else}<span class="m-small m-muted" role="status">{status}</span>{/if}
</section>
<style>.recovery { padding:0 18px 10px; }.recovery p { margin:8px 0; }</style>
