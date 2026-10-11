<script lang="ts">
  interface Props {
    label?: string;
    value?: number;
    oninput?: (value: number) => void;
    min?: number;
    max?: number;
    step?: number;
    disabled?: boolean;
    helpText?: string;
    showValue?: boolean;
  }

  let { label, value = $bindable(0), oninput, min = 0, max = 100, step = 1, disabled, helpText, showValue = true }: Props = $props();

  function onInput(e: Event & { currentTarget: EventTarget & HTMLInputElement }) {
    value = Number(e.currentTarget.value);
    oninput?.(value);
  }
</script>

<div class="m-field">
  {#if label}
    <span class="m-field__label">{label}{#if showValue}<span class="m-muted" style="margin-left:auto;font-weight:600">{value}</span>{/if}</span>
  {/if}
  <input class="m-range" type="range" {min} {max} {step} {disabled} {value} oninput={onInput} />
  {#if helpText}<span class="m-field__help">{helpText}</span>{/if}
</div>
