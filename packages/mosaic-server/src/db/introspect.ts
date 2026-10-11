/** Read table structure from PostgreSQL into a SchemaSnapshot the diff engine understands. */

import type { Db } from './driver.js';

export interface ColumnInfo {
  name: string;
  /** full data type, e.g. `character varying`, `numeric`, `timestamp with time zone` */
  dataType: string;
  udtName: string;
  nullable: boolean;
  default: string | null;
  maxLength: number | null;
  precision: number | null;
  scale: number | null;
}

export interface ConstraintInfo {
  name: string;
  columns: string[];
  /** raw definition for checks (pg_get_constraintdef) */
  definition?: string;
  /** for FKs */
  refTable?: string;
  refColumns?: string[];
  onDelete?: 'cascade' | 'set null' | 'restrict' | 'no action';
}

export interface TableInfo {
  name: string;
  exists: boolean;
  columns: Record<string, ColumnInfo>;
  primaryKey: string[];
  uniques: ConstraintInfo[];
  foreignKeys: ConstraintInfo[];
  checks: ConstraintInfo[];
  indexes: { name: string; columns: string[]; unique: boolean }[];
}

export type SchemaSnapshot = Record<string, TableInfo>;

export function emptyTable(name: string): TableInfo {
  return {
    name,
    exists: false,
    columns: {},
    primaryKey: [],
    uniques: [],
    foreignKeys: [],
    checks: [],
    indexes: [],
  };
}

const ON_DELETE_MAP: Record<string, 'cascade' | 'set null' | 'restrict' | 'no action'> = {
  a: 'cascade',
  n: 'set null',
  r: 'restrict',
  d: 'no action',
};

export async function introspectTables(db: Db, tables: string[]): Promise<SchemaSnapshot> {
  const snapshot: SchemaSnapshot = {};
  for (const t of tables) snapshot[t] = emptyTable(t);
  if (!tables.length) return snapshot;

  const placeholders = tables.map((_, i) => `$${i + 1}`).join(', ');

  const cols = await db.query<{
    table_name: string;
    column_name: string;
    data_type: string;
    udt_name: string;
    is_nullable: 'YES' | 'NO';
    column_default: string | null;
    character_maximum_length: number | null;
    numeric_precision: number | null;
    numeric_scale: number | null;
  }>(
    `SELECT table_name, column_name, data_type, udt_name, is_nullable, column_default,
            character_maximum_length, numeric_precision, numeric_scale
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name IN (${placeholders})`,
    tables,
  );
  for (const row of cols.rows) {
    const table = snapshot[row.table_name];
    if (!table) continue;
    table.exists = true;
    table.columns[row.column_name] = {
      name: row.column_name,
      dataType: row.data_type,
      udtName: row.udt_name,
      nullable: row.is_nullable === 'YES',
      default: row.column_default,
      maxLength: row.character_maximum_length,
      precision: row.numeric_precision,
      scale: row.numeric_scale,
    };
  }

  const pk = await db.query<{ table_name: string; column_name: string; ordinal_position: number }>(
    `SELECT tc.table_name, kcu.column_name, kcu.ordinal_position
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
      WHERE tc.table_schema = 'public' AND tc.constraint_type = 'PRIMARY KEY'
        AND tc.table_name IN (${placeholders})
      ORDER BY kcu.ordinal_position`,
    tables,
  );
  for (const row of pk.rows) snapshot[row.table_name]?.primaryKey.push(row.column_name);

  const uniq = await db.query<{ table_name: string; constraint_name: string; column_name: string }>(
    `SELECT tc.table_name, tc.constraint_name, kcu.column_name
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
      WHERE tc.table_schema = 'public' AND tc.constraint_type = 'UNIQUE'
        AND tc.table_name IN (${placeholders})
      ORDER BY tc.constraint_name, kcu.ordinal_position`,
    tables,
  );
  for (const row of uniq.rows) {
    const table = snapshot[row.table_name];
    if (!table) continue;
    let c = table.uniques.find((u) => u.name === row.constraint_name);
    if (!c) {
      c = { name: row.constraint_name, columns: [] };
      table.uniques.push(c);
    }
    c.columns.push(row.column_name);
  }

  const checks = await db.query<{ table_name: string; constraint_name: string; definition: string }>(
    `SELECT c.conrelid::regclass::text AS table_name, c.conname AS constraint_name,
            pg_get_constraintdef(c.oid) AS definition
       FROM pg_constraint c
       JOIN pg_namespace n ON n.oid = c.connamespace
      WHERE n.nspname = 'public' AND c.contype = 'c'`,
  );
  for (const row of checks.rows) {
    // regclass::text quotes reserved words (e.g. "order") - normalise
    const tname = row.table_name.replace(/^public\./, '').replace(/^"|"$/g, '');
    const table = snapshot[tname];
    if (!table) continue;
    table.checks.push({ name: row.constraint_name, columns: [], definition: row.definition });
  }

  const fks = await db.query<{
    table_name: string;
    constraint_name: string;
    columns: string;
    foreign_table: string;
    foreign_columns: string;
    confdeltype: string;
  }>(
    `SELECT tc.table_name, tc.constraint_name,
            string_agg(kcu.column_name, ',' ORDER BY kcu.ordinal_position) AS columns,
            MIN(ccu.table_name) AS foreign_table,
            string_agg(ccu.column_name, ',' ORDER BY kcu.ordinal_position) AS foreign_columns,
            MIN(c.confdeltype::text) AS confdeltype
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
       JOIN information_schema.constraint_column_usage ccu
         ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
       JOIN pg_constraint c ON c.conname = tc.constraint_name AND c.connamespace = 'public'::regnamespace
      WHERE tc.table_schema = 'public' AND tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name IN (${placeholders})
      GROUP BY tc.table_name, tc.constraint_name`,
    tables,
  );
  for (const row of fks.rows) {
    const tname = row.table_name.replace(/^public\./, '').replace(/^"|"$/g, '');
    const table = snapshot[tname];
    if (!table) continue;
    table.foreignKeys.push({
      name: row.constraint_name,
      columns: row.columns.split(','),
      refTable: row.foreign_table,
      refColumns: row.foreign_columns.split(','),
      onDelete: ON_DELETE_MAP[row.confdeltype] ?? 'no action',
    });
  }

  const idx = await db.query<{ table_name: string; indexname: string; indexdef: string }>(
    `SELECT tablename AS table_name, indexname, indexdef FROM pg_indexes
      WHERE schemaname = 'public' AND tablename IN (${placeholders})`,
    tables,
  );
  for (const row of idx.rows) {
    const table = snapshot[row.table_name];
    if (!table) continue;
    // constraint backing indexes are tracked with their constraints
    if (row.indexname.endsWith('_pkey') || row.indexname.endsWith('_key') || row.indexname.endsWith('_check')) continue;
    const colMatch = /\(([^)]+)\)/.exec(row.indexdef);
    const cols = colMatch
      ? colMatch[1]!.split(',').map((c) => c.trim().replace(/"/g, '').split(' ')[0]!)
      : [];
    table.indexes.push({ name: row.indexname, columns: cols, unique: /CREATE UNIQUE INDEX/i.test(row.indexdef) });
  }

  return snapshot;
}
