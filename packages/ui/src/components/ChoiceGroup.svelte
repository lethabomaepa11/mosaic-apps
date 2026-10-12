<script lang="ts">
  import { Checkbox as BitsCheckbox, RadioGroup as BitsRadioGroup } from 'bits-ui';
  import { Check, Circle } from '@lucide/svelte';
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
  {#if label}<span class="m-field__label">{label}{#if required}<span class="m-field__req" aria-hidden="true">*</span>{/if}</span>{/if}
  {#if mode === 'radio'}
    <BitsRadioGroup.Root class={inline ? 'm-choice m-choice--row' : 'm-choice'} value={Array.isArray(value) ? '' : (value ?? '')} onValueChange={pick} {disabled} {required} orientation={inline ? 'horizontal' : 'vertical'}>
      {#each opts as o (o.value)}
        <label class="m-check"><BitsRadioGroup.Item class="m-radio" value={o.value}><Circle size={8} fill="currentColor" /></BitsRadioGroup.Item><span>{o.label ?? o.value}</span></label>
      {/each}
    </BitsRadioGroup.Root>
  {:else}
    <div class="m-choice" class:m-choice--row={inline}>
      {#each opts as o (o.value)}
        <label class="m-check">
          <BitsCheckbox.Root class="m-checkbox" checked={isChecked(o.value)} {disabled} onCheckedChange={() => pick(o.value)} aria-label={o.label ?? o.value}>
            {#if isChecked(o.value)}<Check size={12} />{/if}
          </BitsCheckbox.Root>
          <span>{o.label ?? o.value}</span>
        </label>
      {/each}
    </div>
  {/if}
  {#if error}<span class="m-field__error">{error}</span>{:else if helpText}<span class="m-field__help">{helpText}</span>{/if}
</div>

<style>
  :global(.m-radio) { display:grid; place-items:center; width:17px; height:17px; padding:0; border:1px solid var(--m-border-strong); border-radius:50%; background:var(--m-surface); color:var(--m-primary); cursor:pointer; }
  :global(.m-radio[data-state='checked']) { border-color:var(--m-primary); }
  :global(.m-radio:focus-visible), :global(.m-checkbox:focus-visible) { outline:2px solid var(--m-primary); outline-offset:2px; }
  :global(.m-radio:disabled), :global(.m-checkbox:disabled) { opacity:.55; cursor:not-allowed; }
</style>
