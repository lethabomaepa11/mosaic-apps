<script lang="ts">
  interface Props {
    label?: string;
    value?: unknown;
    oninput?: (value: unknown) => void;
    rows?: number;
    disabled?: boolean;
    helpText?: string;
  }

  let { label, value = $bindable<unknown>(null), oninput, rows = 6, disabled, helpText }: Props = $props();

  let text = $state(typeof value === 'string' ? value : value === null || value === undefined ? '' : JSON.stringify(value, null, 2));
  let error = $state('');

  function onInput(e: Event & { currentTarget: EventTarget & HTMLTextAreaElement }) {
    text = e.currentTarget.value;
    if (!text.trim()) {
      value = null;
      error = '';
      oninput?.(null);
      return;
    }
    try {
      value = JSON.parse(text);
      error = '';
      oninput?.(value);
    } catch (err) {
      error = (err as Error).message;
    }
  }
</script>

<div class="m-field">
  {#if label}<span class="m-field__label">{label}</span>{/if}
  <textarea class="m-textarea m-mono" class:m-textarea--invalid={!!error} {rows} {disabled} spellcheck="false" oninput={onInput}>{text}</textarea>
  {#if error}<span class="m-field__error">{error}</span>{:else if helpText}<span class="m-field__help">{helpText}</span>{/if}
</div>
