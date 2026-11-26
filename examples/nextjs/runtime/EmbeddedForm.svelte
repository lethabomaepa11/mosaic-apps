<script>
  import { getContext } from 'svelte';
  import { subform } from './original-components.js';
  import PublishedForm from './PublishedForm.svelte';

  let { client, formId, ...props } = $props();
  const NestedForm = subform.component;
  const nested = Boolean(getContext('mosaic:embedded-form-stack'));
  let form = $state();
  let error = $state('');

  $effect(() => {
    form = undefined;
    error = '';
    if (nested || !client || !formId) return;
    let active = true;
    void client.getForm(formId).then((result) => {
      if (active) form = result;
    }).catch(() => {
      if (active) error = 'Could not load the embedded form.';
    });
    return () => { active = false; };
  });
</script>

{#if nested}
  <NestedForm {client} {formId} {...props} />
{:else if form}
  <PublishedForm {form} {client} />
{:else if error}
  <p role="status">{error}</p>
{:else if formId}
  <p role="status">Loading embedded form…</p>
{:else}
  <p>Choose a form in the component properties.</p>
{/if}
