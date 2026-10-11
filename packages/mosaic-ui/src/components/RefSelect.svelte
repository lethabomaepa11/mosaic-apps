<script lang="ts">
  import type { MosaicClient } from '../client/api';

  interface Props {
    label?: string;
    value?: string | null;
    oninput?: (value: string | null) => void;
    /** entity name to load options from */
    entity?: string;
    /** client instance (injected by FormRenderer via context or props) */
    client?: MosaicClient;
    placeholder?: string;
    required?: boolean;
    disabled?: boolean;
    error?: string | null;
    helpText?: string;
  }

  let { label, value = $bindable<string | null>(null), oninput, entity, client, placeholder = 'Select record…', required, disabled, error, helpText }: Props = $props();

  let options = $state<{ value: string; label: string }[]>([]);
  let loading = $state(false);
  let loadedFor = '';

  $effect(() => {
    const target = entity;
    const cl = client;
    if (!target || !cl || loadedFor === target) return;
    loadedFor = target;
    loading = true;
    cl.entityOptions(target, undefined, 200)
      .then((opts) => { options = opts; })
      .catch(() => { options = []; })
      .finally(() => { loading = false; });
  });

  function onChange(e: Event & { currentTarget: EventTarget & HTMLSelectElement }) {
    const v = e.currentTarget.value;
    value = v === '' ? null : v;
    oninput?.(value);
  }
</script>

<div class="m-field">
  {#if label}<span class="m-field__label">{label}{#if required}<span class="m-field__req">*</span>{/if}</span>{/if}
  <select class="m-select" class:m-select--invalid={!!error} {disabled} value={value ?? ''} onchange={onChange}>
    <option value="">{loading ? 'Loading…' : placeholder}</option>
    {#each options as o (o.value)}
      <option value={o.value}>{o.label}</option>
    {/each}
  </select>
  {#if error}<span class="m-field__error">{error}</span>{:else if helpText}<span class="m-field__help">{helpText}</span>{/if}
</div>
