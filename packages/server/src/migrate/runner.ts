/** Plan and apply migrations against PostgreSQL. */

import { newId, type MigrationPlan, type MigrationRecord, type MigrationStatement } from '@mosaic-apps/core';
import type { Db } from '../db/driver.js';
import { introspectTables } from '../db/introspect.js';
import { loadKnownColumns, listEntities, replaceKnownColumns, type RegistryRow } from '../entities/registry.js';
import { checksumStatements, diffEntities, type DiffResult } from './engine.js';

export interface PlanOptions {
  /** limit planning to a single entity */
  only?: string;
}

export async function computePlan(db: Db, opts: PlanOptions = {}): Promise<DiffResult & { entities: RegistryRow[] }> {
  let entities = await listEntities(db);
  if (opts.only) entities = entities.filter((e) => e.name === opts.only);
  const tables = entities.map((e) => e.name);
  const snapshot = await introspectTables(db, tables);
  const knownColumns = await loadKnownColumns(db);
  const result = diffEntities(
    entities.map((e) => e.definition),
    snapshot,
    { knownColumns },
  );
  return { ...result, entities };
}

export interface ApplyResult {
  applied: { entity: string; statements: number; migrationId: string }[];
  skipped: string[];
  warnings: string[];
  plans: MigrationPlan[];
}

export interface ApplyOptions {
  allowDestructive?: boolean;
  only?: string;
}

/** Apply the pending plan in a single transaction; records one migration row per entity. */
export async function applyPlan(db: Db, opts: ApplyOptions = {}): Promise<ApplyResult> {
  const { plans, statements, warnings, columnsAfter, entities } = await computePlan(db, { only: opts.only });
  const allowDestructive = opts.allowDestructive ?? true;

  const applicable: MigrationStatement[] = statements.filter(
    (s) => allowDestructive || s.risk !== 'destructive',
  );
  const skippedDestructive = allowDestructive ? 0 : statements.length - applicable.length;

  const result: ApplyResult = { applied: [], skipped: [], warnings: [...warnings], plans };
  if (skippedDestructive > 0) {
    result.warnings.push(`${skippedDestructive} destructive statement(s) skipped (allowDestructive=false)`);
  }
  if (!applicable.length) {
    for (const p of plans) if (p.empty) result.skipped.push(p.entity);
    return result;
  }

  // per-entity statements (records) restricted to what we actually run
  const byEntity = new Map<string, MigrationStatement[]>();
  for (const s of applicable) {
    const owner = plans.find((p) => p.statements.includes(s))?.entity ?? 'unknown';
    if (!byEntity.has(owner)) byEntity.set(owner, []);
    byEntity.get(owner)!.push(s);
  }

  try {
    await db.tx(async (tx) => {
      for (const s of applicable) await tx.query(s.sql);
      for (const [entity, stmts] of byEntity) {
        const row = entities.find((e) => e.name === entity);
        await tx.query(
          `INSERT INTO mosaic_migrations (id, entity, entity_version, checksum, statements, warnings, status)
           VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, 'applied')`,
          [
            newId('mig'),
            entity,
            row?.version ?? 1,
            checksumStatements(stmts),
            JSON.stringify(stmts),
            JSON.stringify(result.warnings.filter((w) => w.startsWith(entity))),
          ],
        );
      }
      await replaceKnownColumns(tx, columnsAfter);
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    for (const [entity, stmts] of byEntity) {
      try {
        await db.query(
          `INSERT INTO mosaic_migrations (id, entity, entity_version, checksum, statements, warnings, status, error)
           VALUES ($1, $2, $3, $4, $5::jsonb, '[]'::jsonb, 'failed', $6)`,
          [newId('mig'), entity, 0, checksumStatements(stmts), JSON.stringify(stmts), message],
        );
      } catch {
        /* best effort failure record */
      }
    }
    throw new Error(`Migration failed: ${message}`);
  }

  for (const [entity, stmts] of byEntity) {
    result.applied.push({ entity, statements: stmts.length, migrationId: 'mig' });
  }
  return result;
}

export async function migrationHistory(db: Db, limit = 100): Promise<MigrationRecord[]> {
  const res = await db.query<{
    id: string;
    entity: string;
    entity_version: number;
    checksum: string;
    statements: MigrationStatement[];
    status: 'applied' | 'planned' | 'failed';
    error: string | null;
    applied_at: string;
  }>(
    `SELECT id, entity, entity_version, checksum, statements, status, error, applied_at
       FROM mosaic_migrations ORDER BY applied_at DESC LIMIT $1`,
    [limit],
  );
  return res.rows.map((r) => ({
    id: r.id,
    entity: r.entity,
    entityVersion: r.entity_version,
    checksum: r.checksum,
    statements: r.statements,
    status: r.status,
    error: r.error,
    appliedAt: new Date(r.applied_at).toISOString(),
  }));
}

