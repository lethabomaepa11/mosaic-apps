<script lang="ts">
  interface Props {
    label?: string;
    /** ISO date 'YYYY-MM-DD' or datetime string */
    value?: string;
    oninput?: (value: string) => void;
    withTime?: boolean;
    min?: string;
    max?: string;
    required?: boolean;
    disabled?: boolean;
    error?: string | null;
    helpText?: string;
  }

  let { label, value = $bindable(''), oninput, withTime = false, min, max, required, disabled, error, helpText }: Props = $props();

  const inputType = $derived(withTime ? 'datetime-local' : 'date');

  function onInput(e: Event & { currentTarget: EventTarget & HTMLInputElement }) {
    value = e.currentTarget.value;
    oninput?.(value);
  }
</script>

<div class="m-field">
  {#if label}<span class="m-field__label">{label}{#if required}<span class="m-field__req">*</span>{/if}</span>{/if}
  <input class="m-input" class:m-input--invalid={!!error}
    type={inputType} {min} {max} {disabled} value={value ?? ''} oninput={onInput} />
  {#if error}<span class="m-field__error">{error}</span>{:else if helpText}<span class="m-field__help">{helpText}</span>{/if}
</div>
