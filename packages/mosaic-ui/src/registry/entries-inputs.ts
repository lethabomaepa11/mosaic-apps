/** Registry entries: input components (part 1: text fields). */

import type { ComponentDef, PropDesc } from './types.js';
import { FIELD_PROPS } from './types.js';
import TextField from '../components/TextField.svelte';
import TextArea from '../components/TextArea.svelte';
import NumberField from '../components/NumberField.svelte';
import SelectField from '../components/SelectField.svelte';

const OPTIONS_PROP: PropDesc = { key: 'options', label: 'Options (JSON)', kind: 'json', help: '[{ "value": "a", "label": "A" }]' };

function inspector(extra: PropDesc[] = []): PropDesc[] {
  return [
    { key: 'binding', label: 'Data binding', kind: 'binding' },
    ...FIELD_PROPS,
    ...extra,
  ];
}

export const INPUT_ENTRIES_A: ComponentDef[] = [
  {
    type: 'textField',
    label: 'Text field',
    category: 'Inputs',
    icon: '📝',
    component: TextField,
    isField: true,
    defaults: { label: 'Text', placeholder: '' },
    inspector: inspector([
      { key: 'format', label: 'Format', kind: 'select', options: [
        { value: 'text', label: 'Text' }, { value: 'email', label: 'Email' }, { value: 'password', label: 'Password' },
        { value: 'url', label: 'URL' }, { value: 'phone', label: 'Phone' }, { value: 'slug', label: 'Slug' }, { value: 'money', label: 'Money' },
      ] },
      { key: 'maxlength', label: 'Max length', kind: 'number', min: 1 },
    ]),
  },
  {
    type: 'textArea',
    label: 'Text area',
    category: 'Inputs',
    icon: '🗒️',
    component: TextArea,
    isField: true,
    defaults: { label: 'Notes', rows: 3 },
    inspector: inspector([{ key: 'rows', label: 'Rows', kind: 'number', min: 1, max: 20 }]),
  },
  {
    type: 'numberField',
    label: 'Number',
    category: 'Inputs',
    icon: '🔢',
    component: NumberField,
    isField: true,
    defaults: { label: 'Number' },
    inspector: inspector([
      { key: 'min', label: 'Min', kind: 'number' },
      { key: 'max', label: 'Max', kind: 'number' },
      { key: 'step', label: 'Step', kind: 'number' },
    ]),
  },
  {
    type: 'currencyField',
    label: 'Currency',
    category: 'Inputs',
    icon: '💲',
    component: TextField,
    isField: true,
    defaults: { label: 'Amount', format: 'money' },
    inspector: inspector(),
  },
  {
    type: 'selectField',
    label: 'Select',
    category: 'Inputs',
    icon: '▾',
    component: SelectField,
    isField: true,
    defaults: { label: 'Select', options: [{ value: 'a', label: 'Option A' }, { value: 'b', label: 'Option B' }] },
    inspector: inspector([OPTIONS_PROP]),
  },
];
