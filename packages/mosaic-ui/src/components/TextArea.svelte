<script lang="ts">
  interface Props {
    label?: string;
    value?: string;
    oninput?: (value: string) => void;
    placeholder?: string;
    rows?: number;
    required?: boolean;
    disabled?: boolean;
    error?: string | null;
    helpText?: string;
    maxlength?: number;
  }

  let { label, value = $bindable(''), oninput, placeholder, rows = 3, required, disabled, error, helpText, maxlength }: Props = $props();

  function onInput(e: Event & { currentTarget: EventTarget & HTMLTextAreaElement }) {
    value = e.currentTarget.value;
    oninput?.(value);
  }
</script>

<div class="m-field">
  {#if label}<span class="m-field__label">{label}{#if required}<span class="m-field__req">*</span>{/if}</span>{/if}
  <textarea class="m-textarea" class:m-textarea--invalid={!!error} {rows} {placeholder} {disabled} {maxlength}
    oninput={onInput}>{value ?? ''}</textarea>
  {#if error}<span class="m-field__error">{error}</span>{:else if helpText}<span class="m-field__help">{helpText}</span>{/if}
</div>
