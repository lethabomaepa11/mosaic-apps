/** Registry entries: data components. */

import type { ComponentDef, PropDesc } from './types.js';
import DataTable from '../components/DataTable.svelte';
import EntityTable from '../components/EntityTable.svelte';
import Pagination from '../components/Pagination.svelte';
import Toolbar from '../components/Toolbar.svelte';
import FilterBar from '../components/FilterBar.svelte';

export const DATA_ENTRIES: ComponentDef[] = [
  {
    type: 'dataTable',
    label: 'Data table',
    category: 'Data',
    icon: '📋',
    component: DataTable,
    defaults: { columns: [{ key: 'name', label: 'Name' }, { key: 'createdAt', label: 'Created' }] },
    inspector: [
      { key: 'columns', label: 'Columns (JSON: [{key,label,width?,sortable?}])', kind: 'json' },
      { key: 'rows', label: 'Rows (JSON array)', kind: 'json' },
    ],
  },
  {
    type: 'entityTable',
    label: 'Entity table (live)',
    category: 'Data',
    icon: '🗃️',
    component: EntityTable,
    defaults: { title: 'Records', pageSize: 10, sortable: true, searchable: true, columns: [] },
    inspector: [
      { key: 'entity', label: 'Entity', kind: 'entityRef' },
      { key: 'title', label: 'Title', kind: 'string' },
      { key: 'columns', label: 'Columns (JSON array of field names, empty = defaults)', kind: 'json' },
      { key: 'pageSize', label: 'Page size', kind: 'number', min: 5, max: 100 },
      { key: 'sortable', label: 'Sortable', kind: 'boolean' },
      { key: 'searchable', label: 'Searchable', kind: 'boolean' },
    ],
    pages: true,
  },
  {
    type: 'pagination',
    label: 'Pagination',
    category: 'Data',
    icon: '⇥',
    component: Pagination,
    defaults: { page: 1, pageSize: 20, total: 0 },
    inspector: [
      { key: 'page', label: 'Page', kind: 'number', min: 1 },
      { key: 'pageSize', label: 'Page size', kind: 'number', min: 1 },
      { key: 'total', label: 'Total', kind: 'number', min: 0 },
    ],
  },
  {
    type: 'toolbar',
    label: 'Toolbar',
    category: 'Data',
    icon: '🧰',
    component: Toolbar,
    container: true,
    defaults: {},
  },
  {
    type: 'filterBar',
    label: 'Filter bar',
    category: 'Data',
    icon: '🔻',
    component: FilterBar,
    container: true,
    defaults: {},
  },
];
