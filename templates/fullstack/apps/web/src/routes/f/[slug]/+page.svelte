<script lang="ts">
  import { page } from '$app/state';
  import { FormRenderer } from '@mosaic-apps/ui';
  import type { FormDef } from '@mosaic-apps/core';
  import { client } from '#lib/client';

  const slug = $derived(page.params.slug ?? '');
  const recordId = $derived(page.url.searchParams.get('id') ?? undefined);

  let form = $state<FormDef | null>(null);
  let error = $state('');
  let request = 0;
  const runtimeForm = $derived(form && recordId && form.entity ? { ...form, dataSource: { kind: 'entity' as const, entity: form.entity, recordId } } : form);

  $effect(() => {
    form = null;
    error = '';
    const current = ++request;
    client
      .getForm(slug)
      .then((f) => { if (current === request) form = f; })
      .catch((err) => { if (current === request) error = err instanceof Error ? err.message : String(err); });
    return () => { request += 1; };
  });
</script>

<svelte:head><title>{form?.name ?? 'Form'} · __PROJECT_NAME__</title></svelte:head>

{#if error}
  <div class="m-alert m-alert--warning" style="max-width:640px">{error}</div>
{:else if form && runtimeForm}
  <div class="m-card" style="max-width:820px">
    <header class="m-card__header">
      <div>
        <h1 class="m-card__title">{form.name}</h1>
        {#if form.description}<div class="m-small m-muted">{form.description}</div>{/if}
      </div>
      <span class="m-badge">v{form.version}</span>
    </header>
    <FormRenderer
      form={runtimeForm}
      {client}
    />
  </div>
{:else}
  <div class="m-card"><span class="m-spinner"></span> Loading form…</div>
{/if}
