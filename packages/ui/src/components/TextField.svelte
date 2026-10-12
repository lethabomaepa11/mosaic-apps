<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { FullAutoFill } from 'svelte/elements';
  import ShadcnInput from '../shadcn/input/Input.svelte';

  interface Props {
    id?: string;
    label?: string;
    value?: string | number;
    oninput?: (value: string) => void;
    format?: 'text' | 'email' | 'password' | 'url' | 'phone' | 'slug' | 'money' | 'color';
    placeholder?: string;
    required?: boolean;
    disabled?: boolean;
    error?: string | null;
    helpText?: string;
    maxlength?: number;
    autocomplete?: FullAutoFill | undefined;
  }

  let {
    id,
    label,
    value = $bindable(''),
    oninput,
    format = 'text',
    placeholder,
    required,
    disabled,
    error,
    helpText,
    maxlength,
    autocomplete,
  }: Props = $props();
  const generatedId = $props.id();
  const inputId = $derived(id ?? generatedId);
  const messageId = $derived(`${inputId}-message`);

  const inputType = $derived(
    format === 'email' ? 'email'
      : format === 'password' ? 'password'
        : format === 'url' ? 'url'
          : format === 'phone' ? 'tel'
            : format === 'slug' ? 'text'
              : format === 'color' ? 'color'
                : format === 'money' ? 'text'
                  : 'text',
  );

  function onInput(e: Event & { currentTarget: EventTarget & HTMLInputElement }) {
    const v = e.currentTarget.value;
    if (format === 'money') {
      const digits = v.replace(/[^\d.-]/g, '');
      value = digits;
      oninput?.(digits);
    } else {
      value = v;
      oninput?.(v);
    }
  }
</script>

<div class="m-field">
  {#if label}
    <label for={inputId} class="m-field__label">{label}{#if required}<span class="m-field__req" aria-hidden="true">*</span>{/if}</label>
  {/if}
  {#if format === 'money'}
    <div class="m-search" style="position:relative">
      <span class="m-search__icon">$</span>
      <ShadcnInput class={`m-input${error ? ' m-input--invalid' : ''}`} style="padding-left:26px"
        id={inputId} {required} aria-invalid={!!error} ariaDescribedBy={error || helpText ? messageId : undefined}
        type="text" inputmode="decimal" {placeholder} {disabled} {maxlength} {autocomplete}
        value={String(value ?? '')} oninput={onInput} />
    </div>
  {:else}
    <ShadcnInput class={`m-input${error ? ' m-input--invalid' : ''}`}
      id={inputId} {required} aria-invalid={!!error} ariaDescribedBy={error || helpText ? messageId : undefined}
      type={inputType} {placeholder} {disabled} {maxlength} {autocomplete}
      value={String(value ?? '')} oninput={onInput} />
  {/if}
  {#if error}
    <span id={messageId} class="m-field__error">{error}</span>
  {:else if helpText}
    <span id={messageId} class="m-field__help">{helpText}</span>
  {/if}
</div>
