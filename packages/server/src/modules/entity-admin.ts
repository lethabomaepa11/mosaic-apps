/** Admin: create/update/delete entity definitions (metadata-first modeling). */

import { Hono } from 'hono';
import { diffArtifactSnapshots, validateEntity, type EntityDef } from '@mosaic-apps/core';
import type { Db } from '../db/driver.js';
import { assertValidEntity, EntityRegistryError, getEntity, listEntities, saveEntity } from '../entities/registry.js';
import { HttpError, fail, ok, readJson } from './http.js';
import { requirePermission } from './rbac.js';
import { writeAudit } from './audit.js';
import type { AuthEnv, AuthUser } from './auth.js';
import { getPreviousRevision, getRevision, listRevisions, recordRevision } from './revisions.js';

function guardEntities(user: AuthUser | null): AuthUser {
  if (!user) throw new HttpError(401, 'Authentication required', 'UNAUTHENTICATED');
  if (!requirePermission(user, 'entities:manage')) {
    throw new HttpError(403, 'Missing permission: entities:manage', 'FORBIDDEN');
  }
  return user;
}

export function entityAdminRoutes(db: Db, onChange?: () => Promise<void> | void): Hono<AuthEnv> {
  const app = new Hono<AuthEnv>();

  // validate without saving
  app.post('/validate', async (c) => {
    if (!c.get('user')) throw new HttpError(401, 'Authentication required', 'UNAUTHENTICATED');
    const body = await readJson<{ entity?: EntityDef; message?: string; origin?: string }>(c);
    const def = body.entity;
    if (!def) throw new HttpError(422, 'entity payload required', 'BAD_INPUT');
    const errors = validateEntity(def);
    return ok(c, { valid: errors.length === 0, errors });
  });

  // save (create or update)
  app.put('/:name', async (c) => {
    const user = guardEntities(c.get('user'));
    const body = await readJson<{ entity?: EntityDef; message?: string; origin?: string }>(c);
    const def = body.entity;
    if (!def) throw new HttpError(422, 'entity payload required', 'BAD_INPUT');
    if (def.name !== c.req.param('name')) throw new HttpError(400, 'entity.name must match route param', 'BAD_INPUT');
    try {
      const previous = await getEntity(db, def.name);
      const saved = await saveEntity(db, def, 'database');
      if (!previous || previous.version !== saved.version) {
        await recordRevision(db, {
          kind: 'entity',
          artifactId: saved.name,
          revision: saved.version,
          snapshot: saved.definition,
          message: body.message ?? `Save entity ${saved.name}`,
          origin: body.origin === 'ai' || body.origin === 'cli' || body.origin === 'import' ? body.origin : 'studio',
          author: user,
        });
      }
      await onChange?.();
      writeAudit(db, { action: 'create', entity: 'entityDef', recordId: def.name, user });
      return ok(c, saved);
    } catch (err) {
      if (err instanceof EntityRegistryError) {
        return fail(c, 422, err.message, 'INVALID_ENTITY', err.details);
      }
      throw err;
    }
  });

  app.get('/:name/revisions', async (c) => {
    if (!c.get('user')) throw new HttpError(401, 'Authentication required', 'UNAUTHENTICATED');
    const entity = await getEntity(db, c.req.param('name'));
    if (!entity) throw new HttpError(404, 'Entity not found', 'NOT_FOUND');
    return ok(c, await listRevisions(db, 'entity', entity.name));
  });

  app.get('/:name/revisions/:revision', async (c) => {
    if (!c.get('user')) throw new HttpError(401, 'Authentication required', 'UNAUTHENTICATED');
    const entity = await getEntity(db, c.req.param('name'));
    if (!entity) throw new HttpError(404, 'Entity not found', 'NOT_FOUND');
    const revision = Number(c.req.param('revision'));
    if (!Number.isInteger(revision) || revision < 1) throw new HttpError(422, 'Invalid revision', 'BAD_INPUT');
    const found = await getRevision(db, 'entity', entity.name, revision);
    if (!found) throw new HttpError(404, 'Revision not found', 'NOT_FOUND');
    return ok(c, found);
  });

  app.get('/:name/revisions/:revision/diff', async (c) => {
    if (!c.get('user')) throw new HttpError(401, 'Authentication required', 'UNAUTHENTICATED');
    const entity = await getEntity(db, c.req.param('name'));
    if (!entity) throw new HttpError(404, 'Entity not found', 'NOT_FOUND');
    const revision = Number(c.req.param('revision'));
    if (!Number.isInteger(revision) || revision < 1) throw new HttpError(422, 'Invalid revision', 'BAD_INPUT');
    const found = await getRevision(db, 'entity', entity.name, revision);
    if (!found) throw new HttpError(404, 'Revision not found', 'NOT_FOUND');
    if (c.req.query('against') === 'current') {
      return ok(c, { revision, against: 'current', changes: diffArtifactSnapshots(entity.definition, found.snapshot) });
    }
    const previous = await getPreviousRevision(db, 'entity', entity.name, revision);
    return ok(c, {
      revision,
      against: previous?.revision ?? 'empty',
      changes: diffArtifactSnapshots(previous?.snapshot ?? {}, found.snapshot),
    });
  });

  // delete definition (keeps the physical table - operator decides via migrations)
  app.delete('/:name', async (c) => {
    const user = guardEntities(c.get('user'));
    const name = c.req.param('name');
    const existing = await getEntity(db, name);
    if (!existing) throw new HttpError(404, 'Entity not found', 'NOT_FOUND');
    await db.query('DELETE FROM mosaic_entities WHERE name = $1', [name]);
    await db.query('DELETE FROM mosaic_entity_columns WHERE entity_name = $1', [name]);
    await onChange?.();
    writeAudit(db, { action: 'delete', entity: 'entityDef', recordId: name, user });
    return ok(c, { name, deleted: true, note: 'Physical table was NOT dropped' });
  });

  // convenience: full registry (same as GET /api/entities but stricter perm for editing context)
  app.get('/', async (c) => {
    if (!c.get('user')) throw new HttpError(401, 'Authentication required', 'UNAUTHENTICATED');
    return ok(c, await listEntities(db));
  });

  app.onError((err, c) => {
    if (err instanceof HttpError) return fail(c, err.status, err.message, err.code, err.details);
    if (err instanceof EntityRegistryError) return fail(c, 422, err.message, 'INVALID_ENTITY', err.details);
    console.error('[mosaic] entity admin error:', err);
    return fail(c, 500, 'Internal server error', 'INTERNAL');
  });

  return app;
}

void assertValidEntity;

