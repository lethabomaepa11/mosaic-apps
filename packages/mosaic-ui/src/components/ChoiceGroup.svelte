<script lang="ts">
  import type { Option } from './SelectField.svelte';

  interface Props {
    label?: string;
    /** radio: string; checkbox group: string[] */
    value?: string | string[] | null;
    oninput?: (value: string | string[]) => void;
    options?: Option[] | string[];
    mode?: 'radio' | 'checkbox';
    inline?: boolean;
    required?: boolean;
    disabled?: boolean;
    error?: string | null;
    helpText?: string;
  }

  let { label, value = $bindable<string | string[] | null>(null), oninput, options = [], mode = 'radio', inline = true, required, disabled, error, helpText }: Props = $props();

  const opts = $derived((options ?? []).map((o) => (typeof o === 'string' ? { value: o, label: o } : o)));

  function pick(v: string) {
    if (mode === 'radio') {
      value = v;
      oninput?.(v);
    } else {
      const set = new Set(Array.isArray(value) ? value : []);
      if (set.has(v)) set.delete(v); else set.add(v);
      value = [...set];
      oninput?.(value);
    }
  }

  function isChecked(v: string): boolean {
    return Array.isArray(value) ? value.includes(v) : value === v;
  }
</script>

<div class="m-field">
  {#if label}<span class="m-field__label">{label}{#if required}<span class="m-field__req">*</span>{/if}</span>{/if}
  <div class="m-choice" class:m-choice--row={inline}>
    {#each opts as o (o.value)}
      <label class="m-check">
        <input type={mode === 'radio' ? 'radio' : 'checkbox'} name={`grp_${o.value}`}
          checked={isChecked(o.value)} {disabled} onchange={() => pick(o.value)} />
        <span>{o.label ?? o.value}</span>
      </label>
    {/each}
  </div>
  {#if error}<span class="m-field__error">{error}</span>{:else if helpText}<span class="m-field__help">{helpText}</span>{/if}
</div>
