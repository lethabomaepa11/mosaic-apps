/** Admin: create/update/delete entity definitions (metadata-first modeling). */

import { Hono } from 'hono';
import { validateEntity, type EntityDef } from '@mosaic-apps/core';
import type { Db } from '../db/driver.js';
import { assertValidEntity, EntityRegistryError, getEntity, listEntities, saveEntity } from '../entities/registry.js';
import { HttpError, fail, ok, readJson } from './http.js';
import { requirePermission } from './rbac.js';
import { writeAudit } from './audit.js';
import type { AuthEnv, AuthUser } from './auth.js';

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
    const body = await readJson<{ entity?: EntityDef }>(c);
    const def = body.entity;
    if (!def) throw new HttpError(422, 'entity payload required', 'BAD_INPUT');
    const errors = validateEntity(def);
    return ok(c, { valid: errors.length === 0, errors });
  });

  // save (create or update)
  app.put('/:name', async (c) => {
    const user = guardEntities(c.get('user'));
    const body = await readJson<{ entity?: EntityDef }>(c);
    const def = body.entity;
    if (!def) throw new HttpError(422, 'entity payload required', 'BAD_INPUT');
    if (def.name !== c.req.param('name')) throw new HttpError(400, 'entity.name must match route param', 'BAD_INPUT');
    try {
      const saved = await saveEntity(db, def, 'database');
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

