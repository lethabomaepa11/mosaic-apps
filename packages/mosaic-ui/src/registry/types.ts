/** Component registry types - shared by designer palette, canvas and runtime. */

import type { Component } from 'svelte';

export type ComponentCategory = 'Inputs' | 'Data' | 'Layout' | 'Display' | 'Feedback' | 'Navigation' | 'Charts';

export type PropKind =
  | 'string'
  | 'text'
  | 'number'
  | 'boolean'
  | 'color'
  | 'select'
  | 'json'
  | 'binding'
  | 'options'
  | 'entityRef'
  | 'columns';

export interface PropDesc {
  key: string;
  label: string;
  kind: PropKind;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  help?: string;
  /** grid columns hint at form level (1..4) */
  span?: 1 | 2 | 3 | 4;
}

export interface ComponentDef {
  /** registry key (FormNode.type) */
  type: string;
  label: string;
  category: ComponentCategory;
  icon: string;
  component: Component<any>;
  /** renders `children` FormNodes */
  container?: boolean;
  /** max children (containers only) */
  maxChildren?: number;
  /** renders a form input bound to `data[binding]` */
  isField?: boolean;
  /** default node props on drop */
  defaults?: Record<string, unknown>;
  /** property inspector descriptor */
  inspector?: PropDesc[];
  /** hidden from palette (internal runtime components) */
  internal?: boolean;
  /** shown in page designer too */
  pages?: boolean;
}

export const CATEGORIES: { id: ComponentCategory; label: string; icon: string }[] = [
  { id: 'Inputs', label: 'Inputs', icon: '⌨️' },
  { id: 'Data', label: 'Data', icon: '🗂️' },
  { id: 'Layout', label: 'Layout', icon: '🧱' },
  { id: 'Display', label: 'Display', icon: '🖼️' },
  { id: 'Feedback', label: 'Feedback', icon: '🔔' },
  { id: 'Navigation', label: 'Navigation', icon: '🧭' },
  { id: 'Charts', label: 'Charts', icon: '📊' },
];

/** Common inspector props reused by field components. */
export const FIELD_PROPS: PropDesc[] = [
  { key: 'label', label: 'Label', kind: 'string' },
  { key: 'required', label: 'Required', kind: 'boolean' },
  { key: 'placeholder', label: 'Placeholder', kind: 'string' },
  { key: 'helpText', label: 'Help text', kind: 'string' },
  { key: 'visibleIf', label: 'Visible when (expression)', kind: 'string', help: 'e.g. status === "active"' },
  { key: 'disabledIf', label: 'Disabled when (expression)', kind: 'string' },
  { key: 'colSpan', label: 'Grid columns', kind: 'select', options: [{ value: '1', label: '1' }, { value: '2', label: '2' }, { value: '3', label: '3' }, { value: '4', label: '4' }] },
];
