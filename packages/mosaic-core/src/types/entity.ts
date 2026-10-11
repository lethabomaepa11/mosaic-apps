/** Entity metadata - the single source of truth for tables, CRUD APIs and UIs. */

export type FieldType =
  | 'id'
  | 'string'
  | 'text'
  | 'int'
  | 'decimal'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'enum'
  | 'json'
  | 'ref'
  | 'file';

export type StringFormat = 'email' | 'url' | 'color' | 'password' | 'phone' | 'slug' | 'money';

export type OnDeleteAction = 'cascade' | 'set null' | 'restrict';

export interface EnumOption {
  value: string;
  label?: string;
  color?: string;
}

export interface FieldUiHints {
  /** Preferred form widget; the form renderer may override the default mapping. */
  widget?: string;
  placeholder?: string;
  helpText?: string;
  hidden?: boolean;
  group?: string;
  order?: number;
}

export interface FieldDef {
  /** camelCase identifier; used verbatim as the DB column name (quoted). */
  name: string;
  label?: string;
  type: FieldType;
  description?: string;
  required?: boolean;
  unique?: boolean;
  indexed?: boolean;
  default?: unknown;
  /** enum options */
  options?: EnumOption[] | string[];
  /** string length (default 255) */
  length?: number;
  /** decimal precision/scale (default 16/2 by engine) */
  precision?: number;
  scale?: number;
  format?: StringFormat;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  /** ref target */
  refEntity?: string;
  onDelete?: OnDeleteAction;
  /** include in global `q` search */
  searchable?: boolean;
  /** allow sorting (default true) */
  sortable?: boolean;
  /** allow filtering (default true) */
  filterable?: boolean;
  /** never writable through CRUD (computed / system) */
  readonly?: boolean;
  /** managed by the platform - not user-editable in the designer */
  system?: boolean;
  ui?: FieldUiHints;
}

export type EntityAction = 'read' | 'create' | 'update' | 'delete' | 'export';

/**
 * Role names allowed to perform the action. Empty/undefined => any authenticated
 * user. `['*']` => everyone (even anonymous reads if auth is disabled).
 */
export type EntityPermissions = Partial<Record<EntityAction, string[]>>;

export interface EntityListConfig {
  defaultSort?: string;
  pageSize?: number;
  /** default visible columns in data browser / list views */
  columns?: string[];
  /** name of the field used as row label in pickers */
  labelField?: string;
  searchFields?: string[];
}

export interface EntityDef {
  /** identifier used for table name, API route and registry row */
  name: string;
  label?: string;
  labelPlural?: string;
  description?: string;
  icon?: string;
  fields: FieldDef[];
  /** add deleted_at + hide soft-deleted rows by default */
  softDelete?: boolean;
  /** write change records into mosaic_audit_log (default true) */
  audit?: boolean;
  /** add created_at/updated_at (default true) */
  timestamps?: boolean;
  permissions?: EntityPermissions;
  list?: EntityListConfig;
  /** bumped by the designer whenever the definition changes */
  version?: number;
}

const IDENT = /^[a-z][a-z0-9_]*$/;
const FIELD_IDENT = /^[a-zA-Z][a-zA-Z0-9_]*$/;

export const FIELD_TYPES: FieldType[] = [
  'string', 'text', 'int', 'decimal', 'boolean', 'date', 'datetime', 'enum', 'json', 'ref', 'file', 'id',
];

export const RESERVED_FIELD_NAMES = new Set([
  'id', 'createdat', 'updatedat', 'deletedat', 'version', 'rowid',
]);

export function isValidEntityName(name: string): boolean {
  return IDENT.test(name);
}

export function isValidFieldName(name: string): boolean {
  return FIELD_IDENT.test(name) && !RESERVED_FIELD_NAMES.has(name.toLowerCase());
}

/** Normalise enum options (accepts plain string arrays). */
export function enumOptions(field: FieldDef): EnumOption[] {
  if (!field.options) return [];
  return field.options.map((o) => (typeof o === 'string' ? { value: o } : o));
}

export function entityLabel(entity: EntityDef): string {
  return entity.label ?? entity.name;
}

export function entityLabelPlural(entity: EntityDef): string {
  return entity.labelPlural ?? `${entityLabel(entity)}s`;
}

/** System fields injected by the migration engine (never user defined). */
export function systemFields(entity: EntityDef): FieldDef[] {
  const fields: FieldDef[] = [
    { name: 'id', label: 'ID', type: 'id', system: true, readonly: true, searchable: false },
  ];
  if (entity.timestamps !== false) {
    fields.push(
      { name: 'createdAt', label: 'Created at', type: 'datetime', system: true, readonly: true, searchable: false },
      { name: 'updatedAt', label: 'Updated at', type: 'datetime', system: true, readonly: true, searchable: false },
    );
  }
  if (entity.softDelete) {
    fields.push({ name: 'deletedAt', label: 'Deleted at', type: 'datetime', system: true, readonly: true, searchable: false });
  }
  return fields;
}

export function allFields(entity: EntityDef): FieldDef[] {
  return [...systemFields(entity), ...entity.fields];
}

export function findField(entity: EntityDef, name: string): FieldDef | undefined {
  return allFields(entity).find((f) => f.name === name);
}

/** Validate an entity definition; returns human readable problems (empty = ok). */
export function validateEntity(entity: EntityDef): string[] {
  const errors: string[] = [];
  if (!isValidEntityName(entity.name)) {
    errors.push(`Invalid entity name "${entity.name}" - use lower_snake_case starting with a letter.`);
  }
  if (!Array.isArray(entity.fields) || entity.fields.length === 0) {
    errors.push('Entity must declare at least one field.');
  }
  const seen = new Set<string>();
  for (const field of entity.fields ?? []) {
    if (!FIELD_IDENT.test(field.name)) {
      errors.push(`Invalid field name "${field.name}".`);
      continue;
    }
    const key = field.name.toLowerCase();
    if (seen.has(key)) errors.push(`Duplicate field "${field.name}".`);
    seen.add(key);
    if (RESERVED_FIELD_NAMES.has(key)) errors.push(`Field name "${field.name}" is reserved.`);
    if (!FIELD_TYPES.includes(field.type)) {
      errors.push(`Unknown field type "${String(field.type)}" on "${field.name}".`);
    }
    if (field.type === 'enum' && (!field.options || field.options.length === 0)) {
      errors.push(`Enum field "${field.name}" needs options.`);
    }
    if (field.type === 'ref' && !field.refEntity) {
      errors.push(`Ref field "${field.name}" needs refEntity.`);
    }
  }
  for (const r of (entity.fields ?? []).filter((f) => f.type === 'ref' && f.refEntity)) {
    if (r.refEntity === entity.name) {
      errors.push(`Field "${r.name}" cannot reference its own entity (self refs are not supported yet).`);
    }
  }
  return errors;
}

/** Fields that participate in the global `q` search. */
export function searchableFields(entity: EntityDef): string[] {
  if (entity.list?.searchFields?.length) return entity.list.searchFields;
  return entity.fields
    .filter((f) => f.searchable ?? (f.type === 'string' && f.format !== 'password'))
    .map((f) => f.name);
}
