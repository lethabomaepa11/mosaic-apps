/** Entity registry: metadata rows in mosaic_entities + optional filesystem sync. */

import 'reflect-metadata';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { newId, validateEntity, type EntityDef, extractEntityDef } from '@mosaic/core';
import type { Db } from '../db/driver.js';
import { RESERVED_ENTITY_NAMES } from '../platform.js';

export interface RegistryRow {
  name: string;
  definition: EntityDef;
  version: number;
  source: 'file' | 'database';
  updatedAt: string;
}

export class EntityRegistryError extends Error {
  constructor(
    message: string,
    public details?: string[],
  ) {
    super(message);
    this.name = 'EntityRegistryError';
  }
}

export async function listEntities(db: Db): Promise<RegistryRow[]> {
  const res = await db.query<{
    name: string;
    definition: EntityDef;
    version: number;
    source: 'file' | 'database';
    updated_at: string;
  }>('SELECT name, definition, version, source, updated_at FROM mosaic_entities ORDER BY name');
  return res.rows.map((r) => ({
    name: r.name,
    definition: r.definition,
    version: r.version,
    source: r.source,
    updatedAt: new Date(r.updated_at).toISOString(),
  }));
}

export async function getEntity(db: Db, name: string): Promise<RegistryRow | undefined> {
  const res = await db.query<{ definition: EntityDef; version: number; source: 'file' | 'database'; updated_at: string }>(
    'SELECT definition, version, source, updated_at FROM mosaic_entities WHERE name = $1',
    [name],
  );
  const row = res.rows[0];
  if (!row) return undefined;
  return {
    name,
    definition: row.definition,
    version: row.version,
    source: row.source,
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export function assertValidEntity(def: EntityDef): void {
  if (RESERVED_ENTITY_NAMES.has(def.name)) {
    throw new EntityRegistryError(`Entity name "${def.name}" is reserved by the platform`);
  }
  const errors = validateEntity(def);
  if (errors.length) throw new EntityRegistryError(`Entity "${def.name}" is invalid`, errors);
}

/** Insert or update an entity definition; bumps version when the definition changes. */
export async function saveEntity(db: Db, def: EntityDef, source: 'file' | 'database' = 'database'): Promise<RegistryRow> {
  assertValidEntity(def);
  const current = await getEntity(db, def.name);
  const changed = !current || JSON.stringify(stripVersion(current.definition)) !== JSON.stringify(stripVersion(def));
  const version = current ? (changed ? current.version + 1 : current.version) : 1;
  const definition: EntityDef = { ...def, version };
  await db.query(
    `INSERT INTO mosaic_entities (name, definition, version, source, updated_at)
     VALUES ($1, $2::jsonb, $3, $4, now())
     ON CONFLICT (name) DO UPDATE
       SET definition = EXCLUDED.definition,
           version = EXCLUDED.version,
           source = EXCLUDED.source,
           updated_at = now()`,
    [def.name, JSON.stringify(definition), version, source],
  );
  return { name: def.name, definition, version, source, updatedAt: new Date().toISOString() };
}

function stripVersion(def: EntityDef): EntityDef {
  const { version: _version, ...rest } = def;
  return rest as EntityDef;
}

export async function deleteEntity(db: Db, name: string): Promise<boolean> {
  const res = await db.query('DELETE FROM mosaic_entities WHERE name = $1', [name]);
  await db.query('DELETE FROM mosaic_entity_columns WHERE entity_name = $1', [name]);
  return (res.rowCount ?? 0) > 0;
}

/** Sync `*.entity.ts` files into the registry (class wins when changed). */
export async function syncEntitiesDir(db: Db, dir: string): Promise<RegistryRow[]> {
  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    return [];
  }
  const saved: RegistryRow[] = [];
  for (const file of files.filter((f) => f.endsWith('.entity.ts'))) {
    const mod = await import(join(dir, file));
    for (const exp of Object.values(mod)) {
      if (typeof exp === 'function' && Reflect.getMetadata('mosaic:entity', exp)) {
        const def = extractEntityDef(exp);
        saved.push(await saveEntity(db, def, 'file'));
      }
    }
  }
  return saved;
}

/** What columns the platform has applied for an entity (guards destructive drops). */
export async function loadKnownColumns(db: Db): Promise<Map<string, Set<string>>> {
  const res = await db.query<{ entity_name: string; column_name: string }>(
    'SELECT entity_name, column_name FROM mosaic_entity_columns',
  );
  const map = new Map<string, Set<string>>();
  for (const row of res.rows) {
    if (!map.has(row.entity_name)) map.set(row.entity_name, new Set());
    map.get(row.entity_name)!.add(row.column_name);
  }
  return map;
}

export async function replaceKnownColumns(db: Db, columnsByEntity: Map<string, string[]>): Promise<void> {
  for (const [entity, columns] of columnsByEntity) {
    await db.query('DELETE FROM mosaic_entity_columns WHERE entity_name = $1', [entity]);
    for (const col of columns) {
      await db.query('INSERT INTO mosaic_entity_columns (entity_name, column_name) VALUES ($1, $2) ON CONFLICT DO NOTHING', [
        entity,
        col,
      ]);
    }
  }
}

export { newId };
