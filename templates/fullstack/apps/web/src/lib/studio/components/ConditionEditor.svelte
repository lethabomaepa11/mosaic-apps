<script lang="ts">
  import { CodeEditorField, Modal, SelectField } from '@mosaic-apps/ui';
  import type { ScriptCondition, ScriptLanguage } from '@mosaic-apps/core';
  import CodeEditor from './CodeEditor.svelte';

  interface Props { label: string; value: unknown; onchange: (value: unknown) => void }
  let { label, value, onchange }: Props = $props();
  let open = $state(false);
  let selectedMode = $state<string | null>('expression');
  let draft = $state<ScriptCondition>({ kind: 'script', language: 'typescript', source: 'return true;' });
  const condition = $derived(value && typeof value === 'object' && (value as Partial<ScriptCondition>).kind === 'script' ? value as ScriptCondition : undefined);
  const mode = $derived(condition ? 'script' : 'expression');
  $effect(() => { selectedMode = mode; });
  function editScript() { draft = condition ? { ...condition } : { kind: 'script', language: 'typescript', source: 'return true;' }; open = true; }
  function setMode(next: string | null) { if (next === 'script') editScript(); else onchange(''); }
  function apply() { onchange({ ...draft }); open = false; }
  function cancel() { open = false; selectedMode = mode; }
</script>

<section class="condition-editor">
  <span class="m-field__label">{label}</span>
  <SelectField label="Condition type" bind:value={selectedMode} clearable={false} options={[{value:'expression',label:'Safe expression'},{value:'script',label:'JavaScript / TypeScript'}]} oninput={setMode} />
  {#if condition}
    <div class="condition-editor__summary"><code>{condition.source.split('\n')[0] || 'Empty script'}</code><button type="button" class="m-btn m-btn--secondary m-btn--sm" onclick={editScript}>Edit {label} script</button></div>
    <span class="m-field__help">Return true to apply this condition. The script receives a read only state snapshot.</span>
  {:else}
    <CodeEditorField label={`${label} expression`} value={typeof value === 'string' ? value : ''} language="javascript" oninput={onchange} helpText="Supports comparisons and boolean logic against data, application, page, form, component, and ctx." />
  {/if}
</section>

<Modal bind:open title={`${label} script`} size="lg" onclose={cancel}>
  <div class="condition-editor">
    <SelectField label="Language" value={draft.language ?? 'typescript'} clearable={false} options={[{value:'typescript',label:'TypeScript'},{value:'javascript',label:'JavaScript'}]} oninput={(language) => (draft.language = language as ScriptLanguage)} />
    <CodeEditor label={`${label} script`} value={draft.source} language={draft.language ?? 'typescript'} height={480} onchange={(source) => (draft.source = source)} />
    <p class="m-field__help">Read values from state and return true or false.</p>
  </div>
  {#snippet footer()}
    <button type="button" class="m-btn m-btn--secondary" onclick={cancel}>Cancel</button>
    <button type="button" class="m-btn m-btn--primary" onclick={apply}>Apply condition</button>
  {/snippet}
</Modal>

<style>
  .condition-editor { display:grid; gap:8px; }
  .condition-editor__summary { display:flex; align-items:center; gap:8px; min-width:0; }
  .condition-editor__summary code { flex:1; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; color:var(--m-muted); }
</style>
