<script lang="ts">
  import type { MosaicClient } from '../client/api';
  import ShadcnInput from '../shadcn/input/Input.svelte';
  import ShadcnButton from '../shadcn/button/Button.svelte';

  interface Props {
    label?: string;
    value?: string | null;
    oninput?: (fileId: string | null) => void;
    client?: MosaicClient;
    accept?: string;
    disabled?: boolean;
    helpText?: string;
    required?: boolean;
    error?: string;
    purpose?: 'brand';
  }

  let { label, value = $bindable<string | null>(null), oninput, client, accept, disabled, helpText, required, error, purpose }: Props = $props();

  let uploading = $state(false);
  let fileName = $state('');
  let uploadError = $state('');
  const inputId = $props.id();

  async function onUpload(e: Event & { currentTarget: EventTarget & HTMLInputElement }) {
    const file = e.currentTarget.files?.[0];
    if (!file) return;
    if (!client) {
      uploadError = 'File upload requires an API client';
      return;
    }
    uploading = true;
    uploadError = '';
    try {
      const result = await client.uploadFile(file, purpose);
      value = result.id; fileName = result.filename; oninput?.(result.id);
    } catch (reason) {
      uploadError = reason instanceof Error ? reason.message : 'Upload failed. Try again.';
    } finally {
      uploading = false;
      e.currentTarget.value = '';
    }
  }
  async function download() {
    if (!value || !client) return;
    try {
      const blob = await client.downloadFile(value);
      const url = URL.createObjectURL(blob); const link = document.createElement('a');
      link.href = url; link.download = fileName || 'attachment'; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (reason) { uploadError = reason instanceof Error ? reason.message : 'Download failed.'; }
  }
</script>

<div class="m-field">
  {#if label}<label class="m-field__label" for={inputId}>{label}</label>{/if}
  <ShadcnInput id={inputId} class="m-file" type="file" {accept} disabled={disabled || uploading} required={required && !value} aria-invalid={!!error || !!uploadError} onchange={onUpload} />
  {#if uploading}<span class="m-field__help">Uploading…</span>{/if}
  {#if value}<span class="m-field__help">Attached: {fileName || 'Saved attachment'}</span><div class="m-row"><ShadcnButton type="button" variant="secondary" size="sm" onclick={download} disabled={!client}>Download attachment</ShadcnButton>{#if !disabled}<ShadcnButton type="button" variant="ghost" size="sm" onclick={() => { value = null; fileName = ''; oninput?.(null); }}>Clear attachment</ShadcnButton>{/if}</div>{/if}
  {#if error || uploadError}<span class="m-field__error" role="alert">{error || uploadError}</span>{/if}
  {#if helpText}<span class="m-field__help">{helpText}</span>{/if}
</div>
