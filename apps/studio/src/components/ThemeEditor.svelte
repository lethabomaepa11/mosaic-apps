<script lang="ts">
  import { onMount } from 'svelte';
  import { applyThemeConfig, toast } from '@mosaic-apps/ui';
  import type { ThemeConfig } from '@mosaic-apps/core';
  import { client } from '#lib/client';

  interface Props { onsave?: (config: ThemeConfig) => void }
  let { onsave }: Props = $props();
  const defaults: ThemeConfig = {
    primary: '#6366f1', background: '#f6f8fb', surface: '#ffffff', surface2: '#f1f4f9',
    foreground: '#16202c', foregroundMuted: '#5d6b7e', border: '#dde3ec', radius: '10px',
    space1: '4px', space2: '8px', space3: '12px', space4: '16px', space5: '24px', space6: '32px',
    font: "Inter, ui-sans-serif, system-ui, sans-serif", mono: "ui-monospace, monospace",
    mode: 'system',
    dark: { primary: '#818cf8', background: '#0f172a', surface: '#1e293b', surface2: '#334155', foreground: '#f1f5f9', foregroundMuted: '#94a3b8', border: '#475569' },
    transition: { kind: 'fade', duration: 180, delay: 0 },
  };
  let config = $state<ThemeConfig>({ ...defaults });
  let saving = $state(false);

  onMount(async () => {
    try {
      const settings = await client.listSettings();
      const saved = settings.find((entry) => entry.key === 'theme.config')?.value;
      if (saved && typeof saved === 'object') {
        config = { ...defaults, ...(saved as ThemeConfig), dark: { ...defaults.dark, ...(saved as ThemeConfig).dark }, transition: { ...defaults.transition, ...(saved as ThemeConfig).transition } };
        apply(config);
      }
    } catch (err) { toast.error('Could not load theme', err instanceof Error ? err.message : String(err)); }
  });

  function apply(value: ThemeConfig) { applyThemeConfig(value); }

  function preset(name: string) {
    const palettes: Record<string, Partial<ThemeConfig>> = {
      Indigo: { primary: '#6366f1', background: '#f6f8fb', surface: '#ffffff' },
      Ocean: { primary: '#0284c7', background: '#f0f9ff', surface: '#ffffff' },
      Forest: { primary: '#15803d', background: '#f0fdf4', surface: '#ffffff' },
      Rose: { primary: '#e11d48', background: '#fff1f2', surface: '#ffffff' },
    };
    config = { ...config, ...palettes[name] };
    apply(config);
  }

  async function save() {
    saving = true;
    try {
      await client.setSetting('theme.config', config, 'Visual theme and motion settings');
      apply(config);
      onsave?.(config);
      toast.success('Theme saved');
    } catch (err) { toast.error('Could not save theme', err instanceof Error ? err.message : String(err)); }
    finally { saving = false; }
  }
</script>

<section class="m-card theme-editor">
  <header class="m-card__header"><div><strong class="m-card__title">Theme</strong><p class="m-muted m-small">Shared design tokens for the Studio and generated apps.</p></div><button class="m-btn m-btn--primary" disabled={saving} onclick={save}>{saving ? 'Saving…' : 'Save theme'}</button></header>
  <div class="m-row"><strong>Presets</strong>{#each ['Indigo', 'Ocean', 'Forest', 'Rose'] as name (name)}<button class="m-btn m-btn--secondary m-btn--sm" onclick={() => preset(name)}>{name}</button>{/each}</div>
  <div class="theme-grid">
    <label>Color mode<select class="m-select" bind:value={config.mode} onchange={() => apply(config)}><option value="system">System preference</option><option value="light">Light</option><option value="dark">Dark</option></select></label>
    <label>Primary<input type="color" bind:value={config.primary} oninput={() => apply(config)} /></label>
    <label>Background<input type="color" bind:value={config.background} oninput={() => apply(config)} /></label>
    <label>Surface<input type="color" bind:value={config.surface} oninput={() => apply(config)} /></label>
    <label>Raised surface<input type="color" bind:value={config.surface2} oninput={() => apply(config)} /></label>
    <label>Text<input type="color" bind:value={config.foreground} oninput={() => apply(config)} /></label>
    <label>Muted text<input type="color" bind:value={config.foregroundMuted} oninput={() => apply(config)} /></label>
    <label>Border<input type="color" bind:value={config.border} oninput={() => apply(config)} /></label>
    <label>Dark primary<input type="color" bind:value={config.dark!.primary} oninput={() => apply(config)} /></label>
    <label>Dark background<input type="color" bind:value={config.dark!.background} oninput={() => apply(config)} /></label>
    <label>Dark surface<input type="color" bind:value={config.dark!.surface} oninput={() => apply(config)} /></label>
    <label>Dark text<input type="color" bind:value={config.dark!.foreground} oninput={() => apply(config)} /></label>
    <label>Corner radius<input class="m-input" bind:value={config.radius} oninput={() => apply(config)} /></label>
    <label>Font<input class="m-input" bind:value={config.font} oninput={() => apply(config)} /></label>
    <label>Monospace font<input class="m-input" bind:value={config.mono} oninput={() => apply(config)} /></label>
    <label>Spacing 1<input class="m-input" bind:value={config.space1} oninput={() => apply(config)} /></label>
    <label>Spacing 2<input class="m-input" bind:value={config.space2} oninput={() => apply(config)} /></label>
    <label>Spacing 3<input class="m-input" bind:value={config.space3} oninput={() => apply(config)} /></label>
    <label>Spacing 4<input class="m-input" bind:value={config.space4} oninput={() => apply(config)} /></label>
    <label>Spacing 5<input class="m-input" bind:value={config.space5} oninput={() => apply(config)} /></label>
    <label>Spacing 6<input class="m-input" bind:value={config.space6} oninput={() => apply(config)} /></label>
    <label>Motion<select class="m-select" bind:value={config.transition!.kind}><option value="fade">Fade</option><option value="slide">Slide</option><option value="scale">Scale</option><option value="blur">Blur</option><option value="none">None</option></select></label>
    <label>Duration (ms)<input class="m-input" type="number" min="0" max="2000" bind:value={config.transition!.duration} /></label>
  </div>
  <div class="theme-preview"><strong>Preview</strong><div class="m-row"><button class="m-btn m-btn--primary">Primary action</button><button class="m-btn m-btn--secondary">Secondary</button><span class="m-badge m-badge--success">Published</span></div><div class="m-input">Sample input</div></div>
</section>

<style>
  .theme-editor { display:grid; gap:18px; }
  .theme-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(190px,1fr)); gap:12px; }
  .theme-grid label { display:grid; gap:5px; font-size:.78rem; font-weight:650; }
  .theme-grid input[type=color] { width:100%; height:38px; padding:3px; border:1px solid var(--m-border); border-radius:var(--m-radius-sm); background:var(--m-surface); }
  .theme-preview { display:grid; gap:10px; padding:16px; background:var(--m-bg); border:1px solid var(--m-border); border-radius:var(--m-radius); }
</style>

