/** Admin: users & roles management. */

import { Hono } from 'hono';
import type { RoleRecord, UserRecord } from '@mosaic-apps/mosaic-core';
import type { Db } from '../db/driver.js';
import { HttpError, fail, ok, readJson } from './http.js';
import { requirePermission } from './rbac.js';
import { hashPassword } from './auth.js';
import { writeAudit } from './audit.js';
import type { AuthEnv, AuthUser } from './auth.js';

function guard(user: AuthUser | null, perm: string): AuthUser {
  if (!user) throw new HttpError(401, 'Authentication required', 'UNAUTHENTICATED');
  if (!requirePermission(user, perm)) {
    throw new HttpError(403, `Missing permission: ${perm}`, 'FORBIDDEN');
  }
  return user;
}

interface UserRow {
  id: string;
  email: string;
  name: string;
  roles: string[];
  disabled: boolean;
  avatar_color: string | null;
  created_at: string;
  last_login_at: string | null;
}

function toUser(r: UserRow): UserRecord {
  return {
    id: r.id,
    email: r.email,
    name: r.name,
    roles: r.roles ?? [],
    avatarColor: r.avatar_color ?? undefined,
    createdAt: new Date(r.created_at).toISOString(),
    lastLoginAt: r.last_login_at ? new Date(r.last_login_at).toISOString() : undefined,
    disabled: r.disabled,
  };
}

const USER_COLS = 'id, email, name, roles, disabled, avatar_color, created_at, last_login_at';

export function userAdminRoutes(db: Db): Hono<AuthEnv> {
  const app = new Hono<AuthEnv>();

  app.get('/', async (c) => {
    guard(c.get('user'), 'users:manage');
    const res = await db.query<UserRow>(`SELECT ${USER_COLS} FROM mosaic_users ORDER BY created_at`);
    return ok(c, res.rows.map(toUser));
  });

  app.post('/', async (c) => {
    const actor = guard(c.get('user'), 'users:manage');
    const body = await readJson<{ email?: string; password?: string; name?: string; roles?: string[] }>(c);
    const email = String(body.email ?? '').trim().toLowerCase();
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new HttpError(422, 'Valid email required', 'BAD_INPUT');
    if (!body.password || String(body.password).length < 8) {
      throw new HttpError(422, 'Password must be at least 8 characters', 'WEAK_PASSWORD');
    }
    const existing = await db.query('SELECT 1 FROM mosaic_users WHERE lower(email) = $1', [email]);
    if (existing.rows.length) throw new HttpError(409, 'Email already in use', 'EMAIL_TAKEN');
    const roles = Array.isArray(body.roles) ? body.roles.filter((r) => typeof r === 'string') : ['viewer'];
    const res = await db.query<UserRow>(
      `INSERT INTO mosaic_users (email, name, password_hash, roles) VALUES ($1, $2, $3, $4) RETURNING ${USER_COLS}`,
      [email, String(body.name ?? email.split('@')[0]), hashPassword(String(body.password)), roles],
    );
    writeAudit(db, { action: 'create', entity: 'user', recordId: res.rows[0]!.id, user: actor });
    return ok(c, toUser(res.rows[0]!), 201);
  });

  app.put('/:id', async (c) => {
    const actor = guard(c.get('user'), 'users:manage');
    const id = c.req.param('id');
    const body = await readJson<{ name?: string; roles?: string[]; disabled?: boolean; password?: string }>(c);
    const sets: string[] = [];
    const params: unknown[] = [];
    if (body.name !== undefined) {
      params.push(String(body.name));
      sets.push(`name = $${params.length}`);
    }
    if (body.roles !== undefined) {
      params.push(body.roles.filter((r) => typeof r === 'string'));
      sets.push(`roles = $${params.length}`);
    }
    if (body.disabled !== undefined) {
      params.push(Boolean(body.disabled));
      sets.push(`disabled = $${params.length}`);
    }
    if (body.password) {
      if (String(body.password).length < 8) {
        throw new HttpError(422, 'Password must be at least 8 characters', 'WEAK_PASSWORD');
      }
      params.push(hashPassword(String(body.password)));
      sets.push(`password_hash = $${params.length}`);
    }
    if (!sets.length) throw new HttpError(400, 'Nothing to update', 'BAD_INPUT');
    params.push(id);
    const res = await db.query<UserRow>(
      `UPDATE mosaic_users SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING ${USER_COLS}`,
      params,
    );
    const row = res.rows[0];
    if (!row) throw new HttpError(404, 'User not found', 'NOT_FOUND');
    writeAudit(db, { action: 'update', entity: 'user', recordId: id, user: actor });
    return ok(c, toUser(row));
  });

  app.delete('/:id', async (c) => {
    const actor = guard(c.get('user'), 'users:manage');
    const id = c.req.param('id');
    if (actor.id === id) throw new HttpError(400, 'You cannot delete your own account', 'SELF_DELETE');
    const res = await db.query('DELETE FROM mosaic_users WHERE id = $1', [id]);
    if (!res.rowCount) throw new HttpError(404, 'User not found', 'NOT_FOUND');
    writeAudit(db, { action: 'delete', entity: 'user', recordId: id, user: actor });
    return ok(c, { id, deleted: true });
  });

  app.onError((err, c) => {
    if (err instanceof HttpError) return fail(c, err.status, err.message, err.code, err.details);
    console.error('[mosaic] users error:', err);
    return fail(c, 500, 'Internal server error', 'INTERNAL');
  });

  return app;
}

