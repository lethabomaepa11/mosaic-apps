<script lang="ts">
  interface Props {
    label?: string;
    value?: boolean;
    oninput?: (value: boolean) => void;
    disabled?: boolean;
    helpText?: string;
  }

  let { label, value = $bindable(false), oninput, disabled, helpText }: Props = $props();

  function onChange(e: Event & { currentTarget: EventTarget & HTMLInputElement }) {
    value = e.currentTarget.checked;
    oninput?.(value);
  }
</script>

<div class="m-field m-field--inline">
  {#if label}<span class="m-field__label">{label}</span>{/if}
  <label class="m-switch" title={helpText}>
    <input type="checkbox" checked={value} {disabled} onchange={onChange} />
    <span class="m-switch__track"></span>
  </label>
</div>
