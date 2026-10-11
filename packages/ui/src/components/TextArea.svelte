<script lang="ts">
  import ShadcnTextarea from '../shadcn/textarea/Textarea.svelte';
  interface Props {
    id?: string;
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

  let { id, label, value = $bindable(''), oninput, placeholder, rows = 3, required, disabled, error, helpText, maxlength }: Props = $props();
  const generatedId = $props.id();
  const inputId = $derived(id ?? generatedId);
  const messageId = $derived(`${inputId}-message`);

  function onInput(e: Event & { currentTarget: EventTarget & HTMLTextAreaElement }) {
    value = e.currentTarget.value;
    oninput?.(value);
  }
</script>

<div class="m-field">
  {#if label}<label for={inputId} class="m-field__label">{label}{#if required}<span class="m-field__req">*</span>{/if}</label>{/if}
  <ShadcnTextarea class={`m-textarea${error ? ' m-textarea--invalid' : ''}`} {rows} {placeholder} {disabled} {maxlength}
    id={inputId} {required} aria-invalid={!!error} aria-describedby={error || helpText ? messageId : undefined}
    value={value ?? ''} oninput={onInput}></ShadcnTextarea>
  {#if error}<span id={messageId} class="m-field__error">{error}</span>{:else if helpText}<span id={messageId} class="m-field__help">{helpText}</span>{/if}
</div>
