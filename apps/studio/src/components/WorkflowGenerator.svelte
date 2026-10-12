<script lang="ts">
  import { goto } from '$app/navigation';
  import { allFields, entityLabelPlural, type EntityDef } from '@mosaic-apps/core';
  import { Checkbox, Modal, SelectField, TextField, toast } from '@mosaic-apps/ui';
  import { client } from '#lib/client';

  interface Props { open?: boolean; entity?: EntityDef; entities?: EntityDef[]; }
  let { open = $bindable(false), entity, entities = [] }: Props = $props();
  let selected = $state('');
  let name = $state('');
  let folder = $state('');
  let columns = $state<string[]>([]);
  let fields = $state<string[]>([]);
  let busy = $state(false);
  let error = $state('');
  const choices = $derived(entity ? [entity] : entities);
  const definition = $derived(choices.find((item) => item.name === selected));
  const available = $derived(definition ? allFields(definition) : []);
  const writable = $derived(definition?.fields.filter((field) => !field.readonly && !field.system && !field.ui?.hidden) ?? []);
  $effect(() => { if (open && entity) selected = entity.name; });
  $effect(() => {
    if (!definition) return;
    name = entityLabelPlural(definition);
    folder = entityLabelPlural(definition);
    columns = definition.list?.columns?.length ? [...definition.list.columns] : definition.fields.slice(0, 6).map((field) => field.name);
    fields = definition.fields.filter((field) => !field.readonly && !field.system && !field.ui?.hidden).map((field) => field.name);
    error = '';
  });
  function toggle(list: string[], key: string, value: boolean) { return value ? [...new Set([...list, key])] : list.filter((item) => item !== key); }
  async function generate() {
    if (!definition || busy) return;
    busy = true; error = '';
    try {
      const workflow = await client.generateEntityWorkflow(definition.name, { name, folder, columns, fields });
      open = false;
      toast.success('Application views created', 'Table, create, edit and detail views are published and linked.');
      await goto(`/studio/pages/${workflow.page.id}`);
    } catch (reason) { error = reason instanceof Error ? reason.message : 'Could not create application views.'; }
    finally { busy = false; }
  }
</script>

<Modal bind:open title="Create application views" size="lg">
  <div class="m-stack">
    <p class="m-muted">Generate a searchable table and linked create, edit and detail forms. Customize each view afterward in Studio.</p>
    <SelectField label="Entity" value={selected || null} options={choices.map((item) => ({ value: item.name, label: item.label ?? item.name }))} disabled={busy || !!entity} clearable={false} oninput={(value) => selected = value ?? ''} />
    <div class="workflow-grid"><TextField label="Workflow name" bind:value={name} disabled={busy} /><TextField label="Folder" bind:value={folder} disabled={busy} /></div>
    {#if definition}
      <div class="workflow-grid">
        <section><h3 class="m-h3">Table columns</h3><p class="m-small m-muted">Choose the fields operators see in the list.</p><div class="workflow-fields">{#each available as field (field.name)}<Checkbox label={field.label ?? field.name} value={columns.includes(field.name)} disabled={busy} oninput={(value) => columns = toggle(columns, field.name, value)} />{/each}</div></section>
        <section><h3 class="m-h3">Create and edit fields</h3><p class="m-small m-muted">Required fields without defaults remain selected.</p><div class="workflow-fields">{#each writable as field (field.name)}<Checkbox label={field.label ?? field.name} value={fields.includes(field.name)} disabled={busy || (!!field.required && field.default === undefined)} oninput={(value) => fields = toggle(fields, field.name, value)} />{/each}</div></section>
      </div>
    {/if}
    {#if error}<div class="m-alert m-alert--warning" role="alert">{error}</div>{/if}
  </div>
  {#snippet footer()}
    <button type="button" class="m-btn m-btn--ghost" disabled={busy} onclick={() => open = false}>Cancel</button>
    <button type="button" class="m-btn m-btn--primary" disabled={busy || !definition || !name.trim() || !columns.length || !fields.length} onclick={generate}>{busy ? 'Creating views…' : 'Create and publish views'}</button>
  {/snippet}
</Modal>

<style>
  .workflow-grid { display:grid; grid-template-columns:1fr 1fr; gap:20px; }
  .workflow-fields { display:grid; gap:10px; max-height:280px; overflow:auto; padding:4px; }
  @media(max-width:640px) { .workflow-grid { grid-template-columns:1fr; } }
</style>
