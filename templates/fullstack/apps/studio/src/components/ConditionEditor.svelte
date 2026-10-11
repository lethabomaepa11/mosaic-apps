<script lang="ts">
  import { SelectField, TextField } from '@mosaic-apps/mosaic-ui';
  import type { ScriptCondition, ScriptLanguage } from '@mosaic-apps/mosaic-core';
  import CodeEditor from './CodeEditor.svelte';

  interface Props { label: string; value: unknown; onchange: (value: unknown) => void }
  let { label, value, onchange }: Props = $props();
  let expanded = $state(false);
  const condition = $derived(value && typeof value === 'object' && (value as Partial<ScriptCondition>).kind === 'script' ? value as ScriptCondition : undefined);
  const mode = $derived(condition ? 'script' : 'expression');

  function setMode(next: string | null) {
    if (next === 'script') onchange({ kind: 'script', language: 'typescript', source: 'return true;' } satisfies ScriptCondition);
    else onchange('');
  }
</script>

<section class="condition-editor">
  <div class="condition-editor__heading">
    <span class="m-field__label">{label}</span>
    <button type="button" class="m-btn m-btn--ghost m-btn--sm" aria-expanded={expanded} onclick={() => (expanded = !expanded)}>{expanded ? 'Close editor' : 'Code editor'}</button>
  </div>
  <SelectField label="Condition type" value={mode} options={[{value:'expression',label:'Safe expression'},{value:'script',label:'JavaScript / TypeScript'}]} oninput={setMode} />
  {#if mode === 'expression'}
    <TextField label="Expression" value={typeof value === 'string' ? value : ''} placeholder="form.status === 'ready'" oninput={onchange} />
    {#if expanded}<p class="m-field__help">Expressions support comparisons and boolean logic against data, application, page, form, component, and ctx.</p>{/if}
  {:else if condition}
    <SelectField label="Language" value={condition.language ?? 'typescript'} options={[{value:'typescript',label:'TypeScript'},{value:'javascript',label:'JavaScript'}]} oninput={(language) => onchange({ ...condition, language: language as ScriptLanguage })} />
    {#if expanded}
      <CodeEditor label={`${label} script`} value={condition.source} language={condition.language ?? 'typescript'} height={220} onchange={(source) => onchange({ ...condition, source })} />
    {:else}
      <button type="button" class="condition-editor__summary" onclick={() => (expanded = true)}><code>{condition.source.split('\n')[0] || 'return true;'}</code></button>
    {/if}
    <span class="m-field__help">Return true to apply this condition. The script receives a read only state snapshot.</span>
  {/if}
</section>

<style>
  .condition-editor { display:grid; gap:8px; }
  .condition-editor__heading { display:flex; align-items:center; justify-content:space-between; gap:8px; }
  .condition-editor__summary { width:100%; padding:9px; overflow:hidden; text-align:left; color:var(--m-muted); background:var(--m-surface-2); border:1px solid var(--m-border); border-radius:var(--m-radius); white-space:nowrap; text-overflow:ellipsis; cursor:pointer; }
</style>


