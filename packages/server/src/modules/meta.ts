/** Health, platform metadata and dashboard stats. */

import { Hono } from 'hono';
import type { Db } from '../db/driver.js';
import { ok } from './http.js';
import type { AuthEnv } from './auth.js';

export const PLATFORM_VERSION = '0.1.0';

export function metaRoutes(db: Db): Hono<AuthEnv> {
  const app = new Hono<AuthEnv>();

  app.get('/health', async (c) => {
    let dbOk = false;
    try {
      const res = await db.query('SELECT 1 AS ok');
      dbOk = res.rows.length > 0;
    } catch {
      dbOk = false;
    }
    return ok(c, { ok: dbOk, db: dbOk, version: PLATFORM_VERSION, time: new Date().toISOString() });
  });

  app.get('/meta', async (c) => {
    const user = c.get('user');
    const counts = await db.query<{ entities: number; forms: number; pages: number; users: number; migrations: number }>(
      `SELECT
         (SELECT count(*)::int FROM mosaic_entities) AS entities,
         (SELECT count(*)::int FROM mosaic_forms) AS forms,
         (SELECT count(*)::int FROM mosaic_pages) AS pages,
         (SELECT count(*)::int FROM mosaic_users) AS users,
         (SELECT count(*)::int FROM mosaic_migrations) AS migrations`,
    );
    const c1 = counts.rows[0]!;
    return ok(c, {
      version: PLATFORM_VERSION,
      counts: c1,
      auth: {
        authenticated: Boolean(user),
        user: user ? { id: user.id, email: user.email, name: user.name, roles: user.roles, permissions: user.permissions } : null,
      },
      capabilities: {
        entities: true,
        migrations: true,
        forms: true,
        pages: true,
        refLists: true,
        settings: true,
        audit: true,
        files: true,
        graphql: false,
      },
    });
  });

  return app;
}
