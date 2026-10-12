<script lang="ts">
  import ShadcnInput from '../shadcn/input/Input.svelte';
  interface Props {
    id?: string;
    label?: string;
    value?: number | string | null;
    oninput?: (value: number | null) => void;
    placeholder?: string;
    min?: number;
    max?: number;
    step?: number;
    required?: boolean;
    disabled?: boolean;
    error?: string | null;
    helpText?: string;
  }

  let { id, label, value = $bindable<number | string | null>(null), oninput, placeholder, min, max, step = 1, required, disabled, error, helpText }: Props = $props();
  const generatedId = $props.id();
  const inputId = $derived(id ?? generatedId);
  const messageId = $derived(`${inputId}-message`);

  function onInput(e: Event & { currentTarget: EventTarget & HTMLInputElement }) {
    const raw = e.currentTarget.value;
    if (raw === '') {
      value = null;
      oninput?.(null);
      return;
    }
    const n = Number(raw);
    const valid = Number.isFinite(n) && (min === undefined || n >= min) && (max === undefined || n <= max);
    value = valid ? n : raw;
    oninput?.(valid ? n : null);
  }
</script>

<div class="m-field">
  {#if label}<label for={inputId} class="m-field__label">{label}{#if required}<span class="m-field__req" aria-hidden="true">*</span>{/if}</label>{/if}
  <ShadcnInput class={`m-input${error ? ' m-input--invalid' : ''}`}
    id={inputId} {required} aria-invalid={!!error} ariaDescribedBy={error || helpText ? messageId : undefined}
    type="number" inputmode="decimal" {placeholder} {min} {max} {step} {disabled}
    value={value === null || value === undefined ? '' : String(value)}
    oninput={onInput} />
  {#if error}<span id={messageId} class="m-field__error">{error}</span>{:else if helpText}<span id={messageId} class="m-field__help">{helpText}</span>{/if}
</div>
