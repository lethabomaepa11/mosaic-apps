/**
 * Auto-generated CRUD API: `GET/POST/PATCH/PUT/DELETE /api/entities/:name`.
 * Everything (validation, filters, permissions, audit) is driven by entity metadata.
 */

import { Hono, type Context } from 'hono';
import {
  allFields,
  entityLabel,
  entityLabelPlural,
  parseQuery,
  type EntityDef,
  type Paginated,
  type QuerySpec,
  type RawQuery,
} from '@mosaic/core';
import type { Db } from '../db/driver.js';
import {
  buildInsertSql,
  buildListSql,
  buildOptionsSql,
  buildUpdateSql,
  countParams,
  QueryError,
} from './sql.js';
import { buildEntitySchema, formatIssues } from '../validation/zod.js';
import { HttpError, fail, mapDbError, ok, readJson } from '../modules/http.js';
import { canAccessEntity, isAdmin, requirePermission } from '../modules/rbac.js';
import { writeAudit } from '../modules/audit.js';
import type { AuthEnv, AuthUser } from '../modules/auth.js';
import { ident } from '../db/driver.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface CrudDeps {
  db: Db;
  authEnabled: boolean;
  resolveEntity: (name: string) => EntityDef | undefined;
}

function checkAccess(c: { get: (k: 'user') => AuthUser | null }, entity: EntityDef, action: 'read' | 'create' | 'update' | 'delete'): AuthUser | null {
  const user = c.get('user');
  if (!canAccessEntity(user, entity, action)) {
    if (!user) throw new HttpError(401, 'Authentication required', 'UNAUTHENTICATED');
    throw new HttpError(403, `Missing permission: ${action} on ${entity.name}`, 'FORBIDDEN');
  }
  return user;
}

function mustBeUuid(id: string): void {
  if (!UUID_RE.test(id)) throw new HttpError(404, 'Record not found', 'NOT_FOUND');
}

