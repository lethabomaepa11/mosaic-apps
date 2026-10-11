<script lang="ts">
  import { Checkbox as BitsCheckbox } from 'bits-ui';
  import { Check } from 'lucide-svelte';
  import type { Option } from './SelectField.svelte';

  interface Props {
    label?: string;
    value?: string[];
    oninput?: (value: string[]) => void;
    options?: Option[] | string[];
    required?: boolean;
    disabled?: boolean;
    error?: string | null;
    helpText?: string;
  }

  let { label, value = $bindable<string[]>([]), oninput, options = [], required, disabled, error, helpText }: Props = $props();

  const opts = $derived((options ?? []).map((o) => (typeof o === 'string' ? { value: o, label: o } : o)));

  function toggle(v: string) {
    const set = new Set(value ?? []);
    if (set.has(v)) set.delete(v); else set.add(v);
    value = [...set];
    oninput?.(value);
  }
</script>

<div class="m-field">
  {#if label}<span class="m-field__label">{label}{#if required}<span class="m-field__req">*</span>{/if}</span>{/if}
  <div class="m-choice m-choice--row">
    {#each opts as o (o.value)}
      <label class="m-check">
        <BitsCheckbox.Root class="m-checkbox" checked={(value ?? []).includes(o.value)} {disabled} onCheckedChange={() => toggle(o.value)} aria-label={o.label ?? o.value}>
          {#if (value ?? []).includes(o.value)}<Check size={12} />{/if}
        </BitsCheckbox.Root>
        <span>{o.label ?? o.value}</span>
      </label>
    {/each}
  </div>
  {#if error}<span class="m-field__error">{error}</span>{:else if helpText}<span class="m-field__help">{helpText}</span>{/if}
</div>
