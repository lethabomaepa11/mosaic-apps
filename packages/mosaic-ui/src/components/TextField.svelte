<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { FullAutoFill } from 'svelte/elements';

  interface Props {
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
    <span class="m-field__label">{label}{#if required}<span class="m-field__req">*</span>{/if}</span>
  {/if}
  {#if format === 'money'}
    <div class="m-search" style="position:relative">
      <span class="m-search__icon">$</span>
      <input class="m-input" class:m-input--invalid={!!error} style="padding-left:26px"
        type="text" inputmode="decimal" {placeholder} {disabled} {maxlength} {autocomplete}
        value={String(value ?? '')} oninput={onInput} />
    </div>
  {:else}
    <input class="m-input" class:m-input--invalid={!!error}
      type={inputType} {placeholder} {disabled} {maxlength} {autocomplete}
      value={String(value ?? '')} oninput={onInput} />
  {/if}
  {#if error}
    <span class="m-field__error">{error}</span>
  {:else if helpText}
    <span class="m-field__help">{helpText}</span>
  {/if}
</div>
