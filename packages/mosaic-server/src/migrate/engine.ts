/**
 * Migration engine: diff entity metadata against an introspected schema and
 * produce an ordered, risk-tagged SQL plan.
 *
 * Phases (across all entities, so cross-table FKs work):
 *   A. CREATE TABLE / ADD COLUMN / ALTER COLUMN
 *   B. DROP constraints / indexes / columns (destructive-capable)
 *   C. ADD constraints / indexes (FKs, uniques, enum checks)
 */

import { createHash } from 'node:crypto';
import { systemFields, type EntityDef, type MigrationPlan, type MigrationStatement } from '@mosaic-apps/mosaic-core';
import type { SchemaSnapshot } from '../db/introspect.js';
import {
  checkName,
  columnDefSql,
  desiredColumns,
  desiredIndexes,
  enumChecks,
  fkName,
  foreignKeys,
  indexName,
  normaliseDefault,
  uniqueConstraints,
  uniqueName,
} from './ddl.js';

export interface DiffOptions {
  /** columns the platform knows about (from mosaic_entity_columns) - only these may be dropped */
  knownColumns?: Map<string, Set<string>>;
}

function q(name: string): string {
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(name)) throw new Error(`Unsafe identifier: ${name}`);
  return `"${name}"`;
}

function stmt(
  kind: MigrationStatement['kind'],
  risk: MigrationStatement['risk'],
  description: string,
  sql: string,
): MigrationStatement {
  return { kind, risk, description, sql };
}

function extractEnumValues(definition: string): string[] {
  return [...definition.matchAll(/'([^']*)'/g)].map((m) => m[1]!);
}

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((v) => set.has(v));
}

interface Phases {
  a: MigrationStatement[];
  b: MigrationStatement[];
  c: MigrationStatement[];
  warnings: string[];
}

