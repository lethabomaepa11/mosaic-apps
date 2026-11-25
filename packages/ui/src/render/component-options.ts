import type { ComponentAction } from '@mosaic-apps/core';
import { isFieldType } from '../registry/index.js';
import type { PropDesc } from '../registry/types.js';

export type ComponentEvent = 'onclick' | 'onchange' | 'onrowclick';

const eventOptions: Record<ComponentEvent, PropDesc> = {
  onclick: { key: 'onclick', label: 'Click', kind: 'actions' },
  onchange: { key: 'onchange', label: 'Value change', kind: 'actions', help: 'Use {{event}} for the new value.' },
  onrowclick: { key: 'onrowclick', label: 'Row click', kind: 'actions', help: 'Use {{event.id}} or another field from the selected row.' },
};

export function componentEvents(type: string, legacyClick = false): PropDesc[] {
  const events: PropDesc[] = [];
  if (legacyClick || type === 'button' || type === 'iconButton') events.push(eventOptions.onclick);
  if (isFieldType(type) || type === 'searchField') events.push(eventOptions.onchange);
  if (type === 'dataTable' || type === 'entityTable') events.push(eventOptions.onrowclick);
  return events;
}

export function eventActions(props: Record<string, unknown>, key: string): ComponentAction[] {
  const events = props.events as Record<string, unknown> | undefined;
  const actions = events?.[key] ?? (key === 'onclick' ? props.actions : undefined);
  return Array.isArray(actions) ? actions as ComponentAction[] : [];
}

const fonts = { sans: 'system-ui, sans-serif', serif: 'Georgia, serif', mono: 'monospace' };

export const appearanceProps: PropDesc[] = [
  { key: 'padding', label: 'Padding (px)', kind: 'number', min: 0, max: 200 },
  { key: 'margin', label: 'Margin (px)', kind: 'number', min: 0, max: 200 },
  { key: 'fontSize', label: 'Font size (px)', kind: 'number', min: 8, max: 120 },
  { key: 'fontFamily', label: 'Font family', kind: 'select', options: [
    { value: 'default', label: 'Default' }, { value: 'sans', label: 'Sans serif' },
    { value: 'serif', label: 'Serif' }, { value: 'mono', label: 'Monospace' },
  ] },
  { key: 'fontWeight', label: 'Font weight', kind: 'select', options: [
    { value: 'default', label: 'Default' }, { value: '400', label: 'Regular' },
    { value: '500', label: 'Medium' }, { value: '600', label: 'Semibold' }, { value: '700', label: 'Bold' },
  ] },
];

export function appearanceStyle(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  const props = value as Record<string, unknown>;
  const { fontFamily, fontWeight } = props;
  const style: string[] = [];
  for (const { key, min, max } of appearanceProps) {
    const amount = props[key];
    if (min === undefined || max === undefined || typeof amount !== 'number' || !Number.isFinite(amount) || amount < min || amount > max) continue;
    if (key === 'fontSize') style.push(`--m-component-font-size:${amount}px`, `font-size:${amount}px`);
    else style.push(`${key}:${amount}px`);
  }
  if (typeof fontFamily === 'string' && Object.hasOwn(fonts, fontFamily)) style.push(`font-family:${fonts[fontFamily as keyof typeof fonts]}`);
  if (fontWeight === '400' || fontWeight === '500' || fontWeight === '600' || fontWeight === '700') {
    style.push(`--m-component-font-weight:${fontWeight}`, `font-weight:${fontWeight}`);
  }
  return style.join(';');
}
