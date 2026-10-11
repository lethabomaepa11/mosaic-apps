/** Common cross-cutting types shared by server, studio and runtime apps. */

export type FilterOp =
  | 'eq'
  | 'ne'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'contains'
  | 'notContains'
  | 'startsWith'
  | 'endsWith'
  | 'in'
  | 'nin'
  | 'isNull'
  | 'notNull'
  | 'between';

export const FILTER_OPS: FilterOp[] = [
  'eq', 'ne', 'gt', 'gte', 'lt', 'lte',
  'contains', 'notContains', 'startsWith', 'endsWith',
  'in', 'nin', 'isNull', 'notNull', 'between',
];

export interface Filter {
  field: string;
  op: FilterOp;
  value?: unknown;
  values?: unknown[];
}

export interface SortSpec {
  field: string;
  dir: 'asc' | 'desc';
}

/** Normalised query coming from `parseQuery()` or built programmatically. */
export interface QuerySpec {
  page: number;
  pageSize: number;
  sort: SortSpec[];
  filters: Filter[];
  q?: string;
  select?: string[];
  include?: string[];
}

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 200;

export function emptyQuery(): QuerySpec {
  return { page: 1, pageSize: DEFAULT_PAGE_SIZE, sort: [], filters: [] };
}

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export type ApiOk<T> = { success: true; data: T };
export type ApiErr = { success: false; error: { message: string; code?: string; details?: unknown } };
export type ApiResponse<T> = ApiOk<T> | ApiErr;
