<script lang="ts">
  import { CodeEditorField, TextField } from '@mosaic-apps/ui';
  import type { TableRowAction } from '@mosaic-apps/core';
  import ActionEditor from './ActionEditor.svelte';
  let { value, artifacts = [], onchange }: { value: unknown; artifacts?: { value: string; label: string; kind: 'form' | 'page' }[]; onchange: (value: TableRowAction[]) => void } = $props();
  const rows = $derived(Array.isArray(value) ? value as TableRowAction[] : []);
  function update(index: number, patch: Partial<TableRowAction>) { onchange(rows.map((item, i) => i === index ? { ...item, ...patch } : item)); }
</script>
<div class="row-editor m-stack">
  <p class="m-field__help">The selected row is available as <code>state.data</code> in scripts and <code>data</code> in templates and conditions.</p>
  {#each rows as row, index (row.id)}
    <section class="row-editor__action m-stack">
      <TextField label="Action button label" value={row.label} oninput={label => update(index, { label })} required />
      <TextField label="Action icon" value={row.icon ?? ''} oninput={icon => update(index, { icon })} />
      <CodeEditorField label="Show action when" value={row.when ?? ''} language="javascript" oninput={when => update(index, { when: when || undefined })} helpText="Example: data.status === 'prospect'." />
      <ActionEditor value={row.actions} {artifacts} onchange={actions => update(index, { actions })} />
      <button type="button" class="m-btn m-btn--ghost m-btn--sm" onclick={() => onchange(rows.filter((_, i) => i !== index))}>Remove row action</button>
    </section>
  {/each}
  <button type="button" class="m-btn m-btn--secondary m-btn--sm" onclick={() => onchange([...rows, { id: `row-${crypto.randomUUID()}`, label: 'Run action', actions: [] }])}>Add row action</button>
</div>
<style>.row-editor__action { padding:12px;border:1px solid var(--m-border);border-radius:var(--m-radius); }</style>
