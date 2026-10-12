<script lang="ts">
  import { onMount } from 'svelte';
  import { applyThemeConfig, Card, CodeEditorField, ColorPicker, JsonEditor, NumberField, SelectField, TextField, toast } from '@mosaic-apps/ui';
  import { contrastRatio, themeColorKeys, themePalette, validateThemeConfig, type ThemeConfig, type ThemePalette } from '@mosaic-apps/core';
  import { client } from '#lib/client';
  import BrandingEditor from './BrandingEditor.svelte';
  let { onsave }: { onsave?: (config: ThemeConfig) => void } = $props();
  const light = { primary: '#4f46e5', primaryForeground: '#ffffff', background: '#f6f8fb', surface: '#ffffff', surface2: '#f1f4f9', foreground: '#16202c', foregroundMuted: '#526179', border: '#dde3ec' };
  const dark = { primary: '#a5b4fc', primaryForeground: '#0f172a', background: '#0f172a', surface: '#1e293b', surface2: '#334155', foreground: '#f1f5f9', foregroundMuted: '#a8b7cb', border: '#475569' };
  const defaults: ThemeConfig = { ...light, mode: 'system', radius: '10px', font: 'Inter, ui-sans-serif, system-ui, sans-serif', mono: 'ui-monospace, monospace', space1: '4px', space2: '8px', space3: '12px', space4: '16px', space5: '24px', space6: '32px', dark, transition: { kind: 'fade', duration: 180, delay: 0 }, themes: {
    Indigo: { ...light, dark },
    Ocean: { ...light, primary: '#0369a1', background: '#f0f9ff', dark: { ...dark, primary: '#7dd3fc' } },
    Forest: { ...light, primary: '#15803d', background: '#f0fdf4', dark: { ...dark, primary: '#86efac' } },
    Rose: { ...light, primary: '#be123c', background: '#fff1f2', dark: { ...dark, primary: '#fda4af' } },
  } };
  let config = $state<ThemeConfig>(structuredClone(defaults));
  let saving = $state(false); let newName = $state('');
  const labels: Record<typeof themeColorKeys[number], string> = { primary: 'Primary', primaryForeground: 'Primary text', background: 'Background', surface: 'Surface', surface2: 'Raised surface', foreground: 'Text', foregroundMuted: 'Muted text', border: 'Border' };
  const names = $derived(Object.keys(config.themes ?? {}).sort());
  const checks = $derived([['Light text', config.foreground, config.background], ['Light muted text', config.foregroundMuted, config.surface], ['Light button', config.primaryForeground, config.primary], ['Dark text', config.dark?.foreground, config.dark?.background], ['Dark muted text', config.dark?.foregroundMuted, config.dark?.surface], ['Dark button', config.dark?.primaryForeground, config.dark?.primary]].map(([label, foreground, background]) => ({ label, ratio: contrastRatio(foreground ?? '', background ?? '') })));
  function apply() {
    if (config.activeTheme) config.themes = { ...config.themes, [config.activeTheme]: { ...themePalette(config), dark: { ...config.dark } } };
    applyThemeConfig($state.snapshot(config));
  }
  function choose(name: string) {
    const selected = config.themes?.[name];
    if (selected) config = { ...config, ...selected, dark: { ...dark, ...selected.dark }, activeTheme: name };
    else config.activeTheme = '';
    apply();
  }
  function addTheme() {
    const name = newName.trim(); if (!name) return;
    if (Object.hasOwn(config.themes ?? {}, name)) { toast.warning('A theme with this name exists'); return; }
    const next = { ...$state.snapshot(config), themes: { ...config.themes, [name]: { ...themePalette(config), dark: { ...config.dark } } }, activeTheme: name };
    try { validateThemeConfig(next); config = next; newName = ''; apply(); } catch (reason) { toast.error('Invalid theme name', String(reason)); }
  }
  function removeTheme() {
    if (!config.activeTheme) return;
    const next = { ...config.themes }; delete next[config.activeTheme]; config.themes = next; config.activeTheme = ''; apply();
  }
  function importTheme(value: unknown) {
    validateThemeConfig(value);
    config = { ...structuredClone(defaults), ...value, dark: { ...dark, ...value.dark }, transition: { ...defaults.transition, ...value.transition } }; apply();
  }
  onMount(async () => {
    try { const saved = await client.getTheme(); importTheme(saved); }
    catch (reason) { toast.error('Could not load theme', reason instanceof Error ? reason.message : String(reason)); }
  });
  async function save() {
    saving = true;
    try {
      const next = $state.snapshot(config); validateThemeConfig(next);
      await client.setSetting('theme.config', next, 'Named light/dark themes and motion'); applyThemeConfig(next); onsave?.(next); toast.success('Theme saved');
    } catch (reason) { toast.error('Could not save theme', reason instanceof Error ? reason.message : String(reason)); }
    finally { saving = false; }
  }
</script>

