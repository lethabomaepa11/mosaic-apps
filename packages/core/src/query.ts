/** Parse HTTP query strings into a validated QuerySpec (and back). */

import {
  DEFAULT_PAGE_SIZE,
  FILTER_OPS,
  MAX_PAGE_SIZE,
  type Filter,
  type FilterOp,
  type QuerySpec,
  type SortSpec,
} from './types/common.js';

export type RawQuery = Record<string, string | string[] | undefined>;

export interface ParseQueryOptions {
  defaultSort?: string;
  maxPageSize?: number;
}

const FIELD_RE = /^[A-Za-z][A-Za-z0-9_.]*$/;

function first(raw: RawQuery, key: string): string | undefined {
  const v = raw[key];
  if (Array.isArray(v)) return v[0];
  return v;
}

function toList(v: string | undefined): string[] | undefined {
  if (!v) return undefined;
  const parts = v.split(',').map((s) => s.trim()).filter(Boolean);
  return parts.length ? parts : undefined;
}

function parseSort(value: string | undefined): SortSpec[] {
  if (!value) return [];
  const out: SortSpec[] = [];
  for (const part of value.split(',')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('-')) out.push({ field: trimmed.slice(1), dir: 'desc' });
    else out.push({ field: trimmed, dir: 'asc' });
  }
  return out.filter((s) => FIELD_RE.test(s.field));
}

function makeFilter(field: string, op: string, rawValues?: string[]): Filter | null {
  if (!FIELD_RE.test(field)) return null;
  const normalisedOp = op as FilterOp;
  if (!FILTER_OPS.includes(normalisedOp)) {
    // allow bare `field:value` => eq
    if (!op) return null;
    return null;
  }
  if (normalisedOp === 'isNull' || normalisedOp === 'notNull') return { field, op: normalisedOp };
  if (normalisedOp === 'in' || normalisedOp === 'nin' || normalisedOp === 'between') {
    const values = (rawValues ?? []).flatMap((v) => v.split(',')).map((v) => v.trim()).filter((v) => v !== '');
    if (!values.length) return null;
    return { field, op: normalisedOp, values };
  }
  const value = rawValues?.join(':');
  if (value === undefined) return null;
  return { field, op: normalisedOp, value };
}

function parseWhereList(values: string[]): Filter[] {
  const out: Filter[] = [];
  for (const where of values) {
    // field:op:value... (op optional -> eq)
    const segments = where.split(':');
    const field = segments[0] ?? '';
    const maybeOp = segments[1];
    if (maybeOp && FILTER_OPS.includes(maybeOp as FilterOp)) {
      const f = makeFilter(field, maybeOp, segments.slice(2));
      if (f) out.push(f);
    } else if (segments.length > 2) {
      // `field:weirdop:value` - likely a typo'd operator; drop rather than guess
      continue;
    } else {
      const f = makeFilter(field, 'eq', segments.slice(1));
      if (f) out.push(f);
    }
  }
  return out;
}

function parseFilterParam(value: string): Filter[] {
  try {
    const parsed: unknown = JSON.parse(value);
    const arr = Array.isArray(parsed) ? parsed : [parsed];
    const out: Filter[] = [];
    for (const item of arr) {
      if (!item || typeof item !== 'object') continue;
      const rec = item as Record<string, unknown>;
      const field = String(rec.field ?? '');
      const op = String(rec.op ?? 'eq') as FilterOp;
      if (!FIELD_RE.test(field) || !FILTER_OPS.includes(op)) continue;
      if (op === 'isNull' || op === 'notNull') out.push({ field, op });
      else if (op === 'in' || op === 'nin' || op === 'between') {
        const values = (Array.isArray(rec.values) ? rec.values : [rec.value]).filter((v) => v !== undefined);
        out.push({ field, op, values: values as unknown[] });
      } else out.push({ field, op, value: rec.value });
    }
    return out;
  } catch {
    return [];
  }
}

function multi(raw: RawQuery, key: string): string[] {
  const v = raw[key];
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

export function parseQuery(raw: RawQuery, opts: ParseQueryOptions = {}): QuerySpec {
  const maxPageSize = opts.maxPageSize ?? MAX_PAGE_SIZE;
  const rawPage = Number.parseInt(first(raw, 'page') ?? '', 10);
  const page = Number.isNaN(rawPage) ? 1 : Math.max(1, rawPage);
  const rawSize = Number.parseInt(first(raw, 'pageSize') ?? '', 10);
  const requested = Number.isNaN(rawSize) ? DEFAULT_PAGE_SIZE : rawSize;
  const pageSize = Math.max(1, Math.min(requested, maxPageSize));

  const filters: Filter[] = [];
  const filterParam = first(raw, 'filter');
  if (filterParam && filterParam.trim().startsWith('[') || filterParam?.trim().startsWith('{')) {
    filters.push(...parseFilterParam(filterParam));
  }
  filters.push(...parseWhereList(multi(raw, 'where')));
  // repeatable `filter` params that are not JSON are treated as `where`
  for (const v of multi(raw, 'filter')) {
    if (!v.trim().startsWith('[') && !v.trim().startsWith('{')) filters.push(...parseWhereList([v]));
  }

  const spec: QuerySpec = {
    page,
    pageSize,
    sort: parseSort(first(raw, 'sort') ?? opts.defaultSort),
    filters,
  };
  const q = first(raw, 'q')?.trim();
  if (q) spec.q = q;
  const select = toList(first(raw, 'select'));
  if (select) spec.select = select.filter((s) => FIELD_RE.test(s));
  const include = toList(first(raw, 'include'));
  if (include) spec.include = include.filter((s) => FIELD_RE.test(s));
  return spec;
}

/** Serialise a QuerySpec back into URL search params (client side helper). */
export function buildQueryString(spec: Partial<QuerySpec>): string {
  const params = new URLSearchParams();
  if (spec.page && spec.page > 1) params.set('page', String(spec.page));
  if (spec.pageSize && spec.pageSize !== DEFAULT_PAGE_SIZE) params.set('pageSize', String(spec.pageSize));
  if (spec.sort?.length) {
    params.set('sort', spec.sort.map((s) => (s.dir === 'desc' ? `-${s.field}` : s.field)).join(','));
  }
  if (spec.q) params.set('q', spec.q);
  if (spec.filters?.length) params.set('filter', JSON.stringify(spec.filters));
  if (spec.select?.length) params.set('select', spec.select.join(','));
  if (spec.include?.length) params.set('include', spec.include.join(','));
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}
