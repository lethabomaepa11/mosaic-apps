/** Desired DDL fragments derived from entity metadata. */

import { enumOptions, systemFields, type EntityDef, type FieldDef } from '@mosaic-apps/mosaic-core';
import { ident } from '../db/driver.js';

export interface DesiredColumn {
  name: string;
  /** full column type SQL, e.g. `varchar(120)` */
  typeSql: string;
  /** normalised data type for comparison against information_schema */
  dataType: string;
  nullable: boolean;
  /** SQL default expression (already quoted) or null */
  defaultSql: string | null;
}

export function uniqueName(table: string, col: string): string {
  return `${table}_${col}_key`;
}
export function checkName(table: string, col: string): string {
  return `${table}_${col}_enum_check`;
}
export function fkName(table: string, col: string): string {
  return `${table}_${col}_fkey`;
}
export function indexName(table: string, col: string): string {
  return `${table}_${col}_idx`;
}

export function quoteLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/** SQL default literal for a metadata default value. */
export function defaultLiteral(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : null;
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'string') return quoteLiteral(value);
  return quoteLiteral(JSON.stringify(value));
}

export function columnForField(field: FieldDef): DesiredColumn {
  const nullable = !field.required;
  const def = field.default !== undefined ? defaultLiteral(field.default) : null;
  switch (field.type) {
    case 'id':
      return { name: field.name, typeSql: 'uuid', dataType: 'uuid', nullable: false, defaultSql: 'gen_random_uuid()' };
    case 'string':
      return { name: field.name, typeSql: `varchar(${field.length ?? 255})`, dataType: 'character varying', nullable, defaultSql: def };
    case 'text':
      return { name: field.name, typeSql: 'text', dataType: 'text', nullable, defaultSql: def };
    case 'int':
      return { name: field.name, typeSql: 'integer', dataType: 'integer', nullable, defaultSql: def };
    case 'decimal':
      return {
        name: field.name,
        typeSql: `numeric(${field.precision ?? 16},${field.scale ?? 2})`,
        dataType: 'numeric',
        nullable,
        defaultSql: def,
      };
    case 'boolean':
      return { name: field.name, typeSql: 'boolean', dataType: 'boolean', nullable, defaultSql: def };
    case 'date':
      return { name: field.name, typeSql: 'date', dataType: 'date', nullable, defaultSql: def };
    case 'datetime':
      return { name: field.name, typeSql: 'timestamptz', dataType: 'timestamp with time zone', nullable, defaultSql: def };
    case 'enum':
      return { name: field.name, typeSql: 'text', dataType: 'text', nullable, defaultSql: def };
    case 'json':
      return { name: field.name, typeSql: 'jsonb', dataType: 'jsonb', nullable, defaultSql: def };
    case 'ref':
      return { name: field.name, typeSql: 'uuid', dataType: 'uuid', nullable, defaultSql: def };
    case 'file':
      return { name: field.name, typeSql: 'text', dataType: 'text', nullable, defaultSql: def };
    default:
      throw new Error(`Unsupported field type: ${String((field as FieldDef).type)}`);
  }
}

/**
 * All desired columns for an entity: system columns first.
 */
export function desiredColumns(entity: EntityDef): DesiredColumn[] {
  const cols: DesiredColumn[] = [];
  for (const sys of systemFields(entity)) cols.push(columnForField(sys));
  for (const f of entity.fields) cols.push(columnForField(f));
  for (const c of cols) {
    if (c.name === 'createdAt' || c.name === 'updatedAt') {
      c.nullable = false;
      c.defaultSql = 'now()';
    }
    if (c.name === 'deletedAt') {
      c.nullable = true;
      c.defaultSql = null;
    }
  }
  return cols;
}

export function columnDefSql(col: DesiredColumn): string {
  let sql = `${ident(col.name)} ${col.typeSql}`;
  if (!col.nullable) sql += ' NOT NULL';
  if (col.defaultSql) sql += ` DEFAULT ${col.defaultSql}`;
  return sql;
}

/** Enum check constraints (named) for all enum fields. */
export function enumChecks(entity: EntityDef): { column: string; name: string; definition: string }[] {
  return entity.fields
    .filter((f) => f.type === 'enum')
    .map((f) => {
      const values = enumOptions(f).map((o) => o.value);
      return {
        column: f.name,
        name: checkName(entity.name, f.name),
        definition: `CHECK (${ident(f.name)} IN (${values.map(quoteLiteral).join(', ')}))`,
      };
    });
}

/** Unique constraints for fields flagged unique. */
export function uniqueConstraints(entity: EntityDef): { column: string; name: string }[] {
  return entity.fields.filter((f) => f.unique).map((f) => ({ column: f.name, name: uniqueName(entity.name, f.name) }));
}

export interface DesiredForeignKey {
  column: string;
  name: string;
  refTable: string;
  onDelete: 'cascade' | 'set null' | 'restrict';
}

export function foreignKeys(entity: EntityDef): DesiredForeignKey[] {
  return entity.fields
    .filter((f) => f.type === 'ref' && f.refEntity)
    .map((f) => ({
      column: f.name,
      name: fkName(entity.name, f.name),
      refTable: f.refEntity!,
      onDelete: f.onDelete ?? 'restrict',
    }));
}

export function desiredIndexes(entity: EntityDef): { column: string; name: string }[] {
  return entity.fields.filter((f) => f.indexed).map((f) => ({ column: f.name, name: indexName(entity.name, f.name) }));
}

/** Normalise default expressions for comparison (`'x'::text` vs `'x'`). */
export function normaliseDefault(sql: string | null): string {
  if (!sql) return '';
  return sql
    .replace(/::[a-z ]+(\[\])?/gi, '')
    .replace(/[()]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

