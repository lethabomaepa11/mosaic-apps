/** Authentication: scrypt password hashing + HS256 JWT, both from node:crypto. */

import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { MiddlewareHandler } from 'hono';
import type { Db } from '../db/driver.js';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  roles: string[];
  /** merged permissions from all roles */
  permissions: string[];
}

export type AuthEnv = { Variables: { user: AuthUser | null } };

// ---------- password hashing ----------

const SCRYPT_KEYLEN = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN);
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  try {
    const salt = Buffer.from(parts[1]!, 'base64');
    const expected = Buffer.from(parts[2]!, 'base64');
    const actual = scryptSync(password, salt, expected.length);
    return timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

// ---------- JWT (HS256) ----------

export interface JwtPayload {
  sub: string;
  email: string;
  roles: string[];
  iat: number;
  exp: number;
  jti: string;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

export function signJwt(payload: Omit<JwtPayload, 'iat' | 'exp' | 'jti'>, secret: string, ttlSeconds: number): string {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(
    JSON.stringify({ ...payload, iat: now, exp: now + ttlSeconds, jti: randomBytes(8).toString('hex') }),
  );
  const sig = createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

export function verifyJwt(token: string, secret: string): JwtPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts as [string, string, string];
  const expected = createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as JwtPayload;
    if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) return null;
    if (payload.sub !== undefined && typeof payload.sub !== 'string') return null;
    return payload;
  } catch {
    return null;
  }
}

// ---------- middleware ----------

export interface AuthDeps {
  db: Db;
  secret: string;
  enabled: boolean;
}

/** Resolve `Authorization: Bearer` into `c.set('user', ...)` (or null). Never rejects. */
export function resolveUser(deps: AuthDeps): MiddlewareHandler<AuthEnv> {
  return async (c, next) => {
    c.set('user', null);
    if (!deps.enabled) {
      await next();
      return;
    }
    const header = c.req.header('authorization') ?? '';
    const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
    if (!token) {
      await next();
      return;
    }
    const payload = verifyJwt(token, deps.secret);
    if (!payload) {
      await next();
      return;
    }
    const user = await loadAuthUser(deps, payload.sub);
    if (user) c.set('user', user);
    await next();
  };
}

export async function loadAuthUser(deps: AuthDeps, userId: string): Promise<AuthUser | null> {
  const res = await deps.db.query<{
    id: string;
    email: string;
    name: string;
    disabled: boolean;
    roles: string[] | null;
  }>('SELECT id, email, name, disabled, roles FROM mosaic_users WHERE id = $1', [userId]);
  const row = res.rows[0];
  if (!row || row.disabled) return null;
  const roles = row.roles ?? [];
  const permissions = await loadRolePermissions(deps, roles);
  return { id: row.id, email: row.email, name: row.name, roles, permissions };
}

export async function loadRolePermissions(deps: AuthDeps, roles: string[]): Promise<string[]> {
  if (!roles.length) return [];
  const res = await deps.db.query<{ permissions: string[] }>(
    'SELECT permissions FROM mosaic_roles WHERE name = ANY($1::text[])',
    [roles],
  );
  const set = new Set<string>();
  for (const row of res.rows) for (const p of row.permissions ?? []) set.add(p);
  return [...set];
}
