<script lang="ts">
  import { Checkbox as BitsCheckbox } from 'bits-ui';
  import { Check } from '@lucide/svelte';

  interface Props {
    label?: string;
    value?: boolean;
    oninput?: (value: boolean) => void;
    disabled?: boolean;
    required?: boolean;
    helpText?: string;
  }

  let { label, value = $bindable(false), oninput, disabled, required, helpText }: Props = $props();

  function onCheckedChange(next: boolean | 'indeterminate') {
    value = next === true;
    oninput?.(value);
  }
</script>

<div class="m-field">
  <label class="m-check">
    <BitsCheckbox.Root class="m-checkbox" checked={value} {disabled} {onCheckedChange} aria-label={label ?? helpText ?? 'Checkbox'}>
      {#if value}<Check size={12} />{/if}
    </BitsCheckbox.Root>
    <span>{label ?? 'Checkbox'}{#if required}<span class="m-field__req" aria-hidden="true">*</span>{/if}</span>
  </label>
  {#if helpText}<span class="m-field__help">{helpText}</span>{/if}
</div>

<style>
  :global(.m-checkbox) { display:inline-grid; place-items:center; width:17px; height:17px; padding:0; border:1px solid var(--m-border-strong); border-radius:4px; background:var(--m-surface); color:white; cursor:pointer; }
  :global(.m-checkbox[data-state='checked']) { background:var(--m-primary); border-color:var(--m-primary); }
  :global(.m-checkbox:focus-visible) { outline:2px solid var(--m-primary); outline-offset:2px; }
  :global(.m-checkbox:disabled) { opacity:.55; cursor:not-allowed; }
</style>
