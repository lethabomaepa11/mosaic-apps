import type { ThemeConfig, ThemePalette } from '@mosaic/core';
import { themeState } from './theme.svelte';

const THEME_VARIABLES: Record<keyof ThemePalette, string> = {
  primary: '--color-primary', background: '--color-bg', surface: '--color-surface',
  surface2: '--color-surface-2', foreground: '--color-fg', foregroundMuted: '--color-fg-muted',
  border: '--color-border', space1: '--space-1', space2: '--space-2', space3: '--space-3',
  space4: '--space-4', space5: '--space-5', space6: '--space-6', radius: '--radius', font: '--font-sans', mono: '--font-mono',
};

const DEFAULT_DARK: Required<Pick<ThemePalette, 'primary' | 'background' | 'surface' | 'surface2' | 'foreground' | 'foregroundMuted' | 'border'>> = {
  primary: '#818cf8', background: '#0f172a', surface: '#1e293b', surface2: '#334155',
  foreground: '#f1f5f9', foregroundMuted: '#94a3b8', border: '#475569',
};
const scopeIds = new WeakMap<HTMLElement, string>();
const systemModeListeners = new WeakMap<HTMLElement, { query: MediaQueryList; listener: (event: MediaQueryListEvent) => void }>();
let nextScopeId = 1;

function declarations(palette: ThemePalette): string {
  return Object.entries(THEME_VARIABLES)
    .map(([key, variable]) => {
      const value = palette[key as keyof ThemePalette];
      return typeof value === 'string' && value.trim() ? `${variable}:${value};` : '';
    })
    .join('');
}

/** Apply light/dark/system and named palettes while preserving legacy flat tokens. */
export function applyThemeConfig(config: ThemeConfig, target: HTMLElement | null = typeof document === 'undefined' ? null : document.documentElement): void {
  Object.assign(themeState, config);
  if (!target) return;

  const mode = config.mode ?? 'light';
  target.dataset.themeMode = mode;
  const previousListener = systemModeListeners.get(target);
  if (previousListener) {
    previousListener.query.removeEventListener('change', previousListener.listener);
    systemModeListeners.delete(target);
  }
  if (mode === 'system' && typeof window !== 'undefined' && window.matchMedia) {
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = (event: MediaQueryListEvent) => target.classList.toggle('dark', event.matches);
    target.classList.toggle('dark', query.matches);
    query.addEventListener('change', listener);
    systemModeListeners.set(target, { query, listener });
  } else {
    target.classList.toggle('dark', mode === 'dark');
  }
  if (target !== target.ownerDocument.documentElement) {
    let scopeId = scopeIds.get(target);
    if (!scopeId) {
      scopeId = `mosaic-theme-${nextScopeId++}`;
      scopeIds.set(target, scopeId);
      target.dataset.mosaicThemeScope = scopeId;
    }
  }

  const selector = target === target.ownerDocument.documentElement
    ? ':root'
    : `[data-mosaic-theme-scope="${target.dataset.mosaicThemeScope}"]`;
  const light = { ...config, ...(config.themes?.[config.activeTheme ?? ''] ?? {}) };
  const dark = { ...DEFAULT_DARK, font: light.font, mono: light.mono, ...(config.dark ?? {}) };
  const css = `${selector}[data-theme-mode="light"]{${declarations(light)}}\n` +
    `${selector}[data-theme-mode="dark"]{${declarations(dark)}}\n` +
    `@media(prefers-color-scheme:dark){${selector}[data-theme-mode="system"]{${declarations(dark)}}}`;
  const id = selector === ':root' ? 'mosaic-theme-config' : `${target.dataset.mosaicThemeScope}-style`;
  let style = target.ownerDocument.getElementById(id) as HTMLStyleElement | null;
  if (!style) {
    style = target.ownerDocument.createElement('style');
    style.id = id;
    target.ownerDocument.head.append(style);
  }
  style.textContent = css;

  if (config.transition?.duration !== undefined) target.style.setProperty('--m-transition-duration', `${Math.max(0, config.transition.duration)}ms`);
  if (config.transition?.kind) target.style.setProperty('--m-transition-kind', config.transition.kind);
}
