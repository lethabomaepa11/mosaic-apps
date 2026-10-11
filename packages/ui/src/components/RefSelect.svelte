<script lang="ts">
  import type { MosaicClient } from '../client/api';
  import SelectField from './SelectField.svelte';

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

</script>

<SelectField {label} {value} {options} {required} {disabled} {error} {helpText}
  placeholder={loading ? 'Loading…' : placeholder} clearable oninput={(next) => { value = next; oninput?.(next); }} />
