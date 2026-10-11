/** Key/value application settings (mosaic_settings). */

import { Hono } from 'hono';
import type { SettingRecord } from '@mosaic-apps/core';
import type { Db } from '../db/driver.js';
import { HttpError, fail, ok, readJson } from './http.js';
import { requirePermission } from './rbac.js';
import { writeAudit } from './audit.js';
import type { AuthEnv } from './auth.js';

export const DEFAULT_NAV = [{ label: 'Home', href: '/', icon: 'home' }];

export function navRoutes(db: Db): Hono<AuthEnv> {
  const app = new Hono<AuthEnv>();
  app.get('/', async (c) => {
    const res = await db.query<{ value: unknown }>("SELECT value FROM mosaic_settings WHERE key = 'app.nav'");
    const value = res.rows[0]?.value;
    const items = Array.isArray(value) && value.every((item) => item && typeof item.label === 'string' && typeof item.href === 'string')
      ? value
      : DEFAULT_NAV;
    return ok(c, { items });
  });
  return app;
}

export function themeRoutes(db: Db): Hono<AuthEnv> {
  const app = new Hono<AuthEnv>();
  app.get('/', async (c) => {
    const res = await db.query<{ value: unknown }>("SELECT value FROM mosaic_settings WHERE key = 'theme.config'");
    const value = res.rows[0]?.value;
    return ok(c, value && typeof value === 'object' && !Array.isArray(value) ? value : {});
  });
  return app;
}

export const DEFAULT_SETTINGS: SettingRecord[] = [
  { key: 'app.name', value: 'Mosaic App', description: 'Application display name' },
  { key: 'app.logo', value: '', description: 'Logo URL (empty = text logo)' },
  { key: 'theme.primary', value: '#6366f1', description: 'Primary brand color' },
  { key: 'theme.radius', value: '10', description: 'Corner radius in px' },
  { key: 'auth.allowRegistration', value: false, description: 'Allow self-service sign up' },
  { key: 'forms.successRedirect', value: '', description: 'Global redirect after form submit' },
  { key: 'data.pageSize', value: 20, description: 'Default table page size' },
];

export async function seedSettings(db: Db): Promise<void> {
  for (const s of DEFAULT_SETTINGS) {
    await db.query('INSERT INTO mosaic_settings (key, value, description) VALUES ($1, $2::jsonb, $3) ON CONFLICT (key) DO NOTHING', [
      s.key,
      JSON.stringify(s.value),
      s.description ?? null,
    ]);
  }
}

export function settingsRoutes(db: Db): Hono<AuthEnv> {
  const app = new Hono<AuthEnv>();

  app.get('/', async (c) => {
    if (!c.get('user')) throw new HttpError(401, 'Authentication required', 'UNAUTHENTICATED');
    const res = await db.query<SettingRecord & { updated_at: string }>(
      'SELECT key, value, description, updated_at FROM mosaic_settings ORDER BY key',
    );
    return ok(
      c,
      res.rows.map((r) => ({ key: r.key, value: r.value, description: r.description, updatedAt: new Date(r.updated_at).toISOString() })),
    );
  });

  app.put('/', async (c) => {
    const user = c.get('user');
    if (!requirePermission(user, 'settings:manage')) throw new HttpError(403, 'Missing permission: settings:manage', 'FORBIDDEN');
    const body = await readJson<{ key?: string; value?: unknown; description?: string }>(c);
    const key = String(body.key ?? '').trim();
    if (!key || !/^[a-z0-9_.:-]+$/i.test(key)) throw new HttpError(422, 'Invalid settings key', 'BAD_KEY');
    await db.query(
      `INSERT INTO mosaic_settings (key, value, description, updated_at)
       VALUES ($1, $2::jsonb, $3, now())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, description = EXCLUDED.description, updated_at = now()`,
      [key, JSON.stringify(body.value ?? null), body.description ?? null],
    );
    writeAudit(db, { action: 'update', entity: 'setting', recordId: key, user });
    return ok(c, { key, value: body.value });
  });

  app.delete('/:key', async (c) => {
    const user = c.get('user');
    if (!requirePermission(user, 'settings:manage')) throw new HttpError(403, 'Missing permission: settings:manage', 'FORBIDDEN');
    const key = c.req.param('key');
    const res = await db.query('DELETE FROM mosaic_settings WHERE key = $1', [key]);
    if (!res.rowCount) return fail(c, 404, 'Setting not found', 'NOT_FOUND');
    writeAudit(db, { action: 'delete', entity: 'setting', recordId: key, user });
    return ok(c, { key, deleted: true });
  });

  app.onError((err, c) => {
    if (err instanceof HttpError) return fail(c, err.status, err.message, err.code, err.details);
    console.error('[mosaic] settings error:', err);
    return fail(c, 500, 'Internal server error', 'INTERNAL');
  });

  return app;
}

