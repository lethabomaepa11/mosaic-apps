<script lang="ts">
  import { JsonEditor, Modal, SelectField, Switch, TextArea, TextField } from '@mosaic-apps/mosaic-ui';
import type { ComponentAction, ScriptAction, ScriptLanguage, StateScope } from '@mosaic-apps/mosaic-core';
  import CodeEditor from './CodeEditor.svelte';

  interface ArtifactOption { value: string; label: string; kind: 'form' | 'page' }
  interface Props { value: unknown; artifacts?: ArtifactOption[]; onchange: (value: ComponentAction[]) => void }
  let { value, artifacts = [], onchange }: Props = $props();
  const actions = $derived(Array.isArray(value) ? value as ComponentAction[] : []);
  let scriptOpen = $state(false);
  let scriptIndex = $state<number | null>(null);
  const selectedScript = $derived(scriptIndex === null ? undefined : actions[scriptIndex]?.type === 'script' ? (actions[scriptIndex] as ScriptAction) : undefined);
  const scopes = [{ value: 'application', label: 'Application' }, { value: 'page', label: 'Page' }, { value: 'form', label: 'Form' }, { value: 'component', label: 'Component' }];

  function replace(index: number, action: ComponentAction) {
    onchange(actions.map((item, itemIndex) => itemIndex === index ? action : item));
  }
  function patch(index: number, changes: Record<string, unknown>) {
    replace(index, { ...actions[index], ...changes } as ComponentAction);
  }
  function add() {
    onchange([...actions, { type: 'message', variant: 'success', title: 'Done' }]);
  }
  function changeType(index: number, type: ComponentAction['type']) {
    const action: ComponentAction = type === 'message'
      ? { type, variant: 'success', title: 'Done' }
      : type === 'navigate'
        ? { type, target: 'page', to: '' }
        : type === 'api'
          ? { type, method: 'GET', path: '/health' }
          : type === 'script'
            ? { type, language: 'typescript', source: "return [api.message.success('Done')];" }
            : { type, target: { scope: 'form', path: 'value' }, value: null };
    replace(index, action);
  }
  function remove(index: number) {
    if (scriptIndex === index) { scriptOpen = false; scriptIndex = null; }
    onchange(actions.filter((_, itemIndex) => itemIndex !== index));
  }
  function editScript(index: number) { scriptIndex = index; scriptOpen = true; }
  function patchSelectedScript(changes: Record<string, unknown>) { if (scriptIndex !== null) patch(scriptIndex, changes); }
</script>

