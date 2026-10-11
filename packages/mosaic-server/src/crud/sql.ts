/** Translate a QuerySpec into safe parameterised SQL (validated against entity metadata). */

import { allFields, searchableFields, type EntityDef, type FieldDef, type QuerySpec } from '@mosaic-apps/mosaic-core';
import { ident } from '../db/driver.js';

export class QueryError extends Error {
  constructor(
    message: string,
    public code = 'BAD_QUERY',
  ) {
    super(message);
    this.name = 'QueryError';
  }
}

export interface BuildOptions {
  includeDeleted?: boolean;
  resolveEntity?: (name: string) => EntityDef | undefined;
}

function fieldMap(entity: EntityDef): Map<string, FieldDef> {
  return new Map(allFields(entity).map((f) => [f.name, f]));
}

function castFor(field: FieldDef, value: unknown): { param: unknown; cast: string } {
  switch (field.type) {
    case 'int':
      return { param: Number(value), cast: '::int' };
    case 'decimal':
      return { param: Number(value), cast: '::numeric' };
    case 'boolean': {
      const b = typeof value === 'string' ? value === 'true' || value === '1' : Boolean(value);
      return { param: b, cast: '::boolean' };
    }
    case 'date':
      return { param: String(value), cast: '::date' };
    case 'datetime':
      return { param: String(value), cast: '::timestamptz' };
    case 'ref':
    case 'id':
      return { param: String(value), cast: '::uuid' };
    case 'json':
      return { param: typeof value === 'string' ? value : JSON.stringify(value), cast: '::jsonb' };
    default:
      return { param: String(value), cast: '' };
  }
}

function assertNumber(value: unknown, field: FieldDef, op: string): number {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    throw new QueryError(`Filter ${op} on ${field.name} needs a number, got ${JSON.stringify(value)}`);
  }
  return n;
}

function escapeLike(raw: string): string {
  return raw.replace(/[\\%_]/g, (m) => `\\${m}`);
}

/** Stateful WHERE accumulator: `?` marks become sequential `$n` placeholders. */
export class WhereBuilder {
  readonly params: unknown[] = [];
  readonly parts: string[] = [];
  private i: number;

  constructor(startIdx = 1) {
    this.i = startIdx;
  }

  private render(sql: string, values: unknown[]): string {
    const rendered = sql.replace(/\?/g, () => `$${this.i++}`);
    this.params.push(...values);
    return rendered;
  }

  /** One condition with its values (in order of `?`). */
  add(sql: string, values: unknown[] = []): void {
    this.parts.push(this.render(sql, values));
  }

  /** OR-group of N conditions, each carrying exactly one value, same order. */
  addOrGroup(conditions: string[], values: unknown[]): void {
    if (!conditions.length) return;
    const rendered = conditions.map((c, idx) => this.render(c, [values[idx]]));
    this.parts.push(`(${rendered.join(' OR ')})`);
  }

  get clause(): string {
    return this.parts.length ? `WHERE ${this.parts.join(' AND ')}` : '';
  }
}

