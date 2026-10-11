/** Registry entries: layout components. */

import type { ComponentDef } from './types.js';
import Card from '../components/Card.svelte';
import Panel from '../components/Panel.svelte';
import Tabs from '../components/Tabs.svelte';
import Accordion from '../components/Accordion.svelte';
import Modal from '../components/Modal.svelte';
import Drawer from '../components/Drawer.svelte';
import Grid from '../components/Grid.svelte';
import Stepper from '../components/Stepper.svelte';
import EmptyState from '../components/EmptyState.svelte';
import SplitPane from '../components/SplitPane.svelte';

export const LAYOUT_ENTRIES: ComponentDef[] = [
  { type: 'card', label: 'Card', category: 'Layout', icon: 'card', component: Card, container: true, defaults: { title: 'Card title' },
    inspector: [{ key: 'title', label: 'Title', kind: 'string' }, { key: 'subtitle', label: 'Subtitle', kind: 'string' }, { key: 'flush', label: 'Flush padding', kind: 'boolean' }] },
  { type: 'panel', label: 'Panel', category: 'Layout', icon: 'panel', component: Panel, container: true, defaults: { title: 'Panel' },
    inspector: [{ key: 'title', label: 'Title', kind: 'string' }, { key: 'subtitle', label: 'Subtitle', kind: 'string' }] },
  { type: 'tabs', label: 'Tabs', category: 'Layout', icon: 'tabs', component: Tabs, container: true, maxChildren: 6, defaults: { tabs: [{ id: 'tab1', label: 'Tab 1' }, { id: 'tab2', label: 'Tab 2' }] },
    inspector: [{ key: 'tabs', label: 'Tabs (JSON: [{id,label}])', kind: 'json' }] },
  { type: 'accordion', label: 'Accordion', category: 'Layout', icon: 'accordion', component: Accordion, container: true, maxChildren: 6, defaults: { items: [{ id: 'sec1', title: 'Section 1' }, { id: 'sec2', title: 'Section 2' }] },
    inspector: [{ key: 'items', label: 'Sections (JSON: [{id,title}])', kind: 'json' }, { key: 'multiple', label: 'Allow multiple', kind: 'boolean' }] },
  { type: 'modal', label: 'Modal', category: 'Layout', icon: 'modal', component: Modal, container: true, defaults: { title: 'Modal title' },
    inspector: [{ key: 'title', label: 'Title', kind: 'string' }, { key: 'size', label: 'Size', kind: 'select', options: [{ value: 'md', label: 'Medium' }, { value: 'lg', label: 'Large' }] }] },
  { type: 'drawer', label: 'Drawer', category: 'Layout', icon: 'drawer', component: Drawer, container: true, defaults: { title: 'Drawer title' },
    inspector: [{ key: 'title', label: 'Title', kind: 'string' }, { key: 'side', label: 'Side', kind: 'select', options: [{ value: 'left', label: 'Left' }, { value: 'right', label: 'Right' }] }] },
  { type: 'grid', label: 'Grid', category: 'Layout', icon: 'grid', component: Grid, container: true, defaults: { columns: 2, gap: 'md' },
    inspector: [{ key: 'columns', label: 'Columns', kind: 'number', min: 1, max: 6 }, { key: 'gap', label: 'Gap', kind: 'select', options: [{ value: 'sm', label: 'Small' }, { value: 'md', label: 'Medium' }, { value: 'lg', label: 'Large' }] }] },
  { type: 'stack', label: 'Stack (column)', category: 'Layout', icon: 'list', component: Grid, container: true, defaults: { direction: 'column', gap: 'md' },
    inspector: [{ key: 'gap', label: 'Gap', kind: 'select', options: [{ value: 'sm', label: 'Small' }, { value: 'md', label: 'Medium' }, { value: 'lg', label: 'Large' }] }] },
  { type: 'stepper', label: 'Stepper / wizard', category: 'Layout', icon: 'stepper', component: Stepper, defaults: { steps: ['Step 1', 'Step 2', 'Step 3'], current: 0 },
    inspector: [{ key: 'steps', label: 'Steps (JSON array)', kind: 'json' }, { key: 'current', label: 'Current step', kind: 'number', min: 0 }] },
  { type: 'emptyState', label: 'Empty state', category: 'Layout', icon: 'inbox', component: EmptyState, defaults: { icon: 'inbox', title: 'Nothing here', text: '' },
    inspector: [{ key: 'icon', label: 'Icon', kind: 'string' }, { key: 'title', label: 'Title', kind: 'string' }, { key: 'text', label: 'Text', kind: 'text' }] },
  { type: 'splitPane', label: 'Split pane', category: 'Layout', icon: 'splitPane', component: SplitPane, container: true, maxChildren: 2, defaults: { initial: 30 },
    inspector: [{ key: 'initial', label: 'First pane %', kind: 'number', min: 10, max: 90 }, { key: 'direction', label: 'Direction', kind: 'select', options: [{ value: 'row', label: 'Row' }, { value: 'column', label: 'Column' }] }] },
];
