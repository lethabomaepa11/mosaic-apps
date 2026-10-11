<script lang="ts">
  import { Switch as BitsSwitch } from 'bits-ui';
  interface Props {
    label?: string;
    value?: boolean;
    oninput?: (value: boolean) => void;
    disabled?: boolean;
    helpText?: string;
  }

  let { label, value = $bindable(false), oninput, disabled, helpText }: Props = $props();

  function onCheckedChange(next: boolean) {
    value = next;
    oninput?.(next);
  }
</script>

<div class="m-field m-field--inline">
  {#if label}<span class="m-field__label">{label}</span>{/if}
  <BitsSwitch.Root class="m-switch" checked={value} {disabled} {onCheckedChange} aria-label={label ?? helpText ?? 'Toggle'}>
    <BitsSwitch.Thumb class="m-switch__thumb" />
  </BitsSwitch.Root>
</div>
