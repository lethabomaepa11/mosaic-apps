<script lang="ts">
  interface Props {
    label?: string;
    value?: number;
    oninput?: (value: number) => void;
    count?: number;
    disabled?: boolean;
    helpText?: string;
  }

  let { label, value = $bindable(0), oninput, count = 5, disabled, helpText }: Props = $props();

  function set(v: number) {
    value = v;
    oninput?.(v);
  }
</script>

<div class="m-field">
  {#if label}<span class="m-field__label">{label}</span>{/if}
  <div class="m-rate" role="group" aria-label={label ?? 'Rating'}>
    {#each Array.from({ length: count }, (_, i) => i + 1) as n (n)}
      <button type="button" class:on={n <= value} {disabled} aria-label={`${n} star${n > 1 ? 's' : ''}`} onclick={() => set(n)}>★</button>
    {/each}
  </div>
  {#if helpText}<span class="m-field__help">{helpText}</span>{/if}
</div>
