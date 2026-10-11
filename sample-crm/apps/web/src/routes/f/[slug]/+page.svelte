<script lang="ts">
  import { page } from '$app/state';
  import { onMount } from 'svelte';
  import { FormRenderer } from '@mosaic-apps/ui';
  import type { FormDef } from '@mosaic-apps/core';
  import { client } from '#lib/client';

  const slug = $derived(page.params.slug);
  const recordId = $derived(page.url.searchParams.get('id') ?? undefined);

  let form = $state<FormDef | null>(null);
  let record = $state<Record<string, unknown> | undefined>(undefined);
  let error = $state('');
  let mode = $state<'create' | 'edit'>('create');

  $effect(() => {
    form = null;
    error = '';
    client
      .getForm(slug)
      .then((f) => {
        form = f;
        if (recordId) {
          mode = 'edit';
          return client.getRecord(f.entity ?? '', recordId);
        }
        return undefined;
      })
      .then((r) => { record = r; })
      .catch((err) => { error = err instanceof Error ? err.message : String(err); });
  });
</script>

<svelte:head><title>{form?.name ?? 'Form'} · Sample Crm</title></svelte:head>

{#if error}
  <div class="m-alert m-alert--warning" style="max-width:640px">{error}</div>
{:else if form}
  <div class="m-card" style="max-width:820px">
    <header class="m-card__header">
      <div>
        <h1 class="m-card__title">{form.name}</h1>
        {#if form.description}<div class="m-small m-muted">{form.description}</div>{/if}
      </div>
      <span class="m-badge">v{form.version}</span>
    </header>
    <FormRenderer
      {form}
      {record}
      {mode}
      {client}
      onsaved={() => {
        if (form.settings?.redirectAfterSubmit) window.location.href = form.settings.redirectAfterSubmit;
      }}
    />
  </div>
{:else}
  <div class="m-card"><span class="m-spinner"></span> Loading form…</div>
{/if}
