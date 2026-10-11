/** Entity decorator & field decorators — TypeScript classes replace JSON files. */

import 'reflect-metadata';
import { type FieldDef, type EntityDef, type EnumOption } from './types/entity.js';
import { validateEntity } from './types/entity.js';
import { newId, slugify } from './ids.js';

/** Class decorator: marks a class as an entity. */
export function Entity(options?: { name?: string; table?: string; label?: string; labelPlural?: string; softDelete?: boolean; timestamps?: boolean; audit?: boolean }): ClassDecorator {
  return (target: Function) => {
    Reflect.defineMetadata('mosaic:entity', { ...options, className: target.name }, target);
  };
}

/** Field decorator: marks a property as a persisted field. */
export function Field(options?: {
  type?: 'string' | 'text' | 'int' | 'decimal' | 'boolean' | 'date' | 'datetime' | 'enum' | 'json' | 'ref' | 'file' | 'id';
  label?: string;
  required?: boolean;
  unique?: boolean;
  indexed?: boolean;
  default?: unknown;
  length?: number;
  precision?: number;
  scale?: number;
  format?: 'email' | 'url' | 'color' | 'password' | 'phone' | 'slug' | 'money';
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  enumOptions?: EnumOption[] | string[];
  refEntity?: string;
  onDelete?: 'cascade' | 'set null' | 'restrict';
  readable?: boolean;
  writable?: boolean;
  ui?: { widget?: string; placeholder?: string; helpText?: string; group?: string; order?: number };
}): PropertyDecorator {
  return (target: Object, propertyKey: string | symbol) => {
    const existing = Reflect.getMetadata('mosaic:fields', target) ?? [];
    const propName = String(propertyKey);
    const type = options?.type ?? inferType(target, propName);
    existing.push({ name: propName, type, ...options });
    Reflect.defineMetadata('mosaic:fields', existing, target);
  };
}

/** Infer TS type when not explicitly provided. */
function inferType(target: Object, propName: string): FieldDef['type'] {
  const designType = Reflect.getMetadata('design:type', target, propName);
  if (!designType) return 'string';
  switch (designType) {
    case String: return 'string';
    case Number: return 'int';
    case Boolean: return 'boolean';
    case Date: return 'datetime';
    case Object: return 'json';
    default: return 'string';
  }
}

/** Relation decorator: marks a property as a reference to another entity. */
export function Relation(options: { entity: string | (() => EntityClass); onDelete?: 'cascade' | 'set null' | 'restrict' }): PropertyDecorator {
  return (target: Object, propertyKey: string | symbol) => {
    const existing = Reflect.getMetadata('mosaic:fields', target) ?? [];
    const propName = String(propertyKey);
    const refEntity = typeof options.entity === 'string' 
      ? options.entity 
      : (options.entity().entityName ?? slugify(options.entity().name));
    existing.push({
      name: propName,
      type: 'ref',
      refEntity,
      onDelete: options.onDelete ?? 'restrict',
    });
    Reflect.defineMetadata('mosaic:fields', existing, target);
  };
}

/** Entity class registry. */
export interface EntityClass extends Function {
  entityName?: string;
  new (...args: any[]): any;
}

const entityRegistry = new Map<string, EntityClass>();

/** Register an entity class (called by @Entity decorator). */
export function registerEntity(entityClass: EntityClass): void {
  const meta = Reflect.getMetadata('mosaic:entity', entityClass);
  if (!meta) throw new Error(`${entityClass.name} is missing @Entity()`);
  const name = meta.name ?? slugify(entityClass.name);
  entityRegistry.set(name, entityClass);
}

/** Get entity class by name. */
export function getEntityClass(name: string): EntityClass | undefined {
  return entityRegistry.get(name);
}

/** Extract EntityDef from a class (for JSON storage/API). */
export function extractEntityDef(entityClass: EntityClass): EntityDef {
  const meta = Reflect.getMetadata('mosaic:entity', entityClass);
  if (!meta) throw new Error(`${entityClass.name} is missing @Entity()`);

  const fields = Reflect.getMetadata('mosaic:fields', entityClass.prototype) ?? [];
  const fieldDefs = fields.map((f: any) => ({
    name: f.name,
    type: f.type,
    label: f.label ?? f.name,
    required: f.required ?? false,
    unique: f.unique ?? false,
    indexed: f.indexed ?? false,
    default: f.default,
    length: f.length,
    precision: f.precision,
    scale: f.scale,
    format: f.format,
    min: f.min,
    max: f.max,
    minLength: f.minLength,
    maxLength: f.maxLength,
    options: f.enumOptions ? f.enumOptions.map((o: any) => (typeof o === 'string' ? { value: o } : o)) : undefined,
    refEntity: f.refEntity,
    onDelete: f.onDelete,
    readable: f.readable ?? true,
    writable: f.writable ?? true,
    ui: f.ui,
  }));

  const def: EntityDef = {
    name: meta.name ?? slugify(entityClass.name),
    label: meta.label ?? entityClass.name,
    labelPlural: meta.labelPlural ?? `${meta.label ?? entityClass.name}s`,
    icon: meta.icon,
    softDelete: meta.softDelete ?? false,
    timestamps: meta.timestamps ?? true,
    audit: meta.audit ?? true,
    permissions: { read: ['*'], create: ['admin', 'editor'], update: ['admin', 'editor'], delete: ['admin'] },
    list: { defaultSort: '-createdAt' },
    fields: fieldDefs,
  };

  const errors = validateEntity(def);
  if (errors.length) throw new Error(`Entity ${def.name} invalid: ${errors.join(', ')}`);
  return def;
}

/** Load all entity classes from a directory (scans *.entity.ts). */
export async function loadEntitiesFromDir(dir: string): Promise<EntityClass[]> {
  const { readdir } = await import('node:fs/promises');
  const { join, resolve } = await import('node:path');
  let entities: EntityClass[] = [];
  try {
    const files = await readdir(dir);
    for (const file of files.filter(f => f.endsWith('.entity.ts'))) {
      const mod = await import(join(resolve(dir), file));
      for (const exp of Object.values(mod)) {
        if (typeof exp === 'function' && Reflect.getMetadata('mosaic:entity', exp)) {
          entities.push(exp as EntityClass);
        }
      }
    }
  } catch { /* directory may not exist */ }
  return entities;
}

/** Auto-register all entities found (for CLI/server boot). */
export async function autoRegisterEntities(dir: string): Promise<void> {
  const entities = await loadEntitiesFromDir(dir);
  for (const e of entities) registerEntity(e);
}


