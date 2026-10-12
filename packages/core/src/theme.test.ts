import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contrastRatio, validateThemeConfig } from './theme.js';
test('themes validate independent light, dark and named palettes and bounded CSS values', () => {
  assert.doesNotThrow(() => validateThemeConfig({ mode: 'system', primary: '#6366f1', themes: { Ocean: { primary: '#0284c7', dark: { background: '#0f172a' } } }, activeTheme: 'Ocean' }));
  for (const value of [{ mode: 'automatic' }, { activeTheme: 'missing' }, { font: 'font; color:red' }, { dark: [] }, { transition: { duration: -1 } }]) assert.throws(() => validateThemeConfig(value));
});
test('contrast computes opaque hex colors without claiming results for unsupported formats', () => {
  assert.equal(contrastRatio('#fff', '#000'), 21);
  assert.equal(contrastRatio('#ffffff', '#ffffff'), 1);
  assert.equal(contrastRatio('transparent', '#fff'), undefined);
});
