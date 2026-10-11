<script lang="ts">
  import Modal from './Modal.svelte';
  import CodeEditor from './CodeEditor.svelte';

  interface Props {
    label?: string;
    value?: string;
    language?: 'javascript' | 'typescript' | 'json' | 'sql' | 'plaintext';
    disabled?: boolean;
    readOnly?: boolean;
    helpText?: string;
    validate?: (value: string) => string | undefined;
    oninput?: (value: string) => void;
  }
  let { label = 'Code', value = $bindable(''), language = 'typescript', disabled = false, readOnly = false, helpText, validate, oninput }: Props = $props();
  let open = $state(false);
  let draft = $state('');
  let error = $state('');
  function edit() { draft = value; error = ''; open = true; }
  function apply() {
    error = validate?.(draft) ?? '';
    if (error) return;
    value = draft;
    oninput?.(draft);
    open = false;
  }
</script>

<div class="m-field">
  <span class="m-field__label">{label}</span>
  <div class="editor-field__summary">
    <code>{value.split('\n')[0] || 'Empty'}</code>
    <button type="button" class="m-btn m-btn--secondary m-btn--sm" {disabled} onclick={edit}>{readOnly ? 'View' : 'Edit'} {label}</button>
  </div>
  {#if helpText}<span class="m-field__help">{helpText}</span>{/if}
</div>

<Modal bind:open title={label} size="lg">
  <CodeEditor value={draft} {language} {readOnly} label={label} height={480} onchange={(next) => (draft = next)} />
  {#if error}<p class="m-field__error" role="alert">{error}</p>{/if}
  {#snippet footer()}
    <button type="button" class="m-btn m-btn--secondary" onclick={() => (open = false)}>{readOnly ? 'Close' : 'Cancel'}</button>
    {#if !readOnly}<button type="button" class="m-btn m-btn--primary" onclick={apply}>Apply</button>{/if}
  {/snippet}
</Modal>

<style>
  .editor-field__summary { display:flex; align-items:center; gap:10px; min-width:0; }
  .editor-field__summary code { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--m-muted); }
  .editor-field__summary button { flex-shrink:0; }
</style>
