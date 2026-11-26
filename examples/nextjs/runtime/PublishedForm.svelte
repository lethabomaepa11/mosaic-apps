<script>
  import { FormRenderer } from '@mosaic-apps/ui';
  let { form, record, client } = $props();
  const endpoint = $derived(form.settings?.createEndpoint);
  const submit = $derived(!record && typeof endpoint === 'string' && endpoint.startsWith('/extensions/')
    ? (values) => client.call('POST', endpoint, values)
    : undefined);
</script>

<FormRenderer {form} {record} {client} mode={record ? 'edit' : 'create'} onsubmit={submit} />
