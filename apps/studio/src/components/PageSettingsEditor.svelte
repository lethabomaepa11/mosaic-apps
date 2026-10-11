<script lang="ts">
  import { Card, NumberField, SelectField, Switch, TextArea, TextField } from '@mosaic/ui';
  import type { PageSettings } from '@mosaic/core';
  import { designer } from '#lib/designer.svelte';

  interface Props {
    name: string;
    description: string;
    route: string;
    folder: string;
    settings: PageSettings;
    onname: (value: string) => void;
    ondescription: (value: string) => void;
    onroute: (value: string) => void;
    onfolder: (value: string) => void;
    onsettings: (value: PageSettings) => void;
  }
  let { name, description, route, folder, settings, onname, ondescription, onroute, onfolder, onsettings }: Props = $props();
  function update(patch: Partial<PageSettings>) { onsettings({ ...settings, ...patch }); designer.markChanged(); }
  function updateSeo(patch: NonNullable<PageSettings['seo']>) { update({ seo: { ...settings.seo, ...patch } }); }
  function updateMenu(patch: NonNullable<PageSettings['menu']>) { update({ menu: { ...settings.menu, ...patch } }); }
</script>

<main class="page-settings">
  <header><div><h1 class="m-h2">Page settings</h1><p class="m-muted">Configure this page's identity, route, access, navigation, layout, and metadata.</p></div></header>

  <Card title="General" subtitle="Identity, route, and layout">
    <div class="settings-grid">
      <TextField label="Page name" value={name} oninput={onname} required />
      <TextField label="Route" value={route} oninput={onroute} placeholder="/orders/:id" required />
      <TextField label="Folder" value={folder} oninput={onfolder} placeholder="Optional folder path" />
      <SelectField label="Layout" value={settings.layout ?? 'default'} options={[{value:'default',label:'Application shell'},{value:'bare',label:'Bare page'}]} oninput={(layout) => update({ layout: layout as PageSettings['layout'] })} />
      <TextArea label="Description" value={description} oninput={ondescription} rows={3} />
      <SelectField label="Entrance animation" value={settings.transition?.kind ?? 'fade'} options={[{value:'fade',label:'Fade'},{value:'slide',label:'Slide'},{value:'scale',label:'Scale'},{value:'blur',label:'Blur'},{value:'none',label:'None'}]} oninput={(kind) => update({ transition: { ...settings.transition, kind: kind as NonNullable<PageSettings['transition']>['kind'] } })} />
      <NumberField label="Animation duration (ms)" value={settings.transition?.duration ?? 180} min={0} max={2000} step={10} oninput={(duration) => update({ transition: { ...settings.transition, duration: duration ?? undefined } })} />
    </div>
    <div class="settings-toggles"><Switch label="Require authentication" value={settings.requiresAuth ?? false} oninput={(requiresAuth) => update({ requiresAuth })} /></div>
  </Card>

  <Card title="Navigation" subtitle="Control where the page appears in the application sidebar">
    <div class="settings-toggles"><Switch label="Show in navigation" value={settings.menu?.show ?? false} oninput={(show) => updateMenu({ show })} /></div>
    <div class="settings-grid">
      <TextField label="Navigation group" value={settings.menu?.group ?? ''} oninput={(group) => updateMenu({ group })} placeholder="Sales" />
      <TextField label="Icon" value={settings.menu?.icon ?? ''} oninput={(icon) => updateMenu({ icon })} placeholder="layout-dashboard" />
      <NumberField label="Order" value={settings.menu?.order ?? 0} min={0} step={1} oninput={(order) => updateMenu({ order: order ?? 0 })} />
    </div>
  </Card>

  <Card title="Search and social metadata" subtitle="Search engine and Open Graph settings for this page">
    <div class="settings-grid">
      <TextField label="Page title" value={settings.seo?.title ?? settings.title ?? ''} oninput={(title) => updateSeo({ title })} />
      <TextField label="Canonical URL" value={settings.seo?.canonicalUrl ?? ''} oninput={(canonicalUrl) => updateSeo({ canonicalUrl })} placeholder="https://example.com/orders" />
      <TextArea label="Meta description" value={settings.seo?.description ?? settings.description ?? ''} rows={3} oninput={(seoDescription) => updateSeo({ description: seoDescription })} />
      <SelectField label="Search indexing" value={settings.seo?.robots ?? 'index,follow'} options={[{ value: 'index,follow', label: 'Index and follow' }, { value: 'noindex,nofollow', label: 'Hide from search engines' }, { value: 'noindex,follow', label: 'Hide page, follow links' }, { value: 'index,nofollow', label: 'Index page, ignore links' }]} oninput={(robots) => updateSeo({ robots: robots as NonNullable<PageSettings['seo']>['robots'] })} />
      <TextField label="Social title" value={settings.seo?.socialTitle ?? ''} oninput={(socialTitle) => updateSeo({ socialTitle })} />
      <TextField label="Social image URL" value={settings.seo?.socialImage ?? ''} oninput={(socialImage) => updateSeo({ socialImage })} />
      <TextArea label="Social description" value={settings.seo?.socialDescription ?? ''} rows={2} oninput={(socialDescription) => updateSeo({ socialDescription })} />
    </div>
  </Card>
</main>

<style>
  .page-settings { display:grid; gap:16px; max-width:1050px; margin:0 auto; padding:24px; }
  .settings-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:14px; padding:0 16px 16px; }
  .settings-toggles { display:flex; flex-wrap:wrap; gap:20px; padding:0 16px 16px; }
  @media(max-width:760px) { .settings-grid { grid-template-columns:1fr; } }
</style>

