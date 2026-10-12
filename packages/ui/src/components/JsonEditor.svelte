<script lang="ts">
  import CodeEditorField from './CodeEditorField.svelte';

  interface Props {
    label?: string;
    value?: unknown;
    oninput?: (value: unknown) => void;
    rows?: number;
    disabled?: boolean;
    readOnly?: boolean;
    helpText?: string;
    validate?: (value: unknown) => string | undefined;
  }
  let { label = 'JSON', value = $bindable<unknown>(null), oninput, disabled, readOnly = false, helpText, validate }: Props = $props();
  const text = $derived(JSON.stringify(value ?? null, null, 2));
  function validateJson(raw: string): string | undefined {
    try { const parsed: unknown = JSON.parse(raw); return validate?.(parsed); }
    catch (error) { return error instanceof Error ? error.message : 'Enter valid JSON'; }
  }
  function apply(raw: string) { value = JSON.parse(raw); oninput?.(value); }
</script>

<CodeEditorField {label} value={text} language="json" disabled={!!disabled && !readOnly} {readOnly} {helpText} validate={validateJson} oninput={apply} />
