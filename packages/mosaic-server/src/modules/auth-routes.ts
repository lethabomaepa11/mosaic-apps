/** /api/auth routes: login, register (bootstrap-safe), me, logout, change-password. */

import { Hono } from 'hono';
import type { LoginResponse, UserRecord } from '@mosaic/core';
import type { Db } from '../db/driver.js';
import { HttpError, fail, ok, readJson } from './http.js';
import {
  hashPassword,
  loadAuthUser,
  signJwt,
  verifyPassword,
  type AuthDeps,
  type AuthEnv,
  type AuthUser,
} from './auth.js';
import { isAdmin } from './rbac.js';
import { writeAudit } from './audit.js';

export interface AuthRoutesDeps extends AuthDeps {
  db: Db;
  tokenTtl: number;
  allowRegistration: boolean;
}

interface UserRow {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  roles: string[];
  disabled: boolean;
  avatar_color: string | null;
  created_at: string;
  last_login_at: string | null;
}

function toUserRecord(row: UserRow): UserRecord {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    roles: row.roles ?? [],
    avatarColor: row.avatar_color ?? undefined,
    createdAt: new Date(row.created_at).toISOString(),
    lastLoginAt: row.last_login_at ? new Date(row.last_login_at).toISOString() : undefined,
    disabled: row.disabled,
  };
}

function requireUser(user: AuthUser | null): AuthUser {
  if (!user) throw new HttpError(401, 'Authentication required', 'UNAUTHENTICATED');
  return user;
}

export function authRoutes(deps: AuthRoutesDeps): Hono<AuthEnv> {
  const app = new Hono<AuthEnv>();

  app.post('/login', async (c) => {
    const body = await readJson<{ email?: string; password?: string }>(c);
    const email = String(body.email ?? '').trim().toLowerCase();
    const password = String(body.password ?? '');
    if (!email || !password) return fail(c, 400, 'email and password are required', 'BAD_INPUT');
    const res = await deps.db.query<UserRow>('SELECT * FROM mosaic_users WHERE lower(email) = $1', [email]);
    const row = res.rows[0];
    if (!row || !verifyPassword(password, row.password_hash)) {
      return fail(c, 401, 'Invalid email or password', 'INVALID_CREDENTIALS');
    }
    if (row.disabled) return fail(c, 403, 'This account is disabled', 'ACCOUNT_DISABLED');
    await deps.db.query('UPDATE mosaic_users SET last_login_at = now() WHERE id = $1', [row.id]);
    const user = await loadAuthUser(deps, row.id);
    if (!user) return fail(c, 401, 'Invalid email or password', 'INVALID_CREDENTIALS');
    const token = signJwt({ sub: row.id, email: row.email, roles: row.roles ?? [] }, deps.secret, deps.tokenTtl);
    writeAudit(deps.db, { action: 'login', user, ip: c.req.header('x-forwarded-for') ?? null });
    const response: LoginResponse = { token, user: toUserRecord(row), expiresIn: deps.tokenTtl };
    return ok(c, response);
  });

  app.post('/register', async (c) => {
    const body = await readJson<{ email?: string; password?: string; name?: string }>(c);
    const email = String(body.email ?? '').trim().toLowerCase();
    const password = String(body.password ?? '');
    const name = String(body.name ?? '').trim();
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail(c, 400, 'Valid email is required', 'BAD_INPUT');
    if (password.length < 8) return fail(c, 400, 'Password must be at least 8 characters', 'WEAK_PASSWORD');
    const countRes = await deps.db.query<{ n: number }>('SELECT count(*)::int AS n FROM mosaic_users');
    const isFirstUser = (countRes.rows[0]?.n ?? 0) === 0;
    if (!isFirstUser && !deps.allowRegistration) {
      return fail(c, 403, 'Registration is disabled', 'REGISTRATION_DISABLED');
    }
    const existing = await deps.db.query('SELECT 1 FROM mosaic_users WHERE lower(email) = $1', [email]);
    if (existing.rows.length) return fail(c, 409, 'An account with this email already exists', 'EMAIL_TAKEN');
    const roles = isFirstUser ? ['admin'] : ['viewer'];
    const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
    const avatar = colors[Math.floor(Math.random() * colors.length)]!;
    const insert = await deps.db.query<UserRow>(
      `INSERT INTO mosaic_users (email, name, password_hash, roles, avatar_color)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [email, name || email.split('@')[0], hashPassword(password), roles, avatar],
    );
    const row = insert.rows[0]!;
    const user = await loadAuthUser(deps, row.id);
    const token = signJwt({ sub: row.id, email: row.email, roles: row.roles ?? [] }, deps.secret, deps.tokenTtl);
    writeAudit(deps.db, {
      action: 'create',
      entity: 'user',
      recordId: row.id,
      user,
      ip: c.req.header('x-forwarded-for') ?? null,
    });
    const response: LoginResponse = { token, user: toUserRecord(row), expiresIn: deps.tokenTtl };
    return ok(c, response, 201);
  });

  app.get('/me', (c) => {
    const user = requireUser(c.get('user'));
    return ok(c, { ...user, isAdmin: isAdmin(user) });
  });

  app.post('/logout', (c) => {
    const user = c.get('user');
    if (user) writeAudit(deps.db, { action: 'logout', user, ip: c.req.header('x-forwarded-for') ?? null });
    return ok(c, { ok: true });
  });

  app.post('/change-password', async (c) => {
    const user = requireUser(c.get('user'));
    const body = await readJson<{ currentPassword?: string; newPassword?: string }>(c);
    const current = String(body.currentPassword ?? '');
    const next = String(body.newPassword ?? '');
    if (next.length < 8) return fail(c, 400, 'New password must be at least 8 characters', 'WEAK_PASSWORD');
    const res = await deps.db.query<{ password_hash: string }>('SELECT password_hash FROM mosaic_users WHERE id = $1', [
      user.id,
    ]);
    const row = res.rows[0];
    if (!row || !verifyPassword(current, row.password_hash)) {
      return fail(c, 403, 'Current password is incorrect', 'BAD_PASSWORD');
    }
    await deps.db.query('UPDATE mosaic_users SET password_hash = $1 WHERE id = $2', [hashPassword(next), user.id]);
    writeAudit(deps.db, { action: 'update', entity: 'user', recordId: user.id, user });
    return ok(c, { ok: true });
  });

  return app;
}