<div class="theme-editor">
  <Card title="Theme gallery" subtitle="Named palettes with independent light and dark colors">
    <div class="m-stack">
      <div class="theme-grid"><SelectField label="Active theme" value={config.activeTheme ?? ''} clearable={false} disabled={saving} options={[{ value: '', label: 'Current custom palette' }, ...names.map(name => ({ value: name, label: name }))]} oninput={value => choose(value ?? '')} /><SelectField label="Default color mode" value={config.mode ?? 'system'} clearable={false} disabled={saving} options={[{ value: 'system', label: 'System preference' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} oninput={value => { config.mode = value as ThemeConfig['mode']; apply(); }} /></div>
      <div class="theme-presets">{#each names as name (name)}<button type="button" class="m-btn m-btn--secondary" aria-pressed={config.activeTheme === name} disabled={saving} onclick={() => choose(name)}><span class="theme-swatch" style={`background:${config.themes?.[name]?.primary ?? light.primary}`}></span>{name}</button>{/each}</div>
      <div class="m-row"><TextField label="New theme name" bind:value={newName} disabled={saving} placeholder="Company theme" /><button type="button" class="m-btn m-btn--secondary" disabled={saving || !newName.trim()} onclick={addTheme}>Save as named theme</button><button type="button" class="m-btn m-btn--ghost" disabled={saving || !config.activeTheme} onclick={removeTheme}>Remove selected theme</button></div>
    </div>
  </Card>
  <Card title="Semantic colors" subtitle="Preview changes immediately; Save theme publishes them to your application">
    <div class="theme-columns">
      <section><h3 class="m-h3">Light palette</h3><div class="theme-grid">{#each themeColorKeys as key}<ColorPicker label={`Light ${labels[key]}`} value={config[key] ?? light[key]} disabled={saving} oninput={value => { config[key] = value; apply(); }} />{/each}</div></section>
      <section><h3 class="m-h3">Dark palette</h3><div class="theme-grid">{#each themeColorKeys as key}<ColorPicker label={`Dark ${labels[key]}`} value={config.dark?.[key] ?? dark[key]} disabled={saving} oninput={value => { config.dark = { ...config.dark, [key]: value }; apply(); }} />{/each}</div></section>
    </div>
  </Card>
  <Card title="Typography, spacing and motion">
    <div class="theme-grid">
      <TextField label="Corner radius" bind:value={config.radius} disabled={saving} oninput={apply} />
      <TextField label="Font" bind:value={config.font} disabled={saving} oninput={apply} />
      <TextField label="Monospace font" bind:value={config.mono} disabled={saving} oninput={apply} />
      {#each ['space1','space2','space3','space4','space5','space6'] as key, index}<TextField label={`Spacing ${index + 1}`} value={config[key as keyof ThemePalette] ?? ''} disabled={saving} oninput={value => { config[key as keyof ThemePalette] = value; apply(); }} />{/each}
      <SelectField label="Motion" value={config.transition?.kind ?? 'fade'} clearable={false} disabled={saving} options={['fade','slide','scale','blur','none'].map(value => ({ value, label: value }))} oninput={value => { config.transition = { ...config.transition, kind: value as NonNullable<ThemeConfig['transition']>['kind'] }; apply(); }} />
      <NumberField label="Duration (ms)" value={config.transition?.duration ?? 180} min={0} max={2000} disabled={saving} oninput={value => { config.transition = { ...config.transition, duration: value ?? 0 }; apply(); }} />
      <NumberField label="Delay (ms)" value={config.transition?.delay ?? 0} min={0} max={2000} disabled={saving} oninput={value => { config.transition = { ...config.transition, delay: value ?? 0 }; apply(); }} />
    </div>
  </Card>
  <Card title="Contrast checks" subtitle="Opaque hex color pairs; aim for at least 4.5:1 for normal text">
    <div class="theme-grid">{#each checks as check}<div><strong>{check.label}</strong><div class="m-small" class:m-field__error={check.ratio !== undefined && check.ratio < 4.5}>{check.ratio === undefined ? 'Check this CSS color manually' : `${check.ratio.toFixed(2)}:1 · ${check.ratio >= 4.5 ? 'Meets normal text contrast' : 'Needs more contrast'}`}</div></div>{/each}</div>
    <p class="m-small m-muted">Check your final screens too: transparency, images, hover states and custom CSS can change contrast.</p>
  </Card>
  <Card title="Import and export">
    <div class="m-stack"><JsonEditor label="Theme configuration" value={config} disabled={saving} validate={value => { try { validateThemeConfig(value); } catch (reason) { return reason instanceof Error ? reason.message : 'Invalid theme'; } }} oninput={importTheme} helpText="Import a theme by pasting JSON into the Monaco modal, then Apply." /><CodeEditorField label="Theme export" value={JSON.stringify(config, null, 2)} language="json" readOnly helpText="Copy the complete theme from the Monaco modal." /></div>
  </Card>
  <div class="theme-preview"><strong>Live preview</strong><div class="m-row"><button type="button" class="m-btn m-btn--primary">Primary action</button><button type="button" class="m-btn m-btn--secondary">Secondary action</button><span class="m-badge m-badge--success">Published</span></div><TextField label="Sample field" placeholder="Example input" /><button type="button" class="m-btn m-btn--primary" disabled={saving} onclick={save}>{saving ? 'Saving…' : 'Save theme'}</button></div>
  <BrandingEditor />
</div>
<style>
  .theme-editor { display:grid; gap:18px; }.theme-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:14px; }.theme-columns { display:grid; grid-template-columns:1fr 1fr; gap:28px; }.theme-presets { display:flex; flex-wrap:wrap; gap:8px; }.theme-swatch { width:16px;height:16px;border-radius:50%;border:1px solid var(--m-border); }.theme-preview { display:grid;gap:12px;padding:20px;background:var(--m-bg);border:1px solid var(--m-border);border-radius:var(--m-radius); } @media(max-width:760px) { .theme-columns { grid-template-columns:1fr; } }
</style>
