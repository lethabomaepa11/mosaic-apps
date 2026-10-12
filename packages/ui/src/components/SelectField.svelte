<script lang="ts">
  import { Select as BitsSelect } from 'bits-ui';

  export interface Option {
    value: string;
    label?: string;
    color?: string;
  }

  interface Props {
    label?: string;
    value?: string | null;
    oninput?: (value: string | null) => void;
    options?: Option[] | string[];
    placeholder?: string;
    required?: boolean;
    disabled?: boolean;
    error?: string | null;
    helpText?: string;
    clearable?: boolean;
  }

  let { label, value = $bindable<string | null>(null), oninput, options = [], placeholder = 'Select…', required, disabled, error, helpText, clearable = true }: Props = $props();
  const noneValue = '__mosaic_no_selection__';
  const selectedValue = $derived(value ?? undefined);
  const opts = $derived((options ?? []).map((o) => (typeof o === 'string' ? { value: o, label: o } : o)));
  const selectItems = $derived([
    ...(clearable ? [{ value: noneValue, label: placeholder }] : []),
    ...opts.map((option) => ({ value: option.value, label: option.label ?? option.value })),
  ]);

  function onValueChange(next: string) {
    value = next === noneValue ? null : next;
    oninput?.(value);
  }
</script>

<div class="m-field">
  {#if label}<span class="m-field__label">{label}{#if required}<span class="m-field__req" aria-hidden="true">*</span>{/if}</span>{/if}
  <BitsSelect.Root type="single" value={selectedValue} items={selectItems} {onValueChange} {disabled} {required}>
    <BitsSelect.Trigger class={error ? 'm-select m-select--invalid' : 'm-select'} aria-label={label ?? placeholder} aria-invalid={!!error}>
      <BitsSelect.Value placeholder={placeholder} />
    </BitsSelect.Trigger>
    <BitsSelect.Portal>
      <BitsSelect.Content class="m-select__content" sideOffset={4}>
        <BitsSelect.Viewport>
          {#if clearable}
            <BitsSelect.Item value={noneValue} class="m-select__option">{placeholder}</BitsSelect.Item>
          {/if}
          {#each opts as option (option.value)}
            <BitsSelect.Item value={option.value} class="m-select__option">{option.label ?? option.value}</BitsSelect.Item>
          {/each}
        </BitsSelect.Viewport>
      </BitsSelect.Content>
    </BitsSelect.Portal>
  </BitsSelect.Root>
  {#if error}<span class="m-field__error">{error}</span>{:else if helpText}<span class="m-field__help">{helpText}</span>{/if}
</div>