export function buildWhere(
  entity: EntityDef,
  spec: QuerySpec,
  opts: BuildOptions,
  startIdx = 1,
): { clause: string; params: unknown[] } {
  const fields = fieldMap(entity);
  const w = new WhereBuilder(startIdx);

  if (entity.softDelete && !opts.includeDeleted) {
    w.add(`${ident('t')}.${ident('deletedAt')} IS NULL`);
  }

  for (const filter of spec.filters) {
    const field = fields.get(filter.field);
    if (!field) throw new QueryError(`Unknown filter field "${filter.field}"`);
    if (field.filterable === false) throw new QueryError(`Field "${filter.field}" is not filterable`);
    const col = `${ident('t')}.${ident(field.name)}`;
    switch (filter.op) {
      case 'isNull':
        w.add(`${col} IS NULL`);
        break;
      case 'notNull':
        w.add(`${col} IS NOT NULL`);
        break;
      case 'eq':
      case 'ne': {
        const { param, cast } = castFor(field, filter.value);
        if (param === null || param === undefined) {
          w.add(`${col} IS ${filter.op === 'eq' ? '' : 'NOT '}NULL`);
        } else {
          w.add(`${col} ${filter.op === 'eq' ? '=' : '<>'} ?${cast}`, [param]);
        }
        break;
      }
      case 'gt':
      case 'gte':
      case 'lt':
      case 'lte': {
        const opSql = { gt: '>', gte: '>=', lt: '<', lte: '<=' }[filter.op];
        const value =
          field.type === 'int' || field.type === 'decimal' ? assertNumber(filter.value, field, filter.op) : filter.value;
        const { param, cast } = castFor(field, value);
        w.add(`${col} ${opSql} ?${cast}`, [param]);
        break;
      }
      case 'contains':
      case 'notContains':
      case 'startsWith':
      case 'endsWith': {
        const escaped = escapeLike(String(filter.value ?? ''));
        const pattern =
          filter.op === 'startsWith' ? `${escaped}%` : filter.op === 'endsWith' ? `%${escaped}` : `%${escaped}%`;
        const negate = filter.op === 'notContains' ? ' NOT' : '';
        w.add(`${col}${negate} ILIKE ?`, [pattern]);
        break;
      }
      case 'in':
      case 'nin': {
        const values = (filter.values ?? (filter.value !== undefined ? [filter.value] : [])).filter(
          (v) => v !== null && v !== undefined && v !== '',
        );
        if (!values.length) {
          w.add(filter.op === 'in' ? 'FALSE' : 'TRUE');
          break;
        }
        const { cast } = castFor(field, values[0]!);
        const placeholders = values.map(() => `?${cast}`).join(', ');
        w.add(
          `${col}${filter.op === 'nin' ? ' NOT' : ''} IN (${placeholders})`,
          values.map((v) => castFor(field, v).param),
        );
        break;
      }
      case 'between': {
        const values = filter.values ?? [];
        if (values.length !== 2) throw new QueryError(`between on ${field.name} needs exactly 2 values`);
        const a = castFor(field, values[0]);
        const b = castFor(field, values[1]);
        w.add(`${col} BETWEEN ?${a.cast} AND ?${b.cast}`, [a.param, b.param]);
        break;
      }
    }
  }

  if (spec.q) {
    const cols = searchableFields(entity);
    if (cols.length) {
      const like = `%${escapeLike(spec.q)}%`;
      w.addOrGroup(
        cols.map((c) => `${ident('t')}.${ident(c)}::text ILIKE ?`),
        cols.map(() => like),
      );
    }
  }

  return { clause: w.clause, params: w.params };
}

export interface ListSql {
  sql: string;
  countSql: string;
  params: unknown[];
}

/** SELECT list with optional joins for `include`d ref fields. */
export function buildListSql(entity: EntityDef, spec: QuerySpec, opts: BuildOptions): ListSql {
  const fields = fieldMap(entity);
  const table = ident(entity.name);

  // columns
  let selectCols = `${ident('t')}.*`;
  if (spec.select?.length) {
    const cols = spec.select.filter((s) => fields.has(s));
    if (cols.length) selectCols = cols.map((c) => `${ident('t')}.${ident(c)}`).join(', ');
  }

  // joins for included refs
  const joins: string[] = [];
  const include = (spec.include ?? []).filter((name) => fields.get(name)?.type === 'ref');
  include.forEach((name, idx) => {
    const field = fields.get(name)!;
    const alias = `j${idx}`;
    const refEntity = opts.resolveEntity?.(field.refEntity ?? '');
    if (!refEntity) return;
    joins.push(`LEFT JOIN ${ident(refEntity.name)} ${alias} ON ${ident('t')}.${ident(name)} = ${alias}.${ident('id')}`);
    const labelField =
      refEntity.list?.labelField ??
      refEntity.fields.find((f) => f.name === 'name')?.name ??
      refEntity.fields.find((f) => f.name === 'label')?.name ??
      refEntity.fields.find((f) => f.type === 'string')?.name;
    if (labelField) selectCols += `, ${alias}.${ident(labelField)} AS ${ident(`${name}_label`)}`;
  });

  const where = buildWhere(entity, spec, opts, 1);

  // order by
  const orderParts: string[] = [];
  for (const s of spec.sort) {
    const field = fields.get(s.field);
    if (!field) throw new QueryError(`Unknown sort field "${s.field}"`);
    if (field.sortable === false) throw new QueryError(`Field "${s.field}" is not sortable`);
    orderParts.push(`${ident('t')}.${ident(s.field)} ${s.dir === 'desc' ? 'DESC' : 'ASC'}`);
  }
  if (!orderParts.length) {
    const hasUpdatedAt = fields.has('updatedAt');
    if (hasUpdatedAt) orderParts.push(`${ident('t')}."updatedAt" DESC`);
    orderParts.push(`${ident('t')}."id" ASC`);
  }

  const offset = (spec.page - 1) * spec.pageSize;
  const sql =
    `SELECT ${selectCols} FROM ${table} ${ident('t')} ${joins.join(' ')} ${where.clause} ` +
    `ORDER BY ${orderParts.join(', ')} LIMIT $${where.params.length + 1} OFFSET $${where.params.length + 2}`;
  const countSql = `SELECT count(*)::int AS total FROM ${table} ${ident('t')} ${where.clause}`;
  return { sql, countSql, params: [...where.params, spec.pageSize, offset] };
}

