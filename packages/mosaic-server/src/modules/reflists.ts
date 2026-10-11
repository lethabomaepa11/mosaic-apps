/** Reference lists (lookups) - Shesha-style controlled vocabularies. */

import { Hono } from 'hono';
import { newId, slugify, type RefList } from '@mosaic-apps/mosaic-core';
import type { Db } from '../db/driver.js';
import { HttpError, fail, ok, readJson } from './http.js';
import { requirePermission } from './rbac.js';
import { writeAudit } from './audit.js';
import type { AuthEnv, AuthUser } from './auth.js';

interface RefRow {
  id: string;
  name: string;
  label: string | null;
  items: RefList['items'];
  created_at: string;
  updated_at: string;
}

function toRefList(r: RefRow): RefList {
  return {
    id: r.id,
    name: r.name,
    label: r.label ?? undefined,
    items: r.items ?? [],
    createdAt: new Date(r.created_at).toISOString(),
    updatedAt: new Date(r.updated_at).toISOString(),
  };
}

function guardManage(user: AuthUser | null): AuthUser {
  if (!user) throw new HttpError(401, 'Authentication required', 'UNAUTHENTICATED');
  if (!requirePermission(user, 'settings:manage')) {
    throw new HttpError(403, 'Missing permission: settings:manage', 'FORBIDDEN');
  }
  return user;
}

export function refListRoutes(db: Db): Hono<AuthEnv> {
  const app = new Hono<AuthEnv>();

  app.get('/', async (c) => {
    if (!c.get('user')) throw new HttpError(401, 'Authentication required', 'UNAUTHENTICATED');
    const res = await db.query<RefRow>('SELECT * FROM mosaic_ref_lists ORDER BY name');
    return ok(c, res.rows.map(toRefList));
  });

  app.get('/:name', async (c) => {
    if (!c.get('user')) throw new HttpError(401, 'Authentication required', 'UNAUTHENTICATED');
    const res = await db.query<RefRow>('SELECT * FROM mosaic_ref_lists WHERE name = $1', [c.req.param('name')]);
    const row = res.rows[0];
    if (!row) throw new HttpError(404, 'Reference list not found', 'NOT_FOUND');
    return ok(c, toRefList(row));
  });

  app.post('/', async (c) => {
    const user = guardManage(c.get('user'));
    const body = await readJson<{ name?: string; label?: string; items?: RefList['items'] }>(c);
    const name = slugify(String(body.name ?? body.label ?? 'list'));
    const res = await db.query<RefRow>(
      'INSERT INTO mosaic_ref_lists (id, name, label, items) VALUES ($1, $2, $3, $4::jsonb) RETURNING *',
      [newId('rl'), name, body.label ?? null, JSON.stringify(body.items ?? [])],
    );
    writeAudit(db, { action: 'create', entity: 'refList', recordId: name, user });
    return ok(c, toRefList(res.rows[0]!), 201);
  });

  app.put('/:name', async (c) => {
    const user = guardManage(c.get('user'));
    const body = await readJson<{ label?: string; items?: RefList['items'] }>(c);
    const res = await db.query<RefRow>(
      `UPDATE mosaic_ref_lists SET label = COALESCE($2, label), items = COALESCE($3::jsonb, items), updated_at = now()
       WHERE name = $1 RETURNING *`,
      [c.req.param('name'), body.label ?? null, body.items !== undefined ? JSON.stringify(body.items) : null],
    );
    const row = res.rows[0];
    if (!row) throw new HttpError(404, 'Reference list not found', 'NOT_FOUND');
    writeAudit(db, { action: 'update', entity: 'refList', recordId: row.name, user });
    return ok(c, toRefList(row));
  });

  app.delete('/:name', async (c) => {
    const user = guardManage(c.get('user'));
    const res = await db.query('DELETE FROM mosaic_ref_lists WHERE name = $1', [c.req.param('name')]);
    if (!res.rowCount) throw new HttpError(404, 'Reference list not found', 'NOT_FOUND');
    writeAudit(db, { action: 'delete', entity: 'refList', recordId: c.req.param('name'), user });
    return ok(c, { name: c.req.param('name'), deleted: true });
  });

  app.onError((err, c) => {
    if (err instanceof HttpError) return fail(c, err.status, err.message, err.code, err.details);
    console.error('[mosaic] reflists error:', err);
    return fail(c, 500, 'Internal server error', 'INTERNAL');
  });

  return app;
}


