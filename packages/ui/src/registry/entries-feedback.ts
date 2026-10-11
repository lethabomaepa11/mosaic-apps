/** Registry entries: feedback components. */

import type { ComponentDef } from './types.js';
import Alert from '../components/Alert.svelte';
import Badge from '../components/Badge.svelte';
import Progress from '../components/Progress.svelte';
import Spinner from '../components/Spinner.svelte';
import Skeleton from '../components/Skeleton.svelte';
import Tooltip from '../components/Tooltip.svelte';

export const FEEDBACK_ENTRIES: ComponentDef[] = [
  { type: 'alert', label: 'Alert', category: 'Feedback', icon: 'info', component: Alert, defaults: { variant: 'info', title: 'Heads up', text: 'Something happened.' },
    inspector: [{ key: 'variant', label: 'Variant', kind: 'select', options: [{ value: 'info', label: 'Info' }, { value: 'success', label: 'Success' }, { value: 'warning', label: 'Warning' }, { value: 'danger', label: 'Danger' }] }, { key: 'title', label: 'Title', kind: 'string' }, { key: 'text', label: 'Text', kind: 'text' }] },
  { type: 'badge', label: 'Badge', category: 'Feedback', icon: 'tag', component: Badge, defaults: { text: 'New', variant: 'primary' },
    inspector: [{ key: 'text', label: 'Text', kind: 'string' }, { key: 'variant', label: 'Variant', kind: 'select', options: [{ value: 'default', label: 'Default' }, { value: 'primary', label: 'Primary' }, { value: 'success', label: 'Success' }, { value: 'warning', label: 'Warning' }, { value: 'danger', label: 'Danger' }, { value: 'info', label: 'Info' }, { value: 'outline', label: 'Outline' }] }, { key: 'color', label: 'Custom color', kind: 'color' }] },
  { type: 'tag', label: 'Tag', category: 'Feedback', icon: 'tag', component: Badge, defaults: { text: 'tag', variant: 'default' },
    inspector: [{ key: 'text', label: 'Text', kind: 'string' }, { key: 'color', label: 'Color', kind: 'color' }] },
  { type: 'progress', label: 'Progress', category: 'Feedback', icon: 'progress', component: Progress, defaults: { value: 45 },
    inspector: [{ key: 'value', label: 'Percent', kind: 'number', min: 0, max: 100 }, { key: 'variant', label: 'Variant', kind: 'select', options: [{ value: 'primary', label: 'Primary' }, { value: 'success', label: 'Success' }, { value: 'warning', label: 'Warning' }, { value: 'danger', label: 'Danger' }] }, { key: 'showLabel', label: 'Show label', kind: 'boolean' }] },
  { type: 'spinner', label: 'Spinner', category: 'Feedback', icon: 'spinner', component: Spinner, defaults: { size: 'sm' },
    inspector: [{ key: 'size', label: 'Size', kind: 'select', options: [{ value: 'sm', label: 'Small' }, { value: 'lg', label: 'Large' }] }] },
  { type: 'skeleton', label: 'Skeleton', category: 'Feedback', icon: 'skeleton', component: Skeleton, defaults: { lines: 3 },
    inspector: [{ key: 'lines', label: 'Lines', kind: 'number', min: 1, max: 12 }, { key: 'width', label: 'Width', kind: 'string' }] },
  { type: 'tooltip', label: 'Tooltip', category: 'Feedback', icon: 'tooltip', component: Tooltip, defaults: { text: 'Helpful hint' },
    inspector: [{ key: 'text', label: 'Tooltip text', kind: 'string' }] },
];
