<script lang="ts">
  import { Modal } from '@mosaic-apps/ui';
  import type { ArtifactRevision, ArtifactRevisionDiff } from '@mosaic-apps/core';

  let { open = $bindable(), revisions, title = 'History', oninspect, onrestore }: {
    open: boolean;
    revisions: ArtifactRevision[];
    title?: string;
    oninspect?: (revision: ArtifactRevision) => Promise<ArtifactRevisionDiff>;
    onrestore?: (revision: ArtifactRevision) => Promise<void>;
  } = $props();

  let selected = $state<ArtifactRevision | undefined>();
  let diff = $state<ArtifactRevisionDiff | undefined>();
  let loading = $state(false);
  let restoring = $state(false);
  let error = $state('');

  function display(value: unknown): string {
    const rendered = typeof value === 'string' ? value : JSON.stringify(value);
    if (rendered === undefined) return 'none';
    return rendered.length > 90 ? `${rendered.slice(0, 87)}...` : rendered;
  }

  async function inspect(revision: ArtifactRevision) {
    selected = revision;
    diff = undefined;
    error = '';
    if (!oninspect) return;
    loading = true;
    try { diff = await oninspect(revision); }
    catch (cause) { error = cause instanceof Error ? cause.message : String(cause); }
    finally { loading = false; }
  }

  async function restore() {
    if (!selected || !onrestore || restoring) return;
    if (!confirm(`Restore revision ${selected.revision}? Unsaved canvas changes will be replaced.`)) return;
    restoring = true;
    error = '';
    try { await onrestore(selected); open = false; }
    catch (cause) { error = cause instanceof Error ? cause.message : String(cause); }
    finally { restoring = false; }
  }
</script>

<Modal bind:open {title} size="md">
  {#if revisions.length === 0}
    <div class="m-empty"><strong>No revisions yet</strong><span>Save and publish to create the first revision.</span></div>
  {:else}
    <div class="revision-list">
      {#each revisions as revision}
        <article class="revision" class:revision--selected={selected?.id === revision.id}>
          <div class="m-row" style="justify-content:space-between">
            <strong>v{revision.revision}</strong>
            <time class="m-small m-muted" datetime={revision.createdAt}>{new Date(revision.createdAt).toLocaleString()}</time>
          </div>
          <div>{revision.message || 'Published revision'}</div>
          <div class="m-small m-muted">{revision.authorName || revision.origin} - {revision.checksum.slice(0, 10)}</div>
          {#if oninspect}<button class="m-btn m-btn--ghost m-btn--sm review" onclick={() => inspect(revision)}>Review changes</button>{/if}
        </article>
      {/each}
    </div>
  {/if}

  {#if selected}
    <section class="diff" aria-live="polite">
      <div class="m-row" style="justify-content:space-between">
        <strong>Revision {selected.revision} changes</strong>
        {#if onrestore}<button class="m-btn m-btn--primary m-btn--sm" disabled={restoring || loading || diff?.changes.length === 0} onclick={restore}>{restoring ? 'Restoring...' : 'Restore as new revision'}</button>{/if}
      </div>
      {#if loading}<span class="m-small m-muted">Loading changes...</span>
      {:else if error}<span class="m-small error">{error}</span>
      {:else if diff?.changes.length === 0}<span class="m-small m-muted">This revision matches the current version.</span>
      {:else if diff}
        <ul>
          {#each diff.changes as change}
            <li><code>{change.path}</code> <span class="m-badge">{change.kind}</span>
              {#if change.kind === 'changed'}<span class="value">{display(change.before)} &rarr; {display(change.after)}</span>
              {:else if change.kind === 'added'}<span class="value">{display(change.after)}</span>
              {:else}<span class="value">{display(change.before)}</span>{/if}
            </li>
          {/each}
        </ul>
      {/if}
    </section>
  {/if}
</Modal>

<style>
  .revision-list { display:grid; gap:10px; }
  .revision { display:grid; gap:5px; padding:12px; border:1px solid transparent; border-bottom-color:var(--m-border); border-radius:var(--m-radius); }
  .revision--selected { border-color:var(--m-primary); background:var(--m-surface-2); }
  .revision:last-child { border-bottom:0; }
  .review { justify-self:start; }
  .diff { display:grid; gap:12px; margin-top:16px; padding-top:16px; border-top:1px solid var(--m-border); }
  .diff ul { display:grid; gap:8px; max-height:280px; overflow:auto; margin:0; padding-left:20px; }
  .diff li { display:grid; grid-template-columns:minmax(100px, 1fr) auto; gap:5px 8px; align-items:center; }
  .value { grid-column:1 / -1; overflow-wrap:anywhere; color:var(--m-text-muted); font-size:var(--m-font-size-sm); }
  .error { color:var(--m-danger); }
</style>
