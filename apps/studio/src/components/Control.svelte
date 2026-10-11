<script lang="ts">
  import { TextField, TextArea, NumberField, Switch, SelectField, ColorPicker, JsonEditor, Checkbox } from '$ui';
  import type { PropDesc } from '$ui';
  import ActionEditor from './ActionEditor.svelte';
  import ConditionEditor from './ConditionEditor.svelte';

  interface Props {
    desc: PropDesc;
    value: unknown;
    options?: string[];
    artifacts?: { value: string; label: string; kind?: 'form' | 'page' }[];
    onChange: (v: unknown) => void;
  }

  let { desc, value, options = [], artifacts = [], onChange }: Props = $props();
  let search = $state('');
  const matchingArtifacts = $derived(artifacts.filter((item) => item.label.toLocaleLowerCase().includes(search.toLocaleLowerCase())).slice(0, 10));
  $effect(() => {
    const selected = artifacts.find((item) => item.value === String(value ?? ''));
    if (selected) search = selected.label;
  });
</script>

{#if desc.kind === 'boolean'}
  <div class="m-row" style="justify-content:space-between">
    <span class="m-field__label">{desc.label}</span>
    <Switch value={Boolean(value)} oninput={(v) => onChange(v)} />
  </div>
{:else if desc.kind === 'number'}
  <NumberField label={desc.label} value={value === undefined || value === null ? '' : Number(value)} min={desc.min} max={desc.max} oninput={(v) => onChange(v)} />
{:else if desc.kind === 'color'}
  <ColorPicker label={desc.label} value={String(value ?? '#6366f1')} oninput={(v) => onChange(v)} />
{:else if desc.kind === 'select'}
  <SelectField
    label={desc.label}
    value={value === undefined || value === null ? '' : String(value)}
    options={(desc.options ?? []).map((o) => ({ value: o.value, label: o.label }))}
    oninput={(v) => onChange(v)}
  />
{:else if desc.kind === 'formRef'}
  <label class="m-field">
    <span class="m-field__label">{desc.label}</span>
    <input class="m-input" value={search} placeholder="Search forms…" autocomplete="off" oninput={(event) => { search = event.currentTarget.value; const selected = artifacts.find((item) => item.value === String(value ?? '')); if (selected && selected.label !== search) onChange(''); }} />
    {#if search && matchingArtifacts.length}
      <div class="m-stack" style="gap:4px;max-height:180px;overflow:auto" role="listbox" aria-label="Matching forms">
        {#each matchingArtifacts as artifact (artifact.value)}
          <button type="button" class="m-btn m-btn--ghost m-btn--sm" style="justify-content:flex-start" onclick={() => { onChange(artifact.value); search = artifact.label; }}>{artifact.label}</button>
        {/each}
      </div>
    {/if}
    {#if !artifacts.length}<span class="m-field__help">No forms are available in this workspace.</span>{/if}
  </label>
{:else if desc.kind === 'actions'}
  <ActionEditor {value} artifacts={artifacts.filter((item): item is { value: string; label: string; kind: 'form' | 'page' } => Boolean(item.kind))} onchange={onChange} />
{:else if desc.kind === 'condition'}
  <ConditionEditor label={desc.label} {value} onchange={onChange} />
{:else if desc.kind === 'json' || desc.kind === 'options' || desc.kind === 'columns'}
  {#if desc.kind === 'columns'}
    {@const selected = Array.isArray(value) ? value.map(String) : []}
    <div class="m-field">
      <span class="m-field__label">{desc.label}</span>
      {#if options.length}
        <div class="m-stack" style="gap:5px">
          {#each options as option (option)}
            <Checkbox label={option} value={selected.includes(option)} oninput={(checked) => onChange(checked ? [...new Set([...selected, option])] : selected.filter((column) => column !== option))} />
          {/each}
        </div>
      {:else}<span class="m-field__help">Select an entity to choose its fields.</span>{/if}
      <TextField label="Custom columns" value={selected.filter((column) => !options.includes(column)).join(', ')} placeholder="fieldA, fieldB" oninput={(raw) => { const custom = raw.split(',').map((part) => part.trim()).filter(Boolean); onChange([...options.filter((option) => selected.includes(option)), ...custom]); }} />
    </div>
  {:else}
  <JsonEditor label={desc.label} value={value ?? null} rows={6} oninput={(v) => onChange(v)} />
  {/if}
{:else if desc.kind === 'text'}
  <TextArea label={desc.label} value={String(value ?? '')} rows={3} oninput={(v) => onChange(v)} />
{:else if desc.kind === 'binding'}
  <label class="m-field">
    <span class="m-field__label">{desc.label}</span>
    <input class="m-input" list="mosaic-binding-options" value={String(value ?? '')} placeholder="Choose a field or enter a custom path" oninput={(event) => onChange(event.currentTarget.value)} />
    <datalist id="mosaic-binding-options">
      {#each options as option (option)}<option value={option}></option>{/each}
    </datalist>
    <span class="m-field__help">Suggestions come from the selected entity. Custom bindings are allowed.</span>
  </label>
{:else}
  <TextField
    label={desc.label}
    value={value === undefined || value === null ? '' : String(value)}
    placeholder={desc.placeholder}
    oninput={(v) => onChange(v)}
  />
{/if}
{#if desc.help}<span class="m-field__help">{desc.help}</span>{/if}