/** Diff a single entity against its table (or plan a fresh CREATE TABLE). */
export function diffEntity(entity: EntityDef, table: SchemaSnapshot[string] | undefined, opts: DiffOptions = {}): Phases {
  const phases: Phases = { a: [], b: [], c: [], warnings: [] };
  const table2 = q(entity.name);
  const desired = desiredColumns(entity);
  const desiredByName = new Map(desired.map((d) => [d.name, d]));

  // ---------- A: structure ----------
  if (!table || !table.exists) {
    const lines = desired.map((c) => `    ${columnDefSql(c)}`);
    lines.push(`    CONSTRAINT ${q(`${entity.name}_pkey`)} PRIMARY KEY (${q('id')})`);
    phases.a.push(
      stmt(
        'create-table',
        'safe',
        `Create table ${entity.name}`,
        `CREATE TABLE ${table2} (\n${lines.join(',\n')}\n)`,
      ),
    );
    const missingTargets = foreignKeys(entity)
      .map((f) => f.refTable)
      .filter((t) => t !== entity.name && !tableExistsGuard(table, t));
    if (missingTargets.length) {
      phases.warnings.push(
        `${entity.name}: foreign keys to ${missingTargets.join(', ')} will be added once those tables exist`,
      );
    }
  } else {
    // add columns
    for (const col of desired) {
      if (table.columns[col.name]) continue;
      let sql = `ALTER TABLE ${table2} ADD COLUMN ${q(col.name)} ${col.typeSql}`;
      if (!col.nullable) sql += ' NOT NULL';
      if (col.defaultSql) sql += ` DEFAULT ${col.defaultSql}`;
      phases.a.push(stmt('add-column', 'safe', `Add column ${entity.name}.${col.name}`, sql));
      if (!col.nullable && !col.defaultSql) {
        phases.warnings.push(
          `${entity.name}.${col.name} is NOT NULL without default - migration fails if the table already has rows`,
        );
      }
    }
    // alter existing columns
    for (const col of desired) {
      const actual = table.columns[col.name];
      if (!actual) continue;
      const tableChanged = () => `ALTER TABLE ${table2} ALTER COLUMN ${q(col.name)}`;
      // type
      const typeMismatch =
        actual.dataType !== col.dataType ||
        (col.dataType === 'character varying' && actual.maxLength !== null && actual.maxLength !== Number(/varchar\((\d+)\)/.exec(col.typeSql)?.[1] ?? actual.maxLength)) ||
        (col.dataType === 'numeric' &&
          (actual.precision !== Number(/numeric\((\d+)/.exec(col.typeSql)?.[1] ?? -1) ||
            actual.scale !== Number(/numeric\(\d+,(\d+)/.exec(col.typeSql)?.[1] ?? -1)));
      if (typeMismatch) {
        phases.a.push(
          stmt(
            'alter-column',
            'destructive',
            `Change type of ${entity.name}.${col.name} to ${col.typeSql}`,
            `${tableChanged()} TYPE ${col.typeSql} USING ${q(col.name)}::${col.typeSql}`,
          ),
        );
        phases.warnings.push(`${entity.name}.${col.name}: type conversion may fail on incompatible existing data`);
      }
      // nullability
      if (!col.nullable && actual.nullable) {
        phases.a.push(
          stmt('alter-column', 'destructive', `Set NOT NULL on ${entity.name}.${col.name}`, `${tableChanged()} SET NOT NULL`),
        );
        phases.warnings.push(`${entity.name}.${col.name}: existing NULL rows will fail the NOT NULL constraint`);
      } else if (col.nullable && !actual.nullable) {
        phases.a.push(
          stmt('alter-column', 'safe', `Allow NULL on ${entity.name}.${col.name}`, `${tableChanged()} DROP NOT NULL`),
        );
      }
      // default
      if (normaliseDefault(actual.default) !== normaliseDefault(col.defaultSql)) {
        if (col.defaultSql) {
          phases.a.push(
            stmt(
              'alter-column',
              'safe',
              `Set default of ${entity.name}.${col.name} to ${col.defaultSql}`,
              `${tableChanged()} SET DEFAULT ${col.defaultSql}`,
            ),
          );
        } else {
          phases.a.push(
            stmt('alter-column', 'safe', `Drop default of ${entity.name}.${col.name}`, `${tableChanged()} DROP DEFAULT`),
          );
        }
      }
    }
  }

  // ---------- B: drops (only for columns the platform previously managed) ----------
  if (table?.exists) {
    const known = opts.knownColumns?.get(entity.name);
    for (const colName of Object.keys(table.columns)) {
      if (desiredByName.has(colName)) continue;
      if (known?.has(colName)) {
        phases.b.push(
          stmt(
            'drop-column',
            'destructive',
            `Drop column ${entity.name}.${colName} (removed from entity)`,
            `ALTER TABLE ${table2} DROP COLUMN ${q(colName)}`,
          ),
        );
      } else {
        phases.warnings.push(
          `${entity.name}.${colName}: column exists in DB but not in entity metadata (manually created?) - left untouched`,
        );
      }
    }
    // stale unique constraints (ours by naming convention)
    const desiredUniques = new Set(uniqueConstraints(entity).map((u) => u.name));
    for (const u of table.uniques) {
      if (u.name.startsWith(`${entity.name}_`) && u.name.endsWith('_key') && !desiredUniques.has(u.name)) {
        phases.b.push(
          stmt('drop-constraint', 'safe', `Drop unique constraint ${u.name}`, `ALTER TABLE ${table2} DROP CONSTRAINT ${q(u.name)}`),
        );
      }
    }
    // stale enum checks
    const desiredChecks = new Set(enumChecks(entity).map((c) => c.name));
    for (const c of table.checks) {
      if (c.name.startsWith(`${entity.name}_`) && c.name.endsWith('_enum_check') && !desiredChecks.has(c.name)) {
        phases.b.push(
          stmt('drop-constraint', 'safe', `Drop enum check ${c.name}`, `ALTER TABLE ${table2} DROP CONSTRAINT ${q(c.name)}`),
        );
      }
    }
    // stale FKs
    const desiredFks = new Set(foreignKeys(entity).map((f) => f.name));
    for (const f of table.foreignKeys) {
      if (f.name.startsWith(`${entity.name}_`) && f.name.endsWith('_fkey') && !desiredFks.has(f.name)) {
        phases.b.push(
          stmt('drop-constraint', 'safe', `Drop foreign key ${f.name}`, `ALTER TABLE ${table2} DROP CONSTRAINT ${q(f.name)}`),
        );
      }
    }
    // stale indexes
    const desiredIdx = new Set(desiredIndexes(entity).map((i) => i.name));
    for (const i of table.indexes) {
      if (i.name.startsWith(`${entity.name}_`) && i.name.endsWith('_idx') && !desiredIdx.has(i.name)) {
        phases.b.push(stmt('drop-index', 'safe', `Drop index ${i.name}`, `DROP INDEX ${q(i.name)}`));
      }
    }
  }

  // ---------- C: add constraints / indexes (always planned - new tables included) ----------
  {
    const existingUniques = new Map((table?.uniques ?? []).map((u) => [u.name, u]));
    for (const u of uniqueConstraints(entity)) {
      const existing = existingUniques.get(u.name);
      const addSql = `ALTER TABLE ${table2} ADD CONSTRAINT ${q(u.name)} UNIQUE (${q(u.column)})`;
      if (!existing) {
        phases.c.push(stmt('add-constraint', 'safe', `Add unique on ${entity.name}.${u.column}`, addSql));
      } else if (!sameSet(existing.columns, [u.column])) {
        phases.b.push(
          stmt('drop-constraint', 'safe', `Rebuild unique ${u.name}`, `ALTER TABLE ${table2} DROP CONSTRAINT ${q(u.name)}`),
        );
        phases.c.push(stmt('add-constraint', 'safe', `Add unique on ${entity.name}.${u.column}`, addSql));
      }
    }
    const existingChecks = new Map((table?.checks ?? []).map((c) => [c.name, c]));
    for (const c of enumChecks(entity)) {
      const existing = existingChecks.get(c.name);
      const addSql = `ALTER TABLE ${table2} ADD CONSTRAINT ${q(c.name)} ${c.definition}`;
      if (!existing) {
        phases.c.push(stmt('add-constraint', 'safe', `Add enum check on ${entity.name}.${c.column}`, addSql));
      } else {
        const actualValues = extractEnumValues(existing.definition ?? '');
        const desiredValues = enumOptionValues(entity, c.column);
        if (!sameSet(actualValues, desiredValues)) {
          phases.b.push(
            stmt('drop-constraint', 'safe', `Refresh enum check ${c.name}`, `ALTER TABLE ${table2} DROP CONSTRAINT ${q(c.name)}`),
          );
          phases.c.push(stmt('add-constraint', 'safe', `Update enum options on ${entity.name}.${c.column}`, addSql));
        }
      }
    }
    const existingFks = new Map((table?.foreignKeys ?? []).map((f) => [f.name, f]));
    for (const f of foreignKeys(entity)) {
      const existing = existingFks.get(f.name);
      const addSql =
        `ALTER TABLE ${table2} ADD CONSTRAINT ${q(f.name)} FOREIGN KEY (${q(f.column)}) ` +
        `REFERENCES ${q(f.refTable)} (${q('id')}) ON DELETE ${f.onDelete.toUpperCase()}`;
      if (!existing) {
        phases.c.push(stmt('add-constraint', 'safe', `Add foreign key ${f.name}`, addSql));
      } else if (existing.refTable !== f.refTable || (existing.onDelete ?? 'no action') !== f.onDelete) {
        phases.b.push(
          stmt('drop-constraint', 'safe', `Refresh foreign key ${f.name}`, `ALTER TABLE ${table2} DROP CONSTRAINT ${q(f.name)}`),
        );
        phases.c.push(stmt('add-constraint', 'safe', `Re-add foreign key ${f.name}`, addSql));
      }
    }
    const existingIdx = new Map((table?.indexes ?? []).map((i) => [i.name, i]));
    for (const i of desiredIndexes(entity)) {
      if (!existingIdx.has(i.name)) {
        phases.c.push(
          stmt('create-index', 'safe', `Create index ${i.name}`, `CREATE INDEX ${q(i.name)} ON ${table2} (${q(i.column)})`),
        );
      }
    }
  }

  return phases;
}

function tableExistsGuard(_single: SchemaSnapshot[string] | undefined, _t: string): boolean {
  // diffEntity only sees one table; cross-table existence is handled in diffEntities
  return false;
}

function enumOptionValues(entity: EntityDef, column: string): string[] {
  const field = entity.fields.find((f) => f.name === column);
  if (!field?.options) return [];
  return field.options.map((o) => (typeof o === 'string' ? o : o.value));
}

export interface DiffResult {
  /** per-entity migration plans in apply order */
  plans: MigrationPlan[];
  /** flat statement list A -> B -> C for the whole run */
  statements: MigrationStatement[];
  warnings: string[];
  /** columns each entity should have after apply (for the known-columns registry) */
  columnsAfter: Map<string, string[]>;
}

/** Diff all entities against the snapshot. */
export function diffEntities(entities: EntityDef[], snapshot: SchemaSnapshot, opts: DiffOptions = {}): DiffResult {
  const perEntity: { entity: EntityDef; phases: Phases }[] = [];
  const warnings: string[] = [];
  const columnsAfter = new Map<string, string[]>();
  const afterNames = new Set([
    ...entities.map((e) => e.name),
    ...Object.values(snapshot)
      .filter((t) => t.exists)
      .map((t) => t.name),
  ]);

  for (const entity of entities) {
    const phases = diffEntity(entity, snapshot[entity.name], opts);
    for (const fk of foreignKeys(entity)) {
      if (!afterNames.has(fk.refTable)) {
        phases.warnings.push(`${entity.name}.${fk.column}: target entity "${fk.refTable}" does not exist - FK skipped`);
        // remove the planned add so the run does not fail
        const marker = `CONSTRAINT "${fk.name}"`;
        for (let i = phases.c.length - 1; i >= 0; i--) {
          if (phases.c[i]!.sql.includes(marker)) phases.c.splice(i, 1);
        }
      }
    }
    perEntity.push({ entity, phases });
    warnings.push(...phases.warnings);
    columnsAfter.set(entity.name, desiredColumns(entity).map((c) => c.name));
  }

  const statements: MigrationStatement[] = [];
  for (const phase of ['a', 'b', 'c'] as const) {
    for (const { phases } of perEntity) statements.push(...phases[phase]);
  }

  const plans: MigrationPlan[] = perEntity.map(({ entity, phases }) => {
    const own = [...phases.a, ...phases.b, ...phases.c];
    return { entity: entity.name, statements: own, warnings: phases.warnings, empty: own.length === 0 };
  });

  return { plans, statements, warnings, columnsAfter };
}

/** Stable checksum for a statement list (dedupe re-runs). */
export function checksumStatements(statements: MigrationStatement[]): string {
  return createHash('sha256')
    .update(statements.map((s) => s.sql).join('\n'))
    .digest('hex')
    .slice(0, 20);
}