interface RoleRow {
  name: string;
  display_name: string | null;
  description: string | null;
  permissions: string[];
}

export function roleAdminRoutes(db: Db): Hono<AuthEnv> {
  const app = new Hono<AuthEnv>();

  app.get('/', async (c) => {
    if (!c.get('user')) throw new HttpError(401, 'Authentication required', 'UNAUTHENTICATED');
    const res = await db.query<RoleRow>('SELECT name, display_name, description, permissions FROM mosaic_roles ORDER BY name');
    return ok(
      c,
      res.rows.map((r) => ({
        name: r.name,
        displayName: r.display_name,
        description: r.description,
        permissions: r.permissions ?? [],
      })),
    );
  });

  app.put('/:name', async (c) => {
    const actor = guard(c.get('user'), 'roles:manage');
    const name = c.req.param('name');
    const body = await readJson<{ displayName?: string; description?: string; permissions?: string[] }>(c);
    const res = await db.query<{
      name: string;
      display_name: string | null;
      description: string | null;
      permissions: string[];
    }>(
      `INSERT INTO mosaic_roles (name, display_name, description, permissions)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (name) DO UPDATE SET display_name = EXCLUDED.display_name, description = EXCLUDED.description,
         permissions = EXCLUDED.permissions
       RETURNING name, display_name, description, permissions`,
      [name, body.displayName ?? name, body.description ?? null, body.permissions ?? []],
    );
    writeAudit(db, { action: 'update', entity: 'role', recordId: name, user: actor });
    const r = res.rows[0]!;
    return ok(c, { name: r.name, displayName: r.display_name, description: r.description, permissions: r.permissions });
  });

  app.delete('/:name', async (c) => {
    const actor = guard(c.get('user'), 'roles:manage');
    const name = c.req.param('name');
    if (name === 'admin') throw new HttpError(400, 'The admin role cannot be deleted', 'PROTECTED_ROLE');
    const res = await db.query('DELETE FROM mosaic_roles WHERE name = $1', [name]);
    if (!res.rowCount) throw new HttpError(404, 'Role not found', 'NOT_FOUND');
    writeAudit(db, { action: 'delete', entity: 'role', recordId: name, user: actor });
    return ok(c, { name, deleted: true });
  });

  app.onError((err, c) => {
    if (err instanceof HttpError) return fail(c, err.status, err.message, err.code, err.details);
    return fail(c, 500, 'Internal server error', 'INTERNAL');
  });

  return app;
}