/** Params for the count query (list params minus LIMIT/OFFSET). */
export function countParams(params: unknown[]): unknown[] {
  return params.slice(0, -2);
}

function writableFields(entity: EntityDef): FieldDef[] {
  return entity.fields.filter((f) => !f.readonly && !f.system);
}

/** INSERT statement from validated payload. */
export function buildInsertSql(entity: EntityDef, data: Record<string, unknown>): { sql: string; params: unknown[] } {
  const allowed = new Set(writableFields(entity).map((f) => f.name));
  const cols = Object.keys(data).filter((k) => allowed.has(k));
  const table = ident(entity.name);
  if (!cols.length) {
    return { sql: `INSERT INTO ${table} DEFAULT VALUES RETURNING *`, params: [] };
  }
  const params: unknown[] = [];
  const placeholders = cols.map((c) => {
    params.push(data[c]);
    return `$${params.length}`;
  });
  const sql =
    `INSERT INTO ${table} (${cols.map(ident).join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`;
  return { sql, params };
}

/** UPDATE statement from validated payload (always bumps updatedAt). */
export function buildUpdateSql(
  entity: EntityDef,
  id: string,
  data: Record<string, unknown>,
): { sql: string; params: unknown[] } {
  const allowed = new Set(writableFields(entity).map((f) => f.name));
  const cols = Object.keys(data).filter((k) => allowed.has(k) && data[k] !== undefined);
  const table = ident(entity.name);
  const params: unknown[] = [];
  const sets: string[] = [];
  for (const c of cols) {
    params.push(data[c]);
    sets.push(`${ident(c)} = $${params.length}`);
  }
  sets.push(`${ident('updatedAt')} = now()`);
  params.push(id);
  const sql = `UPDATE ${table} SET ${sets.join(', ')} WHERE ${ident('id')} = $${params.length} RETURNING *`;
  return { sql, params };
}

/** Options list for pickers: `[{value, label}]` from label field. */
export function buildOptionsSql(
  entity: EntityDef,
  opts: { q?: string; limit?: number; includeDeleted?: boolean } = {},
): { sql: string; params: unknown[] } {
  const table = ident(entity.name);
  const labelField =
    entity.list?.labelField ??
    entity.fields.find((f) => f.name === 'name')?.name ??
    entity.fields.find((f) => f.type === 'string')?.name ??
    'id';
  const params: unknown[] = [];
  const where: string[] = [];
  if (entity.softDelete && !opts.includeDeleted) where.push(`${ident('t')}."deletedAt" IS NULL`);
  if (opts.q) {
    params.push(`%${escapeLike(opts.q)}%`);
    where.push(`(${ident('t')}.${ident(labelField)}::text ILIKE $${params.length} OR ${ident('t')}."id"::text ILIKE $${params.length})`);
  }
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 500);
  params.push(limit);
  const sql =
    `SELECT ${ident('t')}."id" AS value, ${ident('t')}.${ident(labelField)} AS label ` +
    `FROM ${table} ${ident('t')} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ` +
    `ORDER BY ${ident('t')}.${ident(labelField)} ASC LIMIT $${params.length}`;
  return { sql, params };
}

