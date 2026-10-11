/** The component registry - single lookup for palette, canvas and runtime. */

import { newId, type FormNode } from '@mosaic-apps/mosaic-core';
import type { ComponentDef, ComponentCategory } from './types.js';
import { CATEGORIES } from './types.js';
import { INPUT_ENTRIES_A } from './entries-inputs.js';
import { INPUT_ENTRIES_B } from './entries-inputs-b.js';
import { DATA_ENTRIES } from './entries-data.js';
import { LAYOUT_ENTRIES } from './entries-layout.js';
import { DISPLAY_ENTRIES } from './entries-display.js';
import { FEEDBACK_ENTRIES } from './entries-feedback.js';
import { NAV_ENTRIES, CHART_ENTRIES } from './entries-nav.js';

export const COMPONENTS: ComponentDef[] = [
  ...INPUT_ENTRIES_A,
  ...INPUT_ENTRIES_B,
  ...DATA_ENTRIES,
  ...LAYOUT_ENTRIES,
  ...DISPLAY_ENTRIES,
  ...FEEDBACK_ENTRIES,
  ...NAV_ENTRIES,
  ...CHART_ENTRIES,
];

const BY_TYPE = new Map(COMPONENTS.map((c) => [c.type, c]));

export function getComponent(type: string): ComponentDef | undefined {
  return BY_TYPE.get(type);
}

export function isContainerType(type: string): boolean {
  return Boolean(BY_TYPE.get(type)?.container);
}

export function isFieldType(type: string): boolean {
  return Boolean(BY_TYPE.get(type)?.isField);
}

/** Create a new FormNode of the given type (with default props). */
export function createNode(type: string, patch?: Partial<FormNode>): FormNode {
  const def = BY_TYPE.get(type);
  const node: FormNode = {
    id: patch?.id ?? newId('c'),
    type,
    props: { ...(def?.defaults ?? {}) },
  };
  if (def?.container) node.children = [];
  if (patch?.props) node.props = { ...node.props, ...patch.props };
  if (patch?.meta) node.meta = patch.meta;
  return node;
}

/** Palette grouping (non-internal types). */
export function paletteCategories(pages = false): { category: ComponentCategory; label: string; icon: string; items: ComponentDef[] }[] {
  return CATEGORIES.map((c) => ({
    category: c.id,
    label: c.label,
    icon: c.icon,
    items: COMPONENTS.filter((d) => !d.internal && d.category === c.id && (!pages || d.pages || d.category === 'Layout')),
  })).filter((c) => c.items.length > 0);
}

export const TOTAL_COMPONENT_TYPES = COMPONENTS.length;

export * from './types.js';