export function crudRoutes(deps: CrudDeps): Hono<AuthEnv> {
  const app = new Hono<AuthEnv>();

  const entityOr404 = (name: string): EntityDef => {
    const def = deps.resolveEntity(name);
    if (!def) throw new HttpError(404, `Unknown entity "${name}"`, 'UNKNOWN_ENTITY');
    return def;
  };

  // ---------- registry ----------
  app.get('/', async (c) => {
    const user = c.get('user');
    if (deps.authEnabled && !user) throw new HttpError(401, 'Authentication required', 'UNAUTHENTICATED');
    const res = await deps.db.query<{ name: string; definition: EntityDef; version: number; updated_at: string }>(
      'SELECT name, definition, version, updated_at FROM mosaic_entities ORDER BY name',
    );
    const counts = await deps.db.query<{ relname: string; tuples: number }>(
      `SELECT relname, GREATEST(reltuples, 0)::bigint AS tuples FROM pg_class
        WHERE relkind = 'r' AND relnamespace = 'public'::regnamespace`,
    );
    const countMap = new Map(counts.rows.map((r) => [r.relname, Number(r.tuples)]));
    return ok(
      c,
      res.rows.map((r) => ({
        name: r.name,
        definition: r.definition,
        label: entityLabel(r.definition),
        labelPlural: entityLabelPlural(r.definition),
        version: r.version,
        updatedAt: new Date(r.updated_at).toISOString(),
        rowCount: countMap.get(r.name) ?? 0,
      })),
    );
  });

  // ---------- metadata ----------
  app.get('/:name/meta', (c) => {
    const entity = entityOr404(c.req.param('name'));
    checkAccess(c, entity, 'read');
    return ok(c, {
      entity,
      fields: allFields(entity),
      endpoints: {
        list: `GET /api/entities/${entity.name}`,
        get: `GET /api/entities/${entity.name}/:id`,
        create: `POST /api/entities/${entity.name}`,
        update: `PATCH /api/entities/${entity.name}/:id`,
        delete: `DELETE /api/entities/${entity.name}/:id`,
        options: `GET /api/entities/${entity.name}/options`,
        meta: `GET /api/entities/${entity.name}/meta`,
      },
      query: {
        page: 1,
        pageSize: 20,
        sort: '-createdAt',
        q: 'search text',
        filter: JSON.stringify([{ field: 'status', op: 'eq', value: 'active' }]),
        include: 'customer',
        withDeleted: 'true',
      },
    });
  });

  // ---------- picker options ----------
  app.get('/:name/options', async (c) => {
    const entity = entityOr404(c.req.param('name'));
    checkAccess(c, entity, 'read');
    const { sql, params } = buildOptionsSql(entity, {
      q: c.req.query('q'),
      limit: Number(c.req.query('limit') ?? 50),
      includeDeleted: c.req.query('withDeleted') === 'true',
    });
    const res = await deps.db.query<{ value: string; label: string }>(sql, params);
    return ok(c, res.rows);
  });

  // ---------- list ----------
  app.get('/:name', async (c) => {
    const entity = entityOr404(c.req.param('name'));
    checkAccess(c, entity, 'read');
    const includeDeleted = c.req.query('withDeleted') === 'true';
    if (includeDeleted && !isAdmin(c.get('user'))) throw new HttpError(403, 'withDeleted requires admin', 'FORBIDDEN');
    const spec = parseQuery(c.req.query() as RawQuery, { defaultSort: entity.list?.defaultSort });
    const { sql, countSql, params } = buildListSql(entity, spec, {
      includeDeleted,
      resolveEntity: deps.resolveEntity,
    });
    const [countRes, rows] = await Promise.all([
      deps.db.query<{ total: number }>(countSql, countParams(params)),
      deps.db.query(sql, params),
    ]);
    const total = countRes.rows[0]?.total ?? 0;
    const payload: Paginated<unknown> = {
      data: rows.rows,
      total,
      page: spec.page,
      pageSize: spec.pageSize,
      pageCount: Math.max(1, Math.ceil(total / spec.pageSize)),
    };
    return ok(c, payload);
  });

  // ---------- read one ----------
  app.get('/:name/:id', async (c) => {
    const entity = entityOr404(c.req.param('name'));
    checkAccess(c, entity, 'read');
    const id = c.req.param('id');
    mustBeUuid(id);
    const includeDeleted = c.req.query('withDeleted') === 'true';
    const include = (c.req.query('include') ?? '').split(',').filter(Boolean);
    const spec: QuerySpec = {
      page: 1,
      pageSize: 1,
      sort: [],
      filters: [{ field: 'id', op: 'eq', value: id }],
      include,
    };
    const { sql, params } = buildListSql(entity, spec, { includeDeleted, resolveEntity: deps.resolveEntity });
    const res = await deps.db.query(sql, params);
    const row = res.rows[0];
    if (!row) throw new HttpError(404, 'Record not found', 'NOT_FOUND');
    return ok(c, row);
  });

  // ---------- create ----------
  app.post('/:name', async (c) => {
    const entity = entityOr404(c.req.param('name'));
    const user = checkAccess(c, entity, 'create');
    const payload = await readJson<Record<string, unknown>>(c);
    const parsed = buildEntitySchema(entity, 'create').safeParse(payload);
    if (!parsed.success) {
      return fail(c, 422, 'Validation failed', 'VALIDATION', formatIssues(parsed.error as never));
    }
    const { sql, params } = buildInsertSql(entity, parsed.data as Record<string, unknown>);
    const res = await deps.db.query(sql, params);
    const row = res.rows[0];
    writeAudit(deps.db, {
      action: 'create',
      entity: entity.name,
      recordId: String(row?.id ?? ''),
      user,
      ip: c.req.header('x-forwarded-for') ?? null,
    });
    return ok(c, row, 201);
  });

  // ---------- update ----------
  const handleUpdate = async (c: Context<AuthEnv>): Promise<Response> => {
    const entity = entityOr404(String(c.req.param('name') ?? ''));
    const user = checkAccess(c, entity, 'update');
    const id = String(c.req.param('id') ?? '');
    mustBeUuid(id);
    const beforeRes = await deps.db.query(`SELECT * FROM ${ident(entity.name)} WHERE ${ident('id')} = $1`, [id]);
    const before = beforeRes.rows[0];
    if (!before) throw new HttpError(404, 'Record not found', 'NOT_FOUND');
    const payload = await readJson<Record<string, unknown>>(c);
    const parsed = buildEntitySchema(entity, 'update').safeParse(payload);
    if (!parsed.success) {
      return fail(c, 422, 'Validation failed', 'VALIDATION', formatIssues(parsed.error as never));
    }
    const data = parsed.data as Record<string, unknown>;
    const { sql, params } = buildUpdateSql(entity, id, data);
    const res = await deps.db.query(sql, params);
    const after = res.rows[0];
    const changes: Record<string, { from: unknown; to: unknown }> = {};
    for (const key of Object.keys(data)) {
      if (JSON.stringify(before[key]) !== JSON.stringify(after?.[key])) {
        changes[key] = { from: before[key], to: after?.[key] };
      }
    }
    if (Object.keys(changes).length) {
      writeAudit(deps.db, {
        action: 'update',
        entity: entity.name,
        recordId: id,
        changes,
        user,
        ip: c.req.header('x-forwarded-for') ?? null,
      });
    }
    return ok(c, after);
  };

  app.patch('/:name/:id', handleUpdate);
  app.put('/:name/:id', handleUpdate);

  // ---------- delete ----------
  app.delete('/:name/:id', async (c) => {
    const entity = entityOr404(c.req.param('name'));
    const user = checkAccess(c, entity, 'delete');
    const id = c.req.param('id');
    mustBeUuid(id);
    const beforeRes = await deps.db.query(`SELECT * FROM ${ident(entity.name)} WHERE ${ident('id')} = $1`, [id]);
    const before = beforeRes.rows[0];
    if (!before) throw new HttpError(404, 'Record not found', 'NOT_FOUND');
    const force = c.req.query('force') === 'true';
    if (entity.softDelete && !force) {
      await deps.db.query(`UPDATE ${ident(entity.name)} SET ${ident('deletedAt')} = now() WHERE ${ident('id')} = $1`, [id]);
      writeAudit(deps.db, {
        action: 'delete',
        entity: entity.name,
        recordId: id,
        changes: { deletedAt: { from: null, to: new Date().toISOString() } },
        user,
        ip: c.req.header('x-forwarded-for') ?? null,
      });
      return ok(c, { id, softDeleted: true });
    }
    await deps.db.query(`DELETE FROM ${ident(entity.name)} WHERE ${ident('id')} = $1`, [id]);
    writeAudit(deps.db, {
      action: 'delete',
      entity: entity.name,
      recordId: id,
      user,
      ip: c.req.header('x-forwarded-for') ?? null,
    });
    return ok(c, { id, softDeleted: false });
  });

  app.onError((err, c) => {
    if (err instanceof HttpError) return fail(c, err.status, err.message, err.code, err.details);
    if (err instanceof QueryError) return fail(c, 400, err.message, err.code);
    const mapped = mapDbError(err);
    if (mapped) return fail(c, mapped.status, mapped.message, mapped.code);
    console.error('[mosaic] crud error:', err);
    return fail(c, 500, 'Internal server error', 'INTERNAL');
  });

  return app;
}
