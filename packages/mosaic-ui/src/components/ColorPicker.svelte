<script lang="ts">
  interface Props {
    label?: string;
    value?: string;
    oninput?: (value: string) => void;
    presets?: string[];
    disabled?: boolean;
    helpText?: string;
  }

  let { label, value = $bindable('#6366f1'), oninput, presets = [], disabled, helpText }: Props = $props();

  function onChange(e: Event & { currentTarget: EventTarget & HTMLInputElement }) {
    value = e.currentTarget.value;
    oninput?.(value);
  }
</script>

<div class="m-field m-field--inline">
  {#if label}<span class="m-field__label">{label}</span>{/if}
  <input class="m-color" type="color" {value} {disabled} oninput={onChange} />
  {#if presets.length}
    <span class="m-row" style="gap:5px">
      {#each presets as p (p)}
        <button type="button" class="m-btn m-btn--icon" style="background:{p};border:1px solid var(--m-border);width:22px;height:22px;padding:0"
          {disabled} aria-label={`Use ${p}`} onclick={() => { value = p; oninput?.(p); }}></button>
      {/each}
    </span>
  {/if}
  {#if helpText}<span class="m-field__help">{helpText}</span>{/if}
</div>
