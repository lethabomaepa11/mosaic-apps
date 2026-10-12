import type { ThemeConfig, ThemePalette } from './types/platform.js';
export const themeColorKeys = ['primary', 'primaryForeground', 'background', 'surface', 'surface2', 'foreground', 'foregroundMuted', 'border'] as const;
export const themeTokenKeys = [...themeColorKeys, 'radius', 'font', 'mono', 'space1', 'space2', 'space3', 'space4', 'space5', 'space6'] as const;
function object(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value); }
export function validateThemeConfig(value: unknown): asserts value is ThemeConfig {
  if (!object(value)) throw new Error('Theme configuration must be an object.');
  function palette(candidate: unknown) {
    if (!object(candidate)) throw new Error('Theme palettes must be objects.');
    for (const key of themeTokenKeys) if (candidate[key] !== undefined && (typeof candidate[key] !== 'string' || candidate[key].length > 300 || /[;{}<>]/.test(candidate[key]))) throw new Error(`Theme token ${key} must be a valid CSS value.`);
  }
  palette(value);
  if (value.mode !== undefined && !['light', 'dark', 'system'].includes(String(value.mode))) throw new Error('Choose light, dark or system mode.');
  if (value.dark !== undefined) palette(value.dark);
  if (value.themes !== undefined) {
    if (!object(value.themes) || Object.keys(value.themes).length > 50) throw new Error('Themes must contain at most 50 named palettes.');
    for (const [name, candidate] of Object.entries(value.themes)) {
      if (!/^[\w -]{1,50}$/.test(name) || ['__proto__', 'prototype', 'constructor'].includes(name)) throw new Error('Theme names must use letters, numbers, spaces, underscores or hyphens.');
      palette(candidate);
      if (object(candidate) && candidate.dark !== undefined) palette(candidate.dark);
    }
  }
  if (value.activeTheme !== undefined && (typeof value.activeTheme !== 'string' || (value.activeTheme && (!object(value.themes) || !Object.hasOwn(value.themes, value.activeTheme))))) throw new Error('The active theme must exist in the theme gallery.');
  if (value.transition !== undefined) {
    if (!object(value.transition)) throw new Error('Motion configuration must be an object.');
    for (const key of ['duration', 'delay']) if (value.transition[key] !== undefined && (typeof value.transition[key] !== 'number' || !Number.isFinite(value.transition[key]) || value.transition[key] < 0 || value.transition[key] > 2000)) throw new Error('Motion duration and delay must be between 0 and 2000 ms.');
  }
}
export function themePalette(config: ThemeConfig): ThemePalette {
  return Object.fromEntries(themeTokenKeys.filter(key => config[key] !== undefined).map(key => [key, config[key]]));
}
/** WCAG relative luminance contrast for opaque hex colors. */
export function contrastRatio(first: string, second: string): number | undefined {
  function luminance(color: string) {
    if (!/^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(color)) return undefined;
    const hex = color.length === 4 ? color.slice(1).split('').map(char => char + char).join('') : color.slice(1);
    const channels = [0, 2, 4].map(index => {
      const value = parseInt(hex.slice(index, index + 2), 16) / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
  }
  const a = luminance(first); const b = luminance(second);
  return a === undefined || b === undefined ? undefined : (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
