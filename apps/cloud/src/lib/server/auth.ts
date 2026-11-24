import type { Cookies } from '@sveltejs/kit';
import { hashPassword, signJwt, verifyJwt, verifyPassword } from '@mosaic-apps/server';
import { getCloudDb, id, slugify } from './db';

const env = process.env;

const COOKIE = 'mosaic_cloud_session';

function secret(): string {
  const value = env.CLOUD_SESSION_SECRET ?? env.MOSAIC_JWT_SECRET ?? (env.VERCEL ? '' : 'local-cloud-secret-change-before-production-1234');
  if (value.length < 32) throw new Error('CLOUD_SESSION_SECRET must contain at least 32 characters.');
  return value;
}

export async function authenticate(email: string, password: string) {
  const db = await getCloudDb();
  const result = await db.query<{ id: string; email: string; name: string; password_hash: string }>(
    'SELECT id, email, name, password_hash FROM cloud_users WHERE lower(email) = $1', [email.trim().toLowerCase()],
  );
  const user = result.rows[0];
  return user && verifyPassword(password, user.password_hash) ? { id: user.id, email: user.email, name: user.name } : null;
}

export async function registerAccount(name: string, email: string, password: string) {
  const db = await getCloudDb();
  const normalizedEmail = email.trim().toLowerCase();
  const existing = await db.query('SELECT id FROM cloud_users WHERE lower(email) = $1', [normalizedEmail]);
  if (existing.rows.length) return null;
  const userId = id();
  const organizationId = id();
  try {
    await db.tx(async (tx) => {
      await tx.query('INSERT INTO cloud_users (id, email, name, password_hash) VALUES ($1, $2, $3, $4)', [userId, normalizedEmail, name.trim(), hashPassword(password)]);
      await tx.query('INSERT INTO cloud_organizations (id, name, slug) VALUES ($1, $2, $3)', [organizationId, `${name.trim()}\'s workspace`, `${slugify(name)}-${organizationId.slice(0, 8)}`]);
      await tx.query('INSERT INTO cloud_memberships (organization_id, user_id, role) VALUES ($1, $2, $3)', [organizationId, userId, 'owner']);
      await tx.query(`INSERT INTO cloud_audit_log (id, organization_id, user_id, action, target_type, target_id)
        VALUES ($1, $2, $3, 'account.create', 'user', $3)`, [id(), organizationId, userId]);
    });
  } catch (cause) {
    const duplicate = cause instanceof Error && /unique|duplicate/i.test(cause.message);
    if (duplicate) return null;
    throw cause;
  }
  return { id: userId, email: normalizedEmail, name: name.trim() };
}

export function setSession(cookies: Cookies, user: { id: string; email: string }): void {
  const token = signJwt({ sub: user.id, email: user.email, roles: ['cloud'] }, secret(), 60 * 60 * 24 * 7);
  cookies.set(COOKIE, token, { path: '/', httpOnly: true, sameSite: 'lax', secure: Boolean(env.VERCEL), maxAge: 60 * 60 * 24 * 7 });
}

export function clearSession(cookies: Cookies): void {
  cookies.delete(COOKIE, { path: '/' });
}

export async function sessionUser(cookies: Cookies) {
  const token = cookies.get(COOKIE);
  if (!token) return null;
  const payload = verifyJwt(token, secret());
  if (!payload) return null;
  const db = await getCloudDb();
  const result = await db.query<{ id: string; email: string; name: string }>('SELECT id, email, name FROM cloud_users WHERE id = $1', [payload.sub]);
  return result.rows[0] ?? null;
}
