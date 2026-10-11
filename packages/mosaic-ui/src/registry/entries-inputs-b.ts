/** Registry entries: input components (part 2: choices, refs, misc). */

import type { ComponentDef, PropDesc } from './types.js';
import { FIELD_PROPS } from './types.js';
import MultiSelect from '../components/MultiSelect.svelte';
import ChoiceGroup from '../components/ChoiceGroup.svelte';
import Switch from '../components/Switch.svelte';
import Slider from '../components/Slider.svelte';
import DatePicker from '../components/DatePicker.svelte';
import ColorPicker from '../components/ColorPicker.svelte';
import RateInput from '../components/RateInput.svelte';
import RefSelect from '../components/RefSelect.svelte';
import JsonEditor from '../components/JsonEditor.svelte';
import FileUpload from '../components/FileUpload.svelte';
import SearchField from '../components/SearchField.svelte';

const OPTIONS_PROP: PropDesc = { key: 'options', label: 'Options (JSON)', kind: 'json', help: '[{ "value": "a", "label": "A" }]' };

function inspector(extra: PropDesc[] = []): PropDesc[] {
  return [
    { key: 'binding', label: 'Data binding', kind: 'binding' },
    ...FIELD_PROPS,
    ...extra,
  ];
}

export const INPUT_ENTRIES_B: ComponentDef[] = [
  {
    type: 'multiSelect',
    label: 'Multi select',
    category: 'Inputs',
    icon: '☑',
    component: MultiSelect,
    isField: true,
    defaults: { label: 'Select many', options: [] },
    inspector: inspector([OPTIONS_PROP]),
  },
  {
    type: 'radioGroup',
    label: 'Radio group',
    category: 'Inputs',
    icon: '◉',
    component: ChoiceGroup,
    isField: true,
    defaults: { mode: 'radio', label: 'Choose one', options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] },
    inspector: inspector([OPTIONS_PROP]),
  },
  {
    type: 'checkboxGroup',
    label: 'Checkbox group',
    category: 'Inputs',
    icon: '☑',
    component: ChoiceGroup,
    isField: true,
    defaults: { mode: 'checkbox', label: 'Check all that apply', options: [] },
    inspector: inspector([OPTIONS_PROP]),
  },
  {
    type: 'switch',
    label: 'Switch',
    category: 'Inputs',
    icon: '🎚️',
    component: Switch,
    isField: true,
    defaults: { label: 'Enabled' },
    inspector: inspector(),
  },
  {
    type: 'slider',
    label: 'Slider',
    category: 'Inputs',
    icon: '🎚',
    component: Slider,
    isField: true,
    defaults: { label: 'Value', min: 0, max: 100, step: 1 },
    inspector: inspector([
      { key: 'min', label: 'Min', kind: 'number' },
      { key: 'max', label: 'Max', kind: 'number' },
      { key: 'step', label: 'Step', kind: 'number' },
    ]),
  },
  {
    type: 'datePicker',
    label: 'Date',
    category: 'Inputs',
    icon: '📅',
    component: DatePicker,
    isField: true,
    defaults: { label: 'Date' },
    inspector: inspector(),
  },
  {
    type: 'timePicker',
    label: 'Date & time',
    category: 'Inputs',
    icon: '🕒',
    component: DatePicker,
    isField: true,
    defaults: { label: 'Date & time', withTime: true },
    inspector: inspector(),
  },
  {
    type: 'colorPicker',
    label: 'Color',
    category: 'Inputs',
    icon: '🎨',
    component: ColorPicker,
    isField: true,
    defaults: { label: 'Color' },
    inspector: inspector(),
  },
  {
    type: 'rateInput',
    label: 'Rating',
    category: 'Inputs',
    icon: '⭐',
    component: RateInput,
    isField: true,
    defaults: { label: 'Rating', count: 5 },
    inspector: inspector([{ key: 'count', label: 'Stars', kind: 'number', min: 3, max: 10 }]),
  },
  {
    type: 'refSelect',
    label: 'Record picker (relation)',
    category: 'Inputs',
    icon: '🔗',
    component: RefSelect,
    isField: true,
    defaults: { label: 'Related record', entity: '' },
    inspector: inspector([{ key: 'entity', label: 'Entity', kind: 'entityRef' }]),
  },
  {
    type: 'jsonEditor',
    label: 'JSON editor',
    category: 'Inputs',
    icon: '{ }',
    component: JsonEditor,
    isField: true,
    defaults: { label: 'JSON', rows: 6 },
    inspector: inspector([{ key: 'rows', label: 'Rows', kind: 'number', min: 2, max: 24 }]),
  },
  {
    type: 'fileUpload',
    label: 'File upload',
    category: 'Inputs',
    icon: '📎',
    component: FileUpload,
    isField: true,
    defaults: { label: 'Attachment' },
    inspector: inspector([{ key: 'accept', label: 'Accept', kind: 'string', placeholder: '.pdf,image/*' }]),
  },
  {
    type: 'searchField',
    label: 'Search box',
    category: 'Inputs',
    icon: '⌕',
    component: SearchField,
    isField: false,
    defaults: { placeholder: 'Search…' },
    inspector: [
      { key: 'placeholder', label: 'Placeholder', kind: 'string' },
      { key: 'debounceMs', label: 'Debounce (ms)', kind: 'number', min: 0 },
    ],
  },
];
