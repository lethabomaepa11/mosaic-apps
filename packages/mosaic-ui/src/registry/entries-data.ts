/** Registry entries: data components. */

import type { ComponentDef, PropDesc } from './types.js';
import DataTable from '../components/DataTable.svelte';
import EntityTable from '../components/EntityTable.svelte';
import Pagination from '../components/Pagination.svelte';
import Toolbar from '../components/Toolbar.svelte';
import FilterBar from '../components/FilterBar.svelte';
import Subform from '../components/Subform.svelte';

export const DATA_ENTRIES: ComponentDef[] = [
  {
    type: 'subform',
    label: 'Embedded form',
    category: 'Data',
    icon: 'files',
    component: Subform,
    defaults: { formId: '', binding: 'childFormData', props: {}, mode: 'create' },
    inspector: [
      { key: 'formId', label: 'Form', kind: 'formRef', help: 'Select the form to render inside this component.' },
      { key: 'binding', label: 'Parent data binding', kind: 'binding', help: 'The nested form values are stored as an object at this parent path.' },
      { key: 'props', label: 'Initial props (JSON object)', kind: 'json', help: 'Values are merged below the bound child form data.' },
      { key: 'mode', label: 'Child form mode', kind: 'select', options: [{ value: 'create', label: 'Create' }, { value: 'edit', label: 'Edit' }, { value: 'view', label: 'View' }] },
    ],
  },
  {
    type: 'dataTable',
    label: 'Data table',
    category: 'Data',
    icon: 'clipboardList',
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
    icon: 'database',
    component: EntityTable,
    defaults: { title: 'Records', pageSize: 10, sortable: true, searchable: true, allowCreate: true, allowEdit: true, allowDelete: true, drillDown: true, columns: [] },
    inspector: [
      { key: 'entity', label: 'Entity', kind: 'entityRef' },
      { key: 'title', label: 'Title', kind: 'string' },
      { key: 'columns', label: 'Visible columns', kind: 'columns' },
      { key: 'pageSize', label: 'Page size', kind: 'number', min: 5, max: 100 },
      { key: 'sortable', label: 'Sortable', kind: 'boolean' },
      { key: 'searchable', label: 'Searchable', kind: 'boolean' },
      { key: 'allowCreate', label: 'Allow create', kind: 'boolean' },
      { key: 'allowEdit', label: 'Allow edit', kind: 'boolean' },
      { key: 'allowDelete', label: 'Allow delete', kind: 'boolean' },
      { key: 'drillDown', label: 'Open detail view on selection', kind: 'boolean' },
    ],
    pages: true,
  },
  {
    type: 'pagination',
    label: 'Pagination',
    category: 'Data',
    icon: 'table',
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
    icon: 'boxes',
    component: Toolbar,
    container: true,
    defaults: {},
  },
  {
    type: 'filterBar',
    label: 'Filter bar',
    category: 'Data',
    icon: 'filter',
    component: FilterBar,
    container: true,
    defaults: {},
  },
];
