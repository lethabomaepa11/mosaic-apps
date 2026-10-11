<script lang="ts">
  import { TextField, TextArea, NumberField, Switch, SelectField, ColorPicker, JsonEditor } from '$ui';
  import type { PropDesc } from '$ui';

  interface Props {
    desc: PropDesc;
    value: unknown;
    onChange: (v: unknown) => void;
  }

  let { desc, value, onChange }: Props = $props();
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
{:else if desc.kind === 'json' || desc.kind === 'options' || desc.kind === 'columns'}
  <JsonEditor label={desc.label} value={value ?? null} rows={6} oninput={(v) => onChange(v)} />
{:else if desc.kind === 'text'}
  <TextArea label={desc.label} value={String(value ?? '')} rows={3} oninput={(v) => onChange(v)} />
{:else}
  <TextField
    label={desc.label}
    value={value === undefined || value === null ? '' : String(value)}
    placeholder={desc.placeholder}
    oninput={(v) => onChange(v)}
  />
{/if}
{#if desc.help}<span class="m-field__help">{desc.help}</span>{/if}
