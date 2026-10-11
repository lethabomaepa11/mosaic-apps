<script lang="ts">
  import { Card, JsonEditor, NumberField, SelectField, Switch, TextArea, TextField } from '@mosaic-apps/ui';
  import type { EntityDef, FormDataSource, FormSettings } from '@mosaic-apps/core';
  import { designer } from '#lib/designer.svelte';

  interface Props {
    name: string;
    description: string;
    folder: string;
    entity: string;
    settings: FormSettings;
    dataSource: FormDataSource;
    entities: EntityDef[];
    onname: (value: string) => void;
    ondescription: (value: string) => void;
    onfolder: (value: string) => void;
    onentity: (value: string) => void;
    onsettings: (value: FormSettings) => void;
    ondatasource: (value: FormDataSource) => void;
  }

  let { name, description, folder, entity, settings, dataSource, entities, onname, ondescription, onfolder, onentity, onsettings, ondatasource }: Props = $props();

  function update(patch: Partial<FormSettings>) { onsettings({ ...settings, ...patch }); designer.markChanged(); }
  function updateSeo(patch: NonNullable<FormSettings['seo']>) { update({ seo: { ...settings.seo, ...patch } }); }
</script>

<main class="form-settings">
  <header><div><h1 class="m-h2">Form settings</h1><p class="m-muted">Configure this form’s identity, behavior, and search metadata.</p></div></header>

  <Card title="General" subtitle="Identity and data binding">
    <div class="settings-grid">
      <TextField label="Form name" value={name} oninput={onname} required />
      <TextField label="Folder" value={folder} oninput={onfolder} placeholder="Optional folder path" />
      <TextArea label="Description" value={description} oninput={ondescription} rows={3} />
      <SelectField label="Entity" value={entity || null} placeholder="No entity" options={entities.map((item) => ({ value: item.name, label: item.label ?? item.name }))} oninput={(value) => onentity(value ?? '')} />
      <SelectField label="Layout" value={settings.layout ?? 'vertical'} options={[{value:'vertical',label:'Vertical'},{value:'horizontal',label:'Horizontal'},{value:'inline',label:'Inline'}]} oninput={(layout) => update({ layout: layout as FormSettings['layout'] })} />
      <NumberField label="Layout columns" value={settings.columns ?? 1} min={1} max={4} step={1} oninput={(columns) => update({ columns: Math.max(1, Math.min(4, columns ?? 1)) })} />
      <SelectField label="Entrance animation" value={settings.transition?.kind ?? 'fade'} options={[{value:'fade',label:'Fade'},{value:'slide',label:'Slide'},{value:'scale',label:'Scale'},{value:'blur',label:'Blur'},{value:'none',label:'None'}]} oninput={(kind) => update({ transition: { ...settings.transition, kind: kind as NonNullable<FormSettings['transition']>['kind'] } })} />
      <NumberField label="Animation duration (ms)" value={settings.transition?.duration ?? 180} min={0} max={2000} step={10} oninput={(duration) => update({ transition: { ...settings.transition, duration: duration ?? undefined } })} />
    </div>
  </Card>

  <Card title="Data source" subtitle="Choose how the form receives its initial record">
    <div class="settings-grid">
      <SelectField label="Source" value={dataSource.kind} options={[{value:'none',label:'Supplied by the host page'},{value:'entity',label:'Entity record'},{value:'static',label:'Static data'},{value:'endpoint',label:'API endpoint'}]} oninput={(kind) => {
        if (kind === 'entity') ondatasource({ kind, entity: entity || entities[0]?.name || '', recordId: '' });
        else if (kind === 'static') ondatasource({ kind, data: {} });
        else if (kind === 'endpoint') ondatasource({ kind, url: '/api/', method: 'GET' });
        else ondatasource({ kind: 'none' });
      }} />
      {#if dataSource.kind === 'entity'}
        <SelectField label="Entity" value={dataSource.entity || null} placeholder="Choose entity" options={entities.map((item) => ({ value: item.name, label: item.label ?? item.name }))} oninput={(sourceEntity) => ondatasource({ ...dataSource, entity: sourceEntity ?? '' })} />
        <TextField label="Record ID or state template" value={dataSource.recordId ?? ''} placeholder={'{{page.recordId}}'} oninput={(recordId) => ondatasource({ ...dataSource, recordId })} />
      {:else if dataSource.kind === 'endpoint'}
        <TextField label="Endpoint path" value={dataSource.url} placeholder={'/api/orders/{{page.id}}'} oninput={(url) => ondatasource({ ...dataSource, url })} />
        <SelectField label="Method" value={dataSource.method ?? 'GET'} options={[{value:'GET',label:'GET'},{value:'POST',label:'POST'}]} oninput={(method) => ondatasource({ ...dataSource, method: method as 'GET' | 'POST' })} />
        <TextField label="Record path" value={dataSource.recordPath ?? ''} placeholder="data.record" oninput={(recordPath) => ondatasource({ ...dataSource, recordPath })} />
      {/if}
    </div>
    {#if dataSource.kind === 'static'}
      <div class="settings-json"><JsonEditor label="Static record" value={dataSource.data} rows={8} oninput={(data) => ondatasource({ ...dataSource, data: (data && typeof data === 'object' && !Array.isArray(data) ? data : {}) as Record<string, unknown> })} /></div>
    {/if}
  </Card>

  <Card title="Submission" subtitle="Labels and post-submit behavior">
    <div class="settings-grid">
      <TextField label="Submit button label" value={settings.submitLabel ?? 'Submit'} oninput={(submitLabel) => update({ submitLabel })} />
      <TextField label="Reset button label" value={settings.resetLabel ?? 'Reset'} oninput={(resetLabel) => update({ resetLabel })} />
      <TextField label="Success message" value={settings.successMessage ?? ''} oninput={(successMessage) => update({ successMessage })} />
      <TextField label="Error message" value={settings.errorMessage ?? ''} oninput={(errorMessage) => update({ errorMessage })} />
      <TextField label="Redirect after submit" value={settings.redirectAfterSubmit ?? ''} oninput={(redirectAfterSubmit) => update({ redirectAfterSubmit })} placeholder="/thank-you" />
      <TextField label="Confirmation message" value={settings.confirmMessage ?? ''} oninput={(confirmMessage) => update({ confirmMessage })} />
    </div>
    <div class="settings-toggles">
      <Switch label="Show reset button" value={settings.showReset ?? false} oninput={(showReset) => update({ showReset })} />
      <Switch label="Confirm before submit" value={settings.confirmBeforeSubmit ?? false} oninput={(confirmBeforeSubmit) => update({ confirmBeforeSubmit })} />
      <Switch label="Hide system fields" value={settings.hideSystemFields ?? true} oninput={(hideSystemFields) => update({ hideSystemFields })} />
    </div>
  </Card>

  <Card title="Search and social metadata" subtitle="Search engine and Open Graph settings for this form">
    <div class="settings-grid">
      <TextField label="Page title" value={settings.seo?.title ?? ''} oninput={(title) => updateSeo({ title })} />
      <TextField label="Canonical URL" value={settings.seo?.canonicalUrl ?? ''} oninput={(canonicalUrl) => updateSeo({ canonicalUrl })} placeholder="https://example.com/forms/contact" />
      <TextArea label="Meta description" value={settings.seo?.description ?? ''} rows={3} oninput={(description) => updateSeo({ description })} />
      <SelectField label="Search indexing" value={settings.seo?.robots ?? 'index,follow'} options={[{ value: 'index,follow', label: 'Index and follow' }, { value: 'noindex,nofollow', label: 'Hide from search engines' }, { value: 'noindex,follow', label: 'Hide page, follow links' }, { value: 'index,nofollow', label: 'Index page, ignore links' }]} oninput={(robots) => updateSeo({ robots: robots as NonNullable<FormSettings['seo']>['robots'] })} />
      <TextField label="Social title" value={settings.seo?.socialTitle ?? ''} oninput={(socialTitle) => updateSeo({ socialTitle })} />
      <TextField label="Social image URL" value={settings.seo?.socialImage ?? ''} oninput={(socialImage) => updateSeo({ socialImage })} />
      <TextArea label="Social description" value={settings.seo?.socialDescription ?? ''} rows={2} oninput={(socialDescription) => updateSeo({ socialDescription })} />
    </div>
  </Card>
</main>

<style>
  .form-settings { display:grid; gap:16px; max-width:1050px; margin:0 auto; padding:24px; }
  .form-settings > header { display:flex; justify-content:space-between; align-items:start; }
  .settings-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:14px; padding:0 16px 16px; }
  .settings-toggles { display:flex; flex-wrap:wrap; gap:20px; padding:0 16px 16px; }
  .settings-json { padding:0 16px 16px; }
  @media(max-width:760px) { .settings-grid { grid-template-columns:1fr; } }
</style>

