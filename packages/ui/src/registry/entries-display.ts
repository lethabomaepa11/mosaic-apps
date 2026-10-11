/** Registry entries: display components. */

import type { ComponentDef } from './types.js';
import Heading from '../components/Heading.svelte';
import Divider from '../components/Divider.svelte';
import StatCard from '../components/StatCard.svelte';
import Grid from '../components/Grid.svelte';
import Timeline from '../components/Timeline.svelte';
import Avatar from '../components/Avatar.svelte';
import DescriptionList from '../components/DescriptionList.svelte';
import CodeBlock from '../components/CodeBlock.svelte';
import JsonView from '../components/JsonView.svelte';
import TreeView from '../components/TreeView.svelte';
import Breadcrumbs from '../components/Breadcrumbs.svelte';
import Image from '../components/Image.svelte';

export const DISPLAY_ENTRIES: ComponentDef[] = [
  { type: 'image', label: 'Image', category: 'Display', icon: 'image', component: Image, defaults: { src: '', alt: '', width: '100%', height: 'auto', fit: 'cover', href: '', caption: '' }, pages: true,
    inspector: [{ key: 'src', label: 'Image URL', kind: 'string', placeholder: 'https://…' }, { key: 'alt', label: 'Alt text', kind: 'string' }, { key: 'width', label: 'Width', kind: 'string', placeholder: '100% or 320px' }, { key: 'height', label: 'Height', kind: 'string', placeholder: 'auto or 240px' }, { key: 'fit', label: 'Image fit', kind: 'select', options: [{ value: 'cover', label: 'Cover' }, { value: 'contain', label: 'Contain' }, { value: 'fill', label: 'Fill' }, { value: 'none', label: 'Natural size' }] }, { key: 'href', label: 'Link URL', kind: 'string' }, { key: 'caption', label: 'Caption', kind: 'string' }] },
  { type: 'heading', label: 'Heading', category: 'Display', icon: 'heading', component: Heading, defaults: { text: 'Heading', level: 1 },
    inspector: [{ key: 'text', label: 'Text', kind: 'string' }, { key: 'level', label: 'Level', kind: 'select', options: [{ value: '1', label: 'H1' }, { value: '2', label: 'H2' }, { value: '3', label: 'H3' }, { value: '4', label: 'H4' }] }, { key: 'muted', label: 'Muted', kind: 'boolean' }] },
  { type: 'divider', label: 'Divider', category: 'Display', icon: 'divider', component: Divider, defaults: {} },
  { type: 'statCard', label: 'Stat card', category: 'Display', icon: 'trendingUp', component: StatCard, defaults: { label: 'Metric', value: '0' },
    inspector: [{ key: 'label', label: 'Label', kind: 'string' }, { key: 'value', label: 'Value (static)', kind: 'string' }, { key: 'entity', label: 'Or entity (live count)', kind: 'entityRef' }, { key: 'trend', label: 'Trend text', kind: 'string' }, { key: 'trendDir', label: 'Trend direction', kind: 'select', options: [{ value: 'up', label: 'Up' }, { value: 'down', label: 'Down' }] }, { key: 'icon', label: 'Icon', kind: 'string' }],
    pages: true },
  { type: 'statRow', label: 'Stat row (container)', category: 'Display', icon: 'chart', component: Grid, container: true, defaults: { columns: 'auto', gap: 'md' }, pages: true },
  { type: 'timeline', label: 'Timeline', category: 'Display', icon: 'history', component: Timeline, defaults: { items: [{ title: 'Event', text: 'Details', time: 'now' }] },
    inspector: [{ key: 'items', label: 'Items (JSON: [{title,text,time}])', kind: 'json' }] },
  { type: 'avatar', label: 'Avatar', category: 'Display', icon: 'avatar', component: Avatar, defaults: { name: 'Jane Doe' },
    inspector: [{ key: 'name', label: 'Name', kind: 'string' }, { key: 'color', label: 'Color', kind: 'color' }, { key: 'size', label: 'Size', kind: 'select', options: [{ value: 'md', label: 'Medium' }, { value: 'lg', label: 'Large' }] }] },
  { type: 'descriptionList', label: 'Description list', category: 'Display', icon: 'clipboardList', component: DescriptionList, defaults: { items: [{ label: 'Field', value: 'Value' }] },
    inspector: [{ key: 'items', label: 'Items (JSON: [{label,value}])', kind: 'json' }] },
  { type: 'codeBlock', label: 'Code block', category: 'Display', icon: 'code', component: CodeBlock, defaults: { code: '// code', language: 'ts' },
    inspector: [{ key: 'code', label: 'Code', kind: 'text' }] },
  { type: 'jsonView', label: 'JSON viewer', category: 'Display', icon: 'json', component: JsonView, defaults: { value: { hello: 'world' } },
    inspector: [{ key: 'value', label: 'Value (JSON)', kind: 'json' }, { key: 'collapsed', label: 'Start collapsed', kind: 'boolean' }] },
  { type: 'treeView', label: 'Tree view', category: 'Display', icon: 'treeView', component: TreeView, defaults: { nodes: [{ id: '1', label: 'Root', children: [{ id: '1.1', label: 'Child' }] }] },
    inspector: [{ key: 'nodes', label: 'Nodes (JSON: [{id,label,children?}])', kind: 'json' }] },
  { type: 'breadcrumbs', label: 'Breadcrumbs', category: 'Display', icon: 'breadcrumb', component: Breadcrumbs, defaults: { items: [{ label: 'Home' }, { label: 'Page' }] },
    inspector: [{ key: 'items', label: 'Crumbs (JSON: [{label,href?}])', kind: 'json' }] },
];
