import type { ComponentDef } from './types.js';

export interface RegisterComponentOptions {
  /** Explicitly replace an existing registration. Built-ins are restored on unregister. */
  replace?: boolean;
}

export function createComponentRegistry(initial: ComponentDef[]) {
  const components = [...initial];
  const byType = new Map(components.map((component) => [component.type, component]));
  const builtIns = new Map(byType);

  function get(type: string): ComponentDef | undefined {
    return byType.get(type);
  }

  function unregister(type: string, expected?: ComponentDef): boolean {
    const existing = byType.get(type);
    if (!existing || (expected && existing !== expected)) return false;
    const builtIn = builtIns.get(type);
    const index = components.indexOf(existing);
    if (builtIn) {
      if (index >= 0) components.splice(index, 1, builtIn);
      byType.set(type, builtIn);
    } else {
      if (index >= 0) components.splice(index, 1);
      byType.delete(type);
    }
    return true;
  }

  function register(definition: ComponentDef, options: RegisterComponentOptions = {}): () => void {
    if (!/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/.test(definition.type)) {
      throw new Error(`Invalid Mosaic component type: ${definition.type}`);
    }
    const existing = byType.get(definition.type);
    if (existing && !options.replace) throw new Error(`Mosaic component type is already registered: ${definition.type}`);
    if (existing) components.splice(components.indexOf(existing), 1, definition);
    else components.push(definition);
    byType.set(definition.type, definition);
    return () => unregister(definition.type, definition);
  }

  return {
    components,
    get,
    register,
    unregister,
    isCustom: (type: string) => byType.has(type) && byType.get(type) !== builtIns.get(type),
  };
}
