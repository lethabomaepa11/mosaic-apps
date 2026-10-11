/**
 * Entity & field decorators — define Mosaic entities as TypeScript classes.
 *
 * ```ts
 * import { Entity, Field, Relation } from '@mosaic-apps/mosaic-core';
 *
 * @Entity({ label: 'Customer', softDelete: true })
 * export class Customer {
 *   @Field({ type: 'string', required: true, searchable: true, maxLength: 160 })
 *   name!: string;
 *
 *   @Field({ type: 'enum', options: ['prospect', 'active'] })
 *   status!: string;
 *
 *   @Relation({ entity: () => Employee, required: true })
 *   owner!: string;
 * }
 * ```
 *
 * Decorators work with both modern (standard) decorators — what tsc and esbuild
 * emit by default — and legacy `experimentalDecorators`. Field metadata is kept
 * on the shared per-class decorator metadata object (modern) or on the prototype
 * chain via reflect-metadata (legacy); `extractEntityDef()` reads either.
 */

import 'reflect-metadata';
import {
  type EntityDef,
  type FieldDef,
  type FieldType,
  type FieldUiHints,
  type OnDeleteAction,
  systemFields,
  validateEntity,
} from './types/entity.js';

const ENTITY_META = 'mosaic:entity';
const FIELDS_META = 'mosaic:fields';

/**
 * Decorator signature that type-checks under both decorator proposals:
 * standard decorators pass `(undefined, context)`, legacy
 * (`experimentalDecorators`) pass `(prototype, propertyKey)`.
 */
export type MosaicDecorator = (target: any, context?: any) => void;

/**
 * Node/V8 do not ship `Symbol.metadata` yet, and TypeScript only creates the
 * shared decorator metadata object when it exists. Defining it here (this
 * module is imported before any entity class is evaluated) makes standard
 * decorators work under `tsc` as well as esbuild/tsx.
 */
const METADATA_SYMBOL: symbol = Symbol.for('Symbol.metadata');
if (!(METADATA_SYMBOL in Symbol)) {
  Object.defineProperty(Symbol, 'metadata', {
    value: METADATA_SYMBOL,
    writable: true,
    enumerable: false,
    configurable: true,
  });
}

export function snakeCase(input: string): string {
  return input
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}

export function humanize(input: string): string {
  return input
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
}

export interface EntityOptions extends Omit<EntityDef, 'name' | 'fields' | 'version'> {
  /** Registry / table / API name (lower_snake_case). Defaults to the snake_cased class name. */
  name?: string;
}

export type FieldOptions = Omit<FieldDef, 'name' | 'type'> & {
  /** Defaults to `string` — always set it explicitly for non-strings. */
  type?: FieldType;
};

export interface RelationOptions {
  /** Target entity name, or a thunk returning the target class (resolved after all modules load). */
  entity: string | (() => EntityClass | undefined);
  label?: string;
  required?: boolean;
  indexed?: boolean;
  searchable?: boolean;
  default?: unknown;
  onDelete?: OnDeleteAction;
  ui?: FieldUiHints;
}

type RawField = Omit<FieldDef, 'name' | 'refEntity'> & {
  name: string;
  refEntity?: string | (() => EntityClass | undefined);
};

interface StoredEntity {
  options: EntityOptions;
  /** shared standard-decorator metadata object (undefined in legacy mode) */
  metadata?: Record<string, unknown> | null;
}

interface DecoratorContextLike {
  kind?: string;
  name?: string | symbol;
  metadata?: Record<string, unknown>;
}

function isDecoratorContext(context: unknown): context is DecoratorContextLike {
  return typeof context === 'object' && context !== null;
}

/** Class decorator: marks a class as a Mosaic entity. */
export function Entity(options: EntityOptions = {}): MosaicDecorator {
  const decorator = (target: unknown, context?: unknown): void => {
    if (typeof target !== 'function') throw new Error('@Entity() must decorate a class.');
    const cls = target as EntityClass;
    const standard = isDecoratorContext(context);
    const metadata = standard ? context.metadata : undefined;
    if (standard && (!metadata || typeof metadata !== 'object')) {
      throw new Error(
        `@Entity() on "${cls.name}" could not capture field metadata. ` +
          `Mosaic needs standard decorator metadata: keep @mosaic-apps/mosaic-core up to date, ` +
          `or set "experimentalDecorators": true in tsconfig.json.`,
      );
    }
    const stored: StoredEntity = { options, metadata: metadata ?? null };
    Reflect.defineMetadata(ENTITY_META, stored, cls);
  };
  return decorator;
}

/** Property decorator: marks a property as a persisted field. */
export function Field(options: FieldOptions = {}): MosaicDecorator {
  return fieldDecorator({ ...options } as RawField);
}

/** Property decorator: a `ref` (foreign key) to another entity class. */
export function Relation(options: RelationOptions): MosaicDecorator {
  const { entity, ...rest } = options;
  const raw = {
    ...rest,
    type: 'ref',
    refEntity: entity,
    onDelete: options.onDelete ?? 'restrict',
  } as RawField;
  return fieldDecorator(raw);
}

