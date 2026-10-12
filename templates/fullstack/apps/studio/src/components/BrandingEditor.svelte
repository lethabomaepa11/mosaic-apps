<script lang="ts">
  import { onMount } from 'svelte';
  import { Card, FileUpload, TextField, toast } from '@mosaic-apps/ui';
  import { client } from '#lib/client';
  let name = $state(''); let logo = $state(''); let fileId = $state<string | null>(null); let busy = $state(false);
  const preview = $derived(logo.startsWith('/files/') ? client.fileUrl(logo.slice('/files/'.length)) : logo);
  onMount(async () => { try { const brand = await client.branding(); name = brand.name; logo = brand.logo; } catch (reason) { toast.error('Could not load branding', String(reason)); } });
  async function save() {
    busy = true;
    try { await client.setSetting('app.name', name.trim(), 'Application display name'); await client.setSetting('app.logo', logo, 'Public application logo'); toast.success('Branding saved', 'Refresh the web application to see the updated brand.'); }
    catch (reason) { toast.error('Could not save branding', reason instanceof Error ? reason.message : String(reason)); }
    finally { busy = false; }
  }
</script>
<Card title="Application branding" subtitle="Set the application name and upload a public logo">
  <div class="m-stack">
    <TextField label="Application name" bind:value={name} required disabled={busy} />
    <FileUpload label="Upload logo" {client} purpose="brand" accept="image/png,image/jpeg,image/gif,image/webp" value={fileId} disabled={busy} oninput={id => { fileId = id; logo = id ? `/files/${id}` : ''; }} helpText="Uploaded logos are public brand assets. Save branding to use this logo in your application." />
    <TextField label="Logo URL" bind:value={logo} disabled={busy} placeholder="Uploaded file or https://example.com/logo.png" />
    {#if preview}<img src={preview} alt="Application logo preview" style="max-height:96px;max-width:260px;object-fit:contain" />{/if}
    <div><button type="button" class="m-btn m-btn--primary" disabled={busy || !name.trim()} onclick={save}>{busy ? 'Saving…' : 'Save branding'}</button></div>
  </div>
</Card>
