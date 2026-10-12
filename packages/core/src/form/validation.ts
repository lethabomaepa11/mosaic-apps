import type { FormNode } from '../types/form.js';

function object(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value); }
const blocked = new Set(['__proto__', 'prototype', 'constructor']);

/** Validate bounded, serializable component trees before storing or importing. */
export function validateDefinitionTree(root: unknown): asserts root is FormNode {
  const pending: { value: unknown; depth: number }[] = [{ value: root, depth: 0 }];
  const ids = new Set<string>();
  while (pending.length) {
    const { value, depth } = pending.pop()!;
    if (depth > 32 || ids.size >= 2000) throw new Error('Definitions are limited to 2000 components and 32 layout levels.');
    if (!object(value) || typeof value.id !== 'string' || !value.id.trim() || value.id.length > 200 || typeof value.type !== 'string' || !/^[A-Za-z][\w.-]{0,100}$/.test(value.type)) throw new Error('Each component needs a valid id and type.');
    if (ids.has(value.id)) throw new Error(`Component id ${value.id} is duplicated.`);
    ids.add(value.id);
    if (value.children !== undefined && !Array.isArray(value.children)) throw new Error(`Component ${value.id} children must be an array.`);
    if (value.props !== undefined && !object(value.props)) throw new Error(`Component ${value.id} properties must be an object.`);
    const props = value.props as Record<string, unknown> | undefined;
    if (props?.binding !== undefined && props.binding !== '' && (typeof props.binding !== 'string' || props.binding.split('.').some(part => !part.trim() || blocked.has(part.trim())))) throw new Error(`Component ${value.id} has an invalid data binding.`);
    if (props?.actions !== undefined) validateComponentActions(props.actions);
    if (props?.rowActions !== undefined) {
      if (!Array.isArray(props.rowActions) || props.rowActions.length > 30) throw new Error('Tables support at most 30 row actions.');
      const actionIds = new Set<string>();
      for (const action of props.rowActions) {
        if (!object(action) || typeof action.id !== 'string' || !/^[\w-]{1,100}$/.test(action.id) || actionIds.has(action.id) || typeof action.label !== 'string' || !action.label.trim() || action.label.length > 100 || (action.when !== undefined && typeof action.when !== 'string')) throw new Error('Row actions need unique ids, labels and valid conditions.');
        actionIds.add(action.id); validateComponentActions(action.actions);
      }
    }
    for (const key of ['visibleIf', 'disabledIf']) {
      const condition = props?.[key];
      if (condition !== undefined && condition !== null && condition !== '' && typeof condition !== 'string' && (!object(condition) || condition.kind !== 'script' || typeof condition.source !== 'string' || condition.source.length > 50000)) throw new Error(`Component ${value.id} has an invalid ${key} condition.`);
    }
    for (const child of (value.children as unknown[] | undefined) ?? []) pending.push({ value: child, depth: depth + 1 });
  }
}

export function validateComponentActions(value: unknown): void {
  if (!Array.isArray(value) || value.length > 100) throw new Error('Component actions must be an array with at most 100 actions.');
  for (const action of value) {
    if (!object(action)) throw new Error('Each action must be an object.');
    if (action.when !== undefined && (typeof action.when !== 'string' || action.when.length > 10000)) throw new Error('Action conditions must be safe expressions.');
    if (action.type === 'script') {
      if (typeof action.source !== 'string' || action.source.length > 50000 || (action.language !== undefined && !['javascript', 'typescript'].includes(String(action.language)))) throw new Error('Scripts need valid JavaScript or TypeScript source.');
    } else if (action.type === 'message' || action.type === 'confirm') {
      if (typeof action.title !== 'string') throw new Error('Message actions need a title.');
    } else if (action.type === 'navigate') {
      if (!['form', 'page', 'url'].includes(String(action.target)) || typeof action.to !== 'string' || (action.params !== undefined && !object(action.params))) throw new Error('Navigation actions need a valid target and parameters.');
    } else if (action.type === 'api') {
      if (typeof action.path !== 'string' || !action.path.startsWith('/') || action.path.startsWith('//') || action.path.includes('\\') || (action.method !== undefined && !['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(String(action.method)))) throw new Error('API actions need a local path and supported method.');
      if (action.result !== undefined && (!object(action.result) || !['application', 'page', 'form', 'component'].includes(String(action.result.scope)) || typeof action.result.path !== 'string' || action.result.path.split('.').some(part => !part.trim() || blocked.has(part.trim())))) throw new Error('API results need a safe scope and path.');
    } else if (action.type === 'state.set') {
      if (!object(action.target) || !['application', 'page', 'form', 'component'].includes(String(action.target.scope)) || typeof action.target.path !== 'string' || action.target.path.split('.').some(part => !part.trim() || blocked.has(part.trim()))) throw new Error('State actions need a safe scope and path.');
    } else throw new Error(`Unsupported action type: ${String(action.type)}.`);
  }
}