function fieldDecorator(raw: RawField): MosaicDecorator {
  const decorator = (target: unknown, context?: unknown): void => {
    if (isDecoratorContext(context)) {
      if (typeof context.name !== 'string' && typeof context.name !== 'symbol') {
        throw new Error('@Field() can only decorate named properties.');
      }
      const metadata = context.metadata;
      if (!metadata || typeof metadata !== 'object') {
        throw new Error(
          `Field "${String(context.name)}" has no decorator metadata. ` +
            `Set "experimentalDecorators": true in tsconfig.json, or upgrade @mosaic-apps/mosaic-core.`,
        );
      }
      const fields = ownFields(metadata);
      fields.push({ ...raw, name: String(context.name) });
      return;
    }
    if (typeof context === 'string' || typeof context === 'symbol') {
      pushLegacyField(target as object, { ...raw, name: String(context) });
      return;
    }
    throw new Error('@Field() received an unsupported decorator signature.');
  };
  return decorator;
}

/** Read (copy-on-write) the fields declared in this class' own metadata object. */
function ownFields(metadata: Record<string, unknown>): RawField[] {
  if (Object.prototype.hasOwnProperty.call(metadata, FIELDS_META)) {
    return metadata[FIELDS_META] as RawField[];
  }
  const inherited = (metadata[FIELDS_META] as RawField[] | undefined) ?? [];
  const copy = [...inherited];
  metadata[FIELDS_META] = copy;
  return copy;
}

/** Legacy (`experimentalDecorators`) storage: fields live on the prototype. */
function pushLegacyField(prototype: object, field: RawField): void {
  const own = Reflect.getOwnMetadata(FIELDS_META, prototype) as RawField[] | undefined;
  if (own) {
    own.push(field);
    return;
  }
  const inherited = (Reflect.getMetadata(FIELDS_META, prototype) as RawField[] | undefined) ?? [];
  Reflect.defineMetadata(FIELDS_META, [...inherited, field], prototype);
}

/** Legacy mode: collect fields from the prototype chain (base classes first). */
function collectLegacyFields(entityClass: EntityClass): RawField[] {
  const chain: object[] = [];
  let proto: object | null = entityClass.prototype;
  while (proto && proto !== Object.prototype) {
    chain.push(proto);
    proto = Object.getPrototypeOf(proto);
  }
  chain.reverse();
  const out: RawField[] = [];
  for (const p of chain) {
    const own = Reflect.getOwnMetadata(FIELDS_META, p) as RawField[] | undefined;
    if (own) out.push(...own);
  }
  return out;
}

/** Entity class registry (used by `Relation` thunks and tooling). */
export interface EntityClass extends Function {
  entityName?: string;
  new (...args: any[]): any;
}

const entityRegistry = new Map<string, EntityClass>();

export function registerEntity(entityClass: EntityClass): void {
  const name = entityNameOf(entityClass);
  entityRegistry.set(name, entityClass);
}

export function getEntityClass(name: string): EntityClass | undefined {
  return entityRegistry.get(name);
}

/** The registry/table name of a decorated class. */
export function entityNameOf(entityClass: EntityClass): string {
  const stored = Reflect.getMetadata(ENTITY_META, entityClass) as StoredEntity | undefined;
  return stored?.options.name ?? snakeCase(entityClass.name);
}

function dedupe(fields: RawField[]): RawField[] {
  const byName = new Map<string, RawField>();
  for (const field of fields) byName.set(field.name.toLowerCase(), field);
  return [...byName.values()];
}

function toFieldDef(raw: RawField): FieldDef {
  const { refEntity, ...rest } = raw;
  const type = rest.type ?? 'string';
  const def: FieldDef = {
    ...rest,
    name: raw.name,
    type,
    label: rest.label ?? humanize(raw.name),
  };
  if (type === 'ref') {
    const target = typeof refEntity === 'function' ? refEntity() : refEntity;
    if (!target) {
      throw new Error(`Ref field "${raw.name}" has no target entity.`);
    }
    def.refEntity = typeof target === 'string' ? target : entityNameOf(target);
  }
  return def;
}

/** Extract the `EntityDef` from a decorated class (throws with a readable message). */
export function extractEntityDef(entityClass: EntityClass): EntityDef {
  const stored = Reflect.getMetadata(ENTITY_META, entityClass) as StoredEntity | undefined;
  if (!stored) {
    throw new Error(
      `${entityClass.name} is missing @Entity() — decorate the class with @Entity({ ... }) before using it.`,
    );
  }

  const rawFields = stored.metadata
    ? ((stored.metadata[FIELDS_META] as RawField[] | undefined) ?? [])
    : collectLegacyFields(entityClass);

  const options = stored.options;
  const name = options.name ?? snakeCase(entityClass.name);
  const label = options.label ?? humanize(entityClass.name);
  const labelPlural = options.labelPlural ?? `${label}s`;

  const skeleton: EntityDef = { ...options, name, label, labelPlural, fields: [] };
  const system = new Set(systemFields(skeleton).map((f) => f.name.toLowerCase()));
  const declared = dedupe(rawFields).filter((f) => !system.has(f.name.toLowerCase()));

  const def: EntityDef = { ...skeleton, fields: declared.map(toFieldDef) };

  const errors = validateEntity(def);
  if (errors.length) {
    throw new Error(`Entity "${def.name}" (${entityClass.name}) is invalid:\n  • ${errors.join('\n  • ')}`);
  }
  return def;
}

