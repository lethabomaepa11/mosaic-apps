<script>
  import { PageRenderer, Toaster, applyThemeConfig, createClient } from '@mosaic-apps/ui';
  import { onMount } from 'svelte';
  import './components.js';
  import PublishedForm from './PublishedForm.svelte';

  let { page, scope, form, record } = $props();
  let removed = $state(false);
  let removing = $state(false);
  let removalError = $state('');
  const client = createClient({
    baseUrl: '/api',
    onUnauthorized: () => {
      const { pathname, search } = window.location;
      window.location.assign('/login?next=' + encodeURIComponent(pathname + search));
    },
  });

  onMount(() => {
    void client.getTheme().then((theme) => {
      applyThemeConfig({ ...theme, activeTheme: theme.activeTheme ?? document.documentElement.dataset.theme });
    }).catch(() => {});
  });

  async function removeRecord() {
    if (!window.confirm('Delete this record?')) return;
    removing = true;
    removalError = '';
    try {
      await client.deleteRecord(form.entity ?? form.dataSource?.entity, String(record.id));
      removed = true;
    } catch (error) {
      removalError = error instanceof Error ? error.message : 'The record could not be deleted.';
    } finally {
      removing = false;
    }
  }
</script>

{#if page}
  <PageRenderer {page} {scope} {client} />
{:else if removed}
  <p role="status">Record deleted.</p>
{:else}
  <PublishedForm {form} {record} {client} />
  {#if record && (form.entity ?? form.dataSource?.entity)}
    <button class="m-btn m-btn--danger" type="button" onclick={removeRecord} disabled={removing}>Delete record</button>
    {#if removalError}<p role="alert">{removalError}</p>{/if}
  {/if}
{/if}
<Toaster />
