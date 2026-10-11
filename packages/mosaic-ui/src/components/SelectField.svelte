<script lang="ts">
  export interface Option {
    value: string;
    label?: string;
    color?: string;
  }

  interface Props {
    label?: string;
    value?: string | null;
    oninput?: (value: string | null) => void;
    options?: Option[] | string[];
    placeholder?: string;
    required?: boolean;
    disabled?: boolean;
    error?: string | null;
    helpText?: string;
    clearable?: boolean;
  }

  let { label, value = $bindable<string | null>(null), oninput, options = [], placeholder = 'Select…', required, disabled, error, helpText, clearable = true }: Props = $props();

  const opts = $derived((options ?? []).map((o) => (typeof o === 'string' ? { value: o, label: o } : o)));

  function onChange(e: Event & { currentTarget: EventTarget & HTMLSelectElement }) {
    const v = e.currentTarget.value;
    value = v === '' ? null : v;
    oninput?.(value);
  }
</script>

<div class="m-field">
  {#if label}<span class="m-field__label">{label}{#if required}<span class="m-field__req">*</span>{/if}</span>{/if}
  <select class="m-select" class:m-select--invalid={!!error} {disabled} value={value ?? ''} onchange={onChange}>
    {#if clearable}<option value="">{placeholder}</option>{/if}
    {#each opts as o (o.value)}
      <option value={o.value}>{o.label ?? o.value}</option>
    {/each}
  </select>
  {#if error}<span class="m-field__error">{error}</span>{:else if helpText}<span class="m-field__help">{helpText}</span>{/if}
</div>
