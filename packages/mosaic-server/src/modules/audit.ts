/** Audit log: every write lands in mosaic_audit_log with the acting user. */

import { Hono } from 'hono';
import type { AuditEntry } from '@mosaic/core';
import type { Db } from '../db/driver.js';
import { fail, ok } from './http.js';
import { requirePermission } from './rbac.js';
import type { AuthEnv, AuthUser } from './auth.js';

export interface AuditInput {
  action: string;
  entity?: string;
  recordId?: string;
  changes?: Record<string, { from: unknown; to: unknown }> | null;
  user?: AuthUser | null;
  ip?: string | null;
}

/** Fire-and-forget audit write (never breaks the main request). */
export function writeAudit(db: Db, input: AuditInput): void {
  db.query(
    `INSERT INTO mosaic_audit_log (action, entity, record_id, changes, user_id, user_email, ip)
     VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)`,
    [
      input.action,
      input.entity ?? null,
      input.recordId ?? null,
      input.changes ? JSON.stringify(input.changes) : null,
      input.user?.id ?? null,
      input.user?.email ?? null,
      input.ip ?? null,
    ],
  ).catch((err) => console.error('[mosaic] audit write failed:', (err as Error).message));
}

export function auditRoutes(db: Db): Hono<AuthEnv> {
  const app = new Hono<AuthEnv>();

  app.get('/', async (c) => {
    const user = c.get('user');
    if (!requirePermission(user, 'audit:read')) return fail(c, 403, 'Missing permission: audit:read', 'FORBIDDEN');
    const page = Math.max(1, Number(c.req.query('page') ?? 1) || 1);
    const pageSize = Math.min(200, Math.max(1, Number(c.req.query('pageSize') ?? 50) || 50));
    const entity = c.req.query('entity');
    const action = c.req.query('action');
    const filters: string[] = [];
    const params: unknown[] = [];
    if (entity) {
      params.push(entity);
      filters.push(`entity = $${params.length}`);
    }
    if (action) {
      params.push(action);
      filters.push(`action = $${params.length}`);
    }
    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const countRes = await db.query<{ total: number }>(`SELECT count(*)::int AS total FROM mosaic_audit_log ${where}`, params);
    params.push(pageSize, (page - 1) * pageSize);
    const res = await db.query<{
      id: string;
      action: string;
      entity: string | null;
      record_id: string | null;
      changes: Record<string, { from: unknown; to: unknown }> | null;
      user_id: string | null;
      user_email: string | null;
      ip: string | null;
      created_at: string;
    }>(
      `SELECT id, action, entity, record_id, changes, user_id, user_email, ip, created_at
         FROM mosaic_audit_log ${where}
        ORDER BY created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    const total = countRes.rows[0]?.total ?? 0;
    return ok(c, {
      data: res.rows.map((r) => ({
        id: r.id,
        action: r.action,
        entity: r.entity,
        recordId: r.record_id,
        changes: r.changes,
        userId: r.user_id,
        userEmail: r.user_email,
        ip: r.ip,
        createdAt: new Date(r.created_at).toISOString(),
      })),
      total,
      page,
      pageSize,
      pageCount: Math.ceil(total / pageSize),
    });
  });

  return app;
}
