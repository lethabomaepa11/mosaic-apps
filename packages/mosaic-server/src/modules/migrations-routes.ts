/** /api/migrations: plan (dry run), apply, history. */

import { Hono } from 'hono';
import type { Db } from '../db/driver.js';
import { applyPlan, computePlan, migrationHistory } from '../migrate/runner.js';
import { HttpError, fail, ok, readJson } from './http.js';
import { requirePermission } from './rbac.js';
import { writeAudit } from './audit.js';
import type { AuthEnv, AuthUser } from './auth.js';

function guardMigrate(user: AuthUser | null): AuthUser {
  if (!user) throw new HttpError(401, 'Authentication required', 'UNAUTHENTICATED');
  if (!requirePermission(user, 'migrations:run')) {
    throw new HttpError(403, 'Missing permission: migrations:run', 'FORBIDDEN');
  }
  return user;
}

export function migrationRoutes(db: Db): Hono<AuthEnv> {
  const app = new Hono<AuthEnv>();

  // dry-run plan
  app.get('/plan', async (c) => {
    guardMigrate(c.get('user'));
    const only = c.req.query('entity') ?? undefined;
    const result = await computePlan(db, { only });
    return ok(c, {
      plans: result.plans,
      statements: result.statements,
      warnings: result.warnings,
      empty: result.statements.length === 0,
      entities: result.entities.map((e) => ({ name: e.name, version: e.version })),
    });
  });

  // apply
  app.post('/apply', async (c) => {
    const user = guardMigrate(c.get('user'));
    const body = await readJson<{ allowDestructive?: boolean; only?: string }>(c).catch(() => ({}) as {
      allowDestructive?: boolean;
      only?: string;
    });
    const result = await applyPlan(db, {
      allowDestructive: body.allowDestructive ?? true,
      only: body.only,
    });
    writeAudit(db, {
      action: 'migrate',
      recordId: body.only ?? 'all',
      changes: { applied: { from: 0, to: result.applied.reduce((n, a) => n + a.statements, 0) } },
      user,
    });
    return ok(c, result);
  });

  // history
  app.get('/', async (c) => {
    guardMigrate(c.get('user'));
    const limit = Math.min(500, Number(c.req.query('limit') ?? 100) || 100);
    return ok(c, await migrationHistory(db, limit));
  });

  app.onError((err, c) => {
    if (err instanceof HttpError) return fail(c, err.status, err.message, err.code, err.details);
    console.error('[mosaic] migrations error:', err);
    return fail(c, 500, err instanceof Error ? err.message : 'Internal server error', 'MIGRATION_ERROR');
  });

  return app;
}
