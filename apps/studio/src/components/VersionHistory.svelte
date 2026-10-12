<script lang="ts">
  import { CodeEditorField, Modal, SelectField, toast } from '@mosaic-apps/ui';
  import type { FormDef, PageDef } from '@mosaic-apps/core';
  import { client } from '#lib/client';
  let { open = $bindable(false), kind, id, version, onrestore }: { open?: boolean; kind: 'form' | 'page'; id: string; version: number; onrestore: (definition: FormDef | PageDef) => void } = $props();
  let history = $state<Awaited<ReturnType<typeof client.artifactVersions>>>([]);
  let selected = $state(''); let error = $state(''); let busy = $state(false); let loading = $state(false);
  const entry = $derived(history.find(item => String(item.version) === selected));
  $effect(() => {
    if (!open) return;
    const artifact = id; const artifactKind = kind; let active = true;
    loading = true; error = '';
    void client.artifactVersions(artifactKind, artifact).then(result => { if (active) { history = result; selected = String(result[0]?.version ?? ''); } })
      .catch(reason => { if (active) error = reason instanceof Error ? reason.message : String(reason); })
      .finally(() => { if (active) loading = false; });
    return () => { active = false; };
  });
  async function restore() {
    if (!entry || busy) return;
    busy = true; error = '';
    try { const definition = await client.restoreArtifact(kind, id, entry.version, version); onrestore(definition); open = false; toast.success(`Restored and published v${definition.version}`); }
    catch (reason) { error = reason instanceof Error ? reason.message : String(reason); }
    finally { busy = false; }
  }
</script>
<Modal bind:open title="Published version history" size="lg">
  <div class="m-stack">
    <p>Restoring a definition publishes a new version. Historical snapshots and business records are preserved.</p>
    {#if loading}<p role="status">Loading history…</p>{:else if history.length}
      <SelectField label="Published version" value={selected} clearable={false} options={history.map(item => ({ value: String(item.version), label: `v${item.version} · ${new Date(item.publishedAt).toLocaleString()}` }))} oninput={value => selected = value ?? ''} />
      {#if entry}<CodeEditorField label="Historical definition" language="json" readOnly value={JSON.stringify(entry.snapshot, null, 2)} />{/if}
    {:else}<p>No historical snapshots are available yet. Saving publishes and records a snapshot.</p>{/if}
    {#if error}<div class="m-alert m-alert--warning" role="alert">{error}</div>{/if}
  </div>
  {#snippet footer()}<button type="button" class="m-btn m-btn--ghost" disabled={busy} onclick={() => open = false}>Close</button><button type="button" class="m-btn m-btn--primary" disabled={!entry || busy || loading} onclick={restore}>{busy ? 'Restoring…' : 'Restore and publish'}</button>{/snippet}
</Modal>
