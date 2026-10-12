<script lang="ts">
  import { Slider as BitsSlider } from 'bits-ui';
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

  function onInput(next: number) {
    value = next;
    oninput?.(value);
  }
</script>

<div class="m-field">
  {#if label}
    <span class="m-field__label">{label}{#if showValue}<span class="m-muted" style="margin-left:auto;font-weight:600">{value}</span>{/if}</span>
  {/if}
  <BitsSlider.Root type="single" class="m-slider" {min} {max} {step} {disabled} {value} onValueChange={onInput}>
    <span class="m-slider__track"><BitsSlider.Range class="m-slider__range" /></span>
    <BitsSlider.Thumb index={0} class="m-slider__thumb" aria-label={label ?? 'Value'} />
  </BitsSlider.Root>
  {#if helpText}<span class="m-field__help">{helpText}</span>{/if}
</div>
<style>
  :global(.m-slider) { position:relative;display:flex;align-items:center;width:100%;height:24px;touch-action:none;user-select:none; }.m-slider__track { position:relative;height:6px;width:100%;border-radius:99px;background:var(--m-border);overflow:hidden; }:global(.m-slider__range) { position:absolute;height:100%;background:var(--m-primary); }:global(.m-slider__thumb) { display:block;width:18px;height:18px;border-radius:50%;border:2px solid var(--m-primary);background:var(--m-surface);box-shadow:var(--m-shadow-sm); }:global(.m-slider__thumb:focus-visible) { outline:2px solid var(--m-primary);outline-offset:3px; }:global(.m-slider[data-disabled]) { opacity:.5; }
</style>
