/** The component registry - single lookup for palette, canvas and runtime. */

import { newId, type FormNode } from '@mosaic-apps/core';
import type { ComponentDef, ComponentCategory } from './types.js';
import { CATEGORIES } from './types.js';
import { INPUT_ENTRIES_A } from './entries-inputs.js';
import { INPUT_ENTRIES_B } from './entries-inputs-b.js';
import { DATA_ENTRIES } from './entries-data.js';
import { LAYOUT_ENTRIES } from './entries-layout.js';
import { DISPLAY_ENTRIES } from './entries-display.js';
import { FEEDBACK_ENTRIES } from './entries-feedback.js';
import { NAV_ENTRIES, CHART_ENTRIES } from './entries-nav.js';
import { createComponentRegistry, type RegisterComponentOptions } from './store.js';

const REGISTRY = createComponentRegistry([
  ...INPUT_ENTRIES_A,
  ...INPUT_ENTRIES_B,
  ...DATA_ENTRIES,
  ...LAYOUT_ENTRIES,
  ...DISPLAY_ENTRIES,
  ...FEEDBACK_ENTRIES,
  ...NAV_ENTRIES,
  ...CHART_ENTRIES,
]);
export const COMPONENTS = REGISTRY.components;
export type { RegisterComponentOptions } from './store.js';

/** Register a package or project component for the renderer, palette, and inspector. */
export function registerComponent(definition: ComponentDef, options: RegisterComponentOptions = {}): () => void {
  return REGISTRY.register(definition, options);
}

/** Remove a custom registration. An overridden built-in returns to its original definition. */
export function unregisterComponent(type: string, expected?: ComponentDef): boolean {
  return REGISTRY.unregister(type, expected);
}

export function isCustomComponent(type: string): boolean {
  return REGISTRY.isCustom(type);
}

export function getComponent(type: string): ComponentDef | undefined {
  return REGISTRY.get(type);
}

export function isContainerType(type: string): boolean {
  return Boolean(REGISTRY.get(type)?.container);
}

export function isFieldType(type: string): boolean {
  return Boolean(REGISTRY.get(type)?.isField);
}

/** Create a new FormNode of the given type (with default props). */
export function createNode(type: string, patch?: Partial<FormNode>): FormNode {
  const def = REGISTRY.get(type);
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

