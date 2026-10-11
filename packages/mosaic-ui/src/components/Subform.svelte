<script lang="ts">
  import { getContext, setContext } from 'svelte';
  import type { FormDef } from '@mosaic-apps/mosaic-core';
  import type { MosaicClient } from '../client/api';
  import FormRenderer from '../render/FormRenderer.svelte';

  interface Props {
    formId?: string;
    props?: Record<string, unknown>;
    value?: Record<string, unknown>;
    mode?: 'create' | 'edit' | 'view';
    client?: MosaicClient;
    oninput?: (value: Record<string, unknown>) => void;
  }

  let { formId = '', props = {}, value = $bindable<Record<string, unknown>>({}), mode = 'create', client, oninput }: Props = $props();
  let form = $state<FormDef | null>(null);
  let loading = $state(false);
  let error = $state('');
  let requestId = 0;
  const parentContext = getContext<{ ids: string[] }>('mosaic:embedded-form-stack');
  const ancestors = $derived(parentContext?.ids ?? []);
  const repeatedForm = $derived(formId !== '' && ancestors.includes(formId));
  const tooDeep = $derived(ancestors.length >= 8);
  const initialData = $derived({ ...props, ...(value ?? {}) });

  $effect(() => {
    const id = formId.trim();
    const api = client;
    const current = ++requestId;
    form = null;
    error = '';
    if (!id || repeatedForm || tooDeep) return;
    if (!api) {
      error = 'A runtime API client is required to load this form.';
      return;
    }
    loading = true;
    void api.getForm(id).then((definition) => {
      if (current === requestId) form = definition;
    }).catch((reason: unknown) => {
      if (current === requestId) error = reason instanceof Error ? reason.message : 'Could not load the embedded form.';
    }).finally(() => {
      if (current === requestId) loading = false;
    });
    return () => { requestId += 1; };
  });

  function update(next: Record<string, unknown>) {
    value = next;
    oninput?.(next);
  }
</script>

{#if form}
  <section class="m-subform" aria-label={form.name}>
    <FormRenderer {form} record={initialData} {mode} {client} showActions={false} includeMetadata={false} onchange={update} />
  </section>
{:else if repeatedForm}
  <div class="m-alert m-alert--warning" role="status">This form is already embedded above. Recursive form embedding is not allowed.</div>
{:else if tooDeep}
  <div class="m-alert m-alert--warning" role="status">Embedded forms are limited to eight levels.</div>
{:else if loading}
  <div class="m-subform__message" role="status">Loading embedded form…</div>
{:else if error}
  <div class="m-alert m-alert--warning" role="status">{error}</div>
{:else}
  <div class="m-subform__message">Choose a form in the component properties.</div>
{/if}

<style>
  .m-subform { min-width: 0; }
  .m-subform__message { padding: 12px; border: 1px dashed var(--m-border); border-radius: var(--m-radius); color: var(--m-muted-foreground); font-size: .875rem; }
</style>
