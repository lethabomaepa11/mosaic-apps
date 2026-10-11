<script lang="ts">
  import type { MosaicClient } from '../client/api';

  interface Props {
    label?: string;
    value?: string | null;
    oninput?: (fileId: string | null) => void;
    client?: MosaicClient;
    accept?: string;
    disabled?: boolean;
    helpText?: string;
  }

  let { label, value = $bindable<string | null>(null), oninput, client, accept, disabled, helpText }: Props = $props();

  let uploading = $state(false);
  let fileName = $state('');

  async function onUpload(e: Event & { currentTarget: EventTarget & HTMLInputElement }) {
    const file = e.currentTarget.files?.[0];
    if (!file) return;
    if (!client) {
      helpText = 'File upload requires an API client';
      return;
    }
    uploading = true;
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`${client.apiBase}/files`, {
        method: 'POST',
        headers: client.token ? { Authorization: `Bearer ${client.token}` } : {},
        body: form,
      });
      const json = (await res.json()) as { success: boolean; data?: { id: string; filename: string } };
      if (json.success && json.data) {
        value = json.data.id;
        fileName = json.data.filename;
        oninput?.(json.data.id);
      }
    } finally {
      uploading = false;
    }
  }
</script>

<div class="m-field">
  {#if label}<span class="m-field__label">{label}</span>{/if}
  <input class="m-file" type="file" {accept} {disabled} onchange={onUpload} />
  {#if uploading}<span class="m-field__help">Uploading…</span>{/if}
  {#if fileName}<span class="m-field__help">Attached: {fileName}</span>{/if}
  {#if helpText}<span class="m-field__help">{helpText}</span>{/if}
</div>