<section class="action-editor">
  <div class="action-editor__heading"><span class="m-field__label">Actions</span><button type="button" class="m-btn m-btn--secondary m-btn--sm" onclick={add}>Add action</button></div>
  {#if !actions.length}<p class="m-field__help">Run messages, API calls, navigation, or state updates in order.</p>{/if}
  {#each actions as action, index (`${index}-${action.type}`)}
    <article class="action-editor__item">
      <div class="action-editor__heading">
        <strong>Action {index + 1}</strong>
        <button type="button" class="m-btn m-btn--ghost m-btn--sm" onclick={() => remove(index)}>Remove</button>
      </div>
      <SelectField label="Type" value={action.type} options={[{value:'message',label:'Show message'},{value:'api',label:'Call API'},{value:'navigate',label:'Navigate'},{value:'state.set',label:'Set state'},{value:'script',label:'Run custom code'}]} oninput={(next) => changeType(index, next as ComponentAction['type'])} />
      {#if action.type === 'message'}
        <SelectField label="Style" value={action.variant ?? 'info'} options={[{value:'info',label:'Info'},{value:'success',label:'Success'},{value:'warning',label:'Warning'},{value:'error',label:'Error'}]} oninput={(variant) => patch(index, { variant })} />
        <TextField label="Title" value={action.title} oninput={(title) => patch(index, { title })} />
        <TextArea label="Description" value={action.description ?? ''} rows={2} oninput={(description) => patch(index, { description })} />
      {:else if action.type === 'navigate'}
        <SelectField label="Destination" value={action.target} options={[{value:'form',label:'Form'},{value:'page',label:'Page'},{value:'url',label:'URL'}]} oninput={(target) => patch(index, { target, to: '' })} />
        {#if action.target === 'url'}
          <TextField label="URL" value={action.to} placeholder="/orders or https://example.com" oninput={(to) => patch(index, { to })} />
        {:else}
          <label class="m-field"><span class="m-field__label">{action.target === 'form' ? 'Form' : 'Page'}</span><input class="m-input" list={`artifact-${index}`} value={action.to} placeholder={`Search ${action.target}s`} oninput={(event) => patch(index, { to: event.currentTarget.value })} /><datalist id={`artifact-${index}`}>{#each artifacts.filter((item) => item.kind === action.target) as item}<option value={item.value}>{item.label}</option>{/each}</datalist></label>
        {/if}
        <Switch label="Open in new tab" value={action.newTab ?? false} oninput={(newTab) => patch(index, { newTab })} />
      {:else if action.type === 'api'}
        <SelectField label="Method" value={action.method ?? 'GET'} options={['GET','POST','PUT','PATCH','DELETE'].map((method) => ({value:method,label:method}))} oninput={(method) => patch(index, { method })} />
        <TextField label="API path" value={action.path} placeholder="/entities/customer" oninput={(path) => patch(index, { path })} />
        <JsonEditor label="Request body" value={action.body ?? null} rows={4} oninput={(body) => patch(index, { body })} />
        <SelectField label="Result state scope" value={action.result?.scope ?? ''} options={[{value:'',label:'Do not store'}, ...scopes]} oninput={(scope) => patch(index, { result: scope ? { scope: scope as StateScope, path: action.result?.path ?? 'lastResult' } : undefined })} />
        {#if action.result}<TextField label="Result state path" value={action.result.path} oninput={(path) => patch(index, { result: { ...action.result, path } })} />{/if}
      {:else if action.type === 'script'}
        <div class="script-summary">
          <div><strong>Execute script</strong><p class="m-field__help">{action.language === 'javascript' ? 'JavaScript' : 'TypeScript'} · isolated browser sandbox</p></div>
          <button type="button" class="m-btn m-btn--secondary m-btn--sm" onclick={() => editScript(index)}>Edit script</button>
        </div>
        <code class="script-preview">{action.source.split('\n')[0] || '// Empty script'}</code>
      {:else if action.type === 'state.set'}
        <SelectField label="State scope" value={action.target.scope} options={scopes} oninput={(scope) => patch(index, { target: { ...action.target, scope: scope as StateScope } })} />
        <TextField label="State path" value={action.target.path} oninput={(path) => patch(index, { target: { ...action.target, path } })} />
        <JsonEditor label="Value" value={action.value} rows={3} oninput={(nextValue) => patch(index, { value: nextValue })} />
      {/if}
      <TextField label="Run when (optional)" value={action.when ?? ''} placeholder="form.status === 'ready'" oninput={(when) => patch(index, { when: when || undefined })} />
    </article>
  {/each}
</section>

<Modal bind:open={scriptOpen} title="Execute script" size="lg" onclose={() => (scriptIndex = null)}>
  {#if selectedScript && scriptIndex !== null}
    <div class="script-modal">
      <div class="script-modal__toolbar">
        <SelectField label="Language" value={selectedScript.language ?? 'typescript'} options={[{value:'typescript',label:'TypeScript'},{value:'javascript',label:'JavaScript'}]} oninput={(language) => patchSelectedScript({ language: language as ScriptLanguage })} />
        <div class="m-alert m-alert--info"><strong>Sandboxed</strong><span>No DOM, cookies, browser storage, or direct network access. Return Mosaic actions to perform approved work.</span></div>
      </div>
      <CodeEditor label="Execute script code" value={selectedScript.source} language={selectedScript.language ?? 'typescript'} height={500} onchange={(source) => patchSelectedScript({ source })} />
      <p class="m-field__help">Use <code>state</code> for current values and <code>api</code> for typed helpers. Return an array of actions. The default execution deadline is 500ms.</p>
    </div>
  {/if}
  {#snippet footer()}<button type="button" class="m-btn m-btn--primary" onclick={() => (scriptOpen = false)}>Done</button>{/snippet}
</Modal>

<style>
  .action-editor { display:grid; gap:10px; }
  .action-editor__heading { display:flex; align-items:center; justify-content:space-between; gap:8px; }
  .action-editor__item { display:grid; gap:9px; padding:10px; border:1px solid var(--m-border); border-radius:var(--m-radius); background:var(--m-surface-2); }
  .script-summary { display:flex; align-items:center; justify-content:space-between; gap:10px; }
  .script-summary p { margin:2px 0 0; }
  .script-preview { display:block; padding:8px; overflow:hidden; color:var(--m-muted); background:var(--m-surface); border:1px solid var(--m-border); border-radius:var(--m-radius-sm); white-space:nowrap; text-overflow:ellipsis; }
  .script-modal { display:grid; gap:12px; min-height:560px; }
  .script-modal__toolbar { display:grid; grid-template-columns:180px 1fr; gap:12px; align-items:end; }
  .script-modal__toolbar .m-alert { display:flex; gap:8px; align-items:center; min-height:40px; }
  @media(max-width:720px) { .script-modal__toolbar { grid-template-columns:1fr; } }
</style>

