/** Registry entries: navigation + charts. */

import type { ComponentDef } from './types.js';
import Button from '../components/Button.svelte';
import Menu from '../components/Menu.svelte';
import Chart from '../components/Chart.svelte';
import OAuthButtons from '../components/OAuthButtons.svelte';

export const NAV_ENTRIES: ComponentDef[] = [
  { type: 'oauthSignIn', label: 'OAuth sign-in', category: 'Navigation', icon: 'keyRound', pages: true, component: OAuthButtons, defaults: { provider: 'all', next: '/' },
    inspector: [
      { key: 'provider', label: 'Provider', kind: 'select', options: [{ value: 'all', label: 'All configured providers' }, { value: 'google', label: 'Google' }, { value: 'github', label: 'GitHub' }] },
      { key: 'next', label: 'After sign-in', kind: 'string', help: 'Use a path on this app, such as /dashboard.' },
    ] },
  { type: 'button', label: 'Button', category: 'Navigation', icon: 'button', component: Button, defaults: { label: 'Button', variant: 'primary' },
    inspector: [{ key: 'label', label: 'Label', kind: 'string' }, { key: 'variant', label: 'Variant', kind: 'select', options: [{ value: 'primary', label: 'Primary' }, { value: 'secondary', label: 'Secondary' }, { value: 'ghost', label: 'Ghost' }, { value: 'danger', label: 'Danger' }] }, { key: 'size', label: 'Size', kind: 'select', options: [{ value: 'sm', label: 'Small' }, { value: 'md', label: 'Medium' }, { value: 'lg', label: 'Large' }] }, { key: 'block', label: 'Full width', kind: 'boolean' }] },
  { type: 'iconButton', label: 'Icon button', category: 'Navigation', icon: 'circle', component: Button, defaults: { label: '＋', icon: true, variant: 'secondary' },
    inspector: [{ key: 'label', label: 'Icon / label', kind: 'string' }, { key: 'variant', label: 'Variant', kind: 'select', options: [{ value: 'primary', label: 'Primary' }, { value: 'secondary', label: 'Secondary' }, { value: 'ghost', label: 'Ghost' }, { value: 'danger', label: 'Danger' }] }] },
  { type: 'menu', label: 'Action menu', category: 'Navigation', icon: 'menu2', component: Menu, defaults: { items: [{ label: 'Edit' }, { label: 'Delete', danger: true }] },
    inspector: [{ key: 'items', label: 'Items (JSON: [{label,icon?,danger?,separator?}])', kind: 'json' }, { key: 'align', label: 'Align', kind: 'select', options: [{ value: 'left', label: 'Left' }, { value: 'right', label: 'Right' }] }] },
];

export const CHART_ENTRIES: ComponentDef[] = [
  { type: 'chart', label: 'Chart', category: 'Charts', icon: 'chart', component: Chart, defaults: { type: 'bar', series: [{ name: 'Series 1', data: [{ label: 'A', value: 12 }, { label: 'B', value: 19 }, { label: 'C', value: 8 }] }] },
    inspector: [{ key: 'type', label: 'Type', kind: 'select', options: [{ value: 'bar', label: 'Bar' }, { value: 'line', label: 'Line' }, { value: 'pie', label: 'Pie' }, { value: 'donut', label: 'Donut' }] }, { key: 'series', label: 'Series (JSON: [{name,color?,data:[{label,value}]}])', kind: 'json' }, { key: 'height', label: 'Height (px)', kind: 'number', min: 100, max: 500 }, { key: 'showLegend', label: 'Legend', kind: 'boolean' }],
    pages: true },
];