/** Import one module file, transparently loading TypeScript through tsx. */
let tsxApi: { tsImport: (specifier: string, parentURL: string) => Promise<unknown> } | null | undefined;
const tsxApiModule = 'tsx/esm/api';

async function getTsxApi(): Promise<{ tsImport: (specifier: string, parentURL: string) => Promise<unknown> } | null> {
  if (tsxApi === undefined) {
    const loaded = (await import(/* @vite-ignore */ tsxApiModule).catch(() => null)) as unknown as {
      tsImport: (specifier: string, parentURL: string) => Promise<unknown>;
    } | null;
    tsxApi = loaded;
    return loaded;
  }
  return tsxApi;
}

export async function importEntityModule(fileUrl: string): Promise<Record<string, unknown>> {
  const needsTs = /\.(ts|mts|cts)$/.test(fileUrl);
  if (!needsTs) return (await import(/* @vite-ignore */ fileUrl)) as Record<string, unknown>;
  const api = await getTsxApi();
  if (api) return (await api.tsImport(fileUrl, import.meta.url)) as Record<string, unknown>;
  try {
    return (await import(/* @vite-ignore */ fileUrl)) as Record<string, unknown>;
  } catch {
    throw new Error(
      `Cannot load ${fileUrl}: TypeScript entity files need tsx.\n` +
        `  Install it in the API package: npm i -D tsx`,
    );
  }
}

function entityExports(mod: Record<string, unknown>): EntityClass[] {
  const found: EntityClass[] = [];
  for (const value of Object.values(mod)) {
    if (typeof value === 'function' && Reflect.getMetadata(ENTITY_META, value)) found.push(value as EntityClass);
  }
  return found;
}

const ENTITY_CLASS_FILE = /\.entity\.(ts|mts|js|mjs)$/;
const ENTITY_JSON_FILE = /\.entity\.json$/;

async function listEntityFiles(dir: string): Promise<string[]> {
  try {
    const { readdir } = await import('node:fs/promises');
    return (await readdir(dir)).sort();
  } catch {
    return [];
  }
}

/** Load every `*.entity.{ts,js}` class from a directory (non-recursive). */
export async function loadEntitiesFromDir(dir: string): Promise<EntityClass[]> {
  const { pathToFileURL } = await import('node:url');
  const { join } = await import('node:path');
  const classes: EntityClass[] = [];
  for (const file of (await listEntityFiles(dir)).filter((f) => ENTITY_CLASS_FILE.test(f))) {
    const mod = await importEntityModule(pathToFileURL(join(dir, file)).href);
    classes.push(...entityExports(mod));
  }
  return classes;
}

/** Load `*.entity.json` definitions (the pre-class format). */
export async function loadEntityJsonDefs(dir: string): Promise<EntityDef[]> {
  const { readFile } = await import('node:fs/promises');
  const { join } = await import('node:path');
  const defs: EntityDef[] = [];
  for (const file of (await listEntityFiles(dir)).filter((f) => ENTITY_JSON_FILE.test(f))) {
    const raw = JSON.parse(await readFile(join(dir, file), 'utf8')) as EntityDef;
    const errors = validateEntity(raw);
    if (errors.length) {
      throw new Error(`Entity file "${file}" is invalid:\n  • ${errors.join('\n  • ')}`);
    }
    defs.push(raw);
  }
  return defs;
}

/**
 * Load every entity declared in a directory: `*.entity.json` plus
 * `*.entity.{ts,js}` classes. A class always wins over a JSON file with the
 * same entity name.
 */
export async function loadEntityDefs(dir: string): Promise<EntityDef[]> {
  const byName = new Map<string, { def: EntityDef; owner: string }>();
  const claim = (def: EntityDef, owner: string): void => {
    const existing = byName.get(def.name);
    if (existing) {
      throw new Error(`Duplicate entity "${def.name}" declared by ${existing.owner} and ${owner}.`);
    }
    byName.set(def.name, { def, owner });
  };
  for (const def of await loadEntityJsonDefs(dir)) claim(def, `${def.name}.entity.json`);
  for (const cls of await loadEntitiesFromDir(dir)) {
    const def = extractEntityDef(cls);
    const existing = byName.get(def.name);
    if (existing && !existing.owner.endsWith('.entity.json')) {
      throw new Error(`Duplicate entity "${def.name}" declared by ${existing.owner} and class ${cls.name}.`);
    }
    // a class is the source of truth when both formats declare the same entity
    byName.set(def.name, { def, owner: `class ${cls.name}` });
  }
  return [...byName.values()].map((entry) => entry.def);
}

/** Auto-register all entity classes found in a directory. */
export async function autoRegisterEntities(dir: string): Promise<void> {
  for (const entity of await loadEntitiesFromDir(dir)) registerEntity(entity);
}

