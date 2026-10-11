/** Form & page artifacts: JSON schemas stored in postgres, with publish-versioning. */

import { Hono } from 'hono';
import { ensureRoot, slugify, type FormDef, type PageDef } from '@mosaic/core';
import type { Db } from '../db/driver.js';
import { HttpError, fail, ok, readJson } from './http.js';
import { requirePermission } from './rbac.js';
import { writeAudit } from './audit.js';
import type { AuthEnv, AuthUser } from './auth.js';

export type ArtifactKind = 'form' | 'page';

export interface ArtifactDeps {
  db: Db;
  kind: ArtifactKind;
  /** permission string needed to create/update/delete/publish */
  managePerm: string;
}

export interface ArtifactRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  entity: string | null;
  route: string | null;
  version: number;
  published: boolean;
  schema: { type?: string; children?: unknown[] };
  data_source: unknown;
  settings: unknown;
  created_at: string;
  updated_at: string;
}

function tableFor(kind: ArtifactKind): string {
  return kind === 'form' ? 'mosaic_forms' : 'mosaic_pages';
}

function prefixFor(kind: ArtifactKind): string {
  return kind === 'form' ? 'frm' : 'pg';
}

function toRecord(row: ArtifactRow, kind: ArtifactKind): FormDef | PageDef {
  const base = {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description ?? undefined,
    version: row.version,
    published: row.published,
    root: row.schema as never,
    settings: (row.settings ?? undefined) as never,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
  if (kind === 'form') {
    return { ...base, entity: row.entity ?? undefined, dataSource: (row.data_source ?? undefined) as never } as FormDef;
  }
  return { ...base, route: row.route ?? `/${row.slug}` } as PageDef;
}

  'id, slug, name, description, entity, route, version, published, schema, data_source, settings, created_at, updated_at';

/** RETURNING must match the table's columns (mosaic_forms has no `route`). */
function returnCols(kind: ArtifactKind): string {
  const base =
    'id, slug, name, description, entity, version, published, schema, data_source, settings, created_at, updated_at';
  return kind === 'page' ? `${base}, route` : base;
}

async function uniqueSlug(db: Db, kind: ArtifactKind, desired: string): Promise<string> {
  const base = slugify(desired);
  let candidate = base;
  for (let i = 2; i < 100; i++) {
    const res = await db.query(`SELECT 1 FROM ${tableFor(kind)} WHERE slug = $1`, [candidate]);
    if (!res.rows.length) return candidate;
    candidate = `${base}-${i}`;
  }
  return `${base}-${Date.now()}`;
}

function assertUsableSchema(schema: unknown, kind: ArtifactKind): { type: string; children: unknown[] } {
  if (!schema || typeof schema !== 'object') throw new HttpError(422, 'schema must be an object', 'BAD_SCHEMA');
  const s = schema as { type?: string; children?: unknown[] };
  if (s.type && s.type !== (kind === 'form' ? 'form' : 'page')) {
    throw new HttpError(422, `schema.type must be "${kind}"`, 'BAD_SCHEMA');
  }
  if (s.children !== undefined && !Array.isArray(s.children)) {
    throw new HttpError(422, 'schema.children must be an array', 'BAD_SCHEMA');
  }
  const root = { ...s, type: kind === 'form' ? 'form' : 'page', children: Array.isArray(s.children) ? s.children : [] };
  ensureRoot(root as never);
  return root as { type: string; children: unknown[] };
}

function requireManage(user: AuthUser | null, perm: string, action: string): AuthUser {
  if (!user) throw new HttpError(401, 'Authentication required', 'UNAUTHENTICATED');
  if (!requirePermission(user, perm)) {
    throw new HttpError(403, `Missing permission: ${perm} (${action})`, 'FORBIDDEN');
  }
  return user;
}

export function artifactRoutes(deps: ArtifactDeps): Hono<AuthEnv> {
  const app = new Hono<AuthEnv>();
  const table = tableFor(deps.kind);

  const rowOr404 = async (idOrSlug: string): Promise<ArtifactRow> => {
    const res = await deps.db.query<ArtifactRow>(`SELECT ${returnCols(deps.kind)} FROM ${table} WHERE id = $1 OR slug = $1`, [
      idOrSlug,
    ]);
    const row = res.rows[0];
    if (!row) throw new HttpError(404, `${deps.kind} not found`, 'NOT_FOUND');
    return row;
  };

  // list
  app.get('/', async (c) => {
    const user = c.get('user');
    const publishedOnly = c.req.query('published') === 'true';
    if (!user && !publishedOnly) throw new HttpError(401, 'Authentication required', 'UNAUTHENTICATED');
    const filters: string[] = [];
    const params: unknown[] = [];
    if (publishedOnly) filters.push('published = true');
    const entity = c.req.query('entity');
    if (entity) {
      params.push(entity);
      filters.push(`entity = $${params.length}`);
    }
    const q = c.req.query('q');
    if (q) {
      params.push(`%${q}%`);
      filters.push(`(name ILIKE $${params.length} OR slug ILIKE $${params.length})`);
    }
    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const res = await deps.db.query<ArtifactRow>(
      `SELECT ${returnCols(deps.kind)} FROM ${table} ${where} ORDER BY updated_at DESC LIMIT 500`,
      params,
    );
    return ok(c, res.rows.map((r) => toRecord(r, deps.kind)));
  });

  // get by id or slug (published artifacts are readable anonymously)
  app.get('/:idOrSlug', async (c) => {
    const row = await rowOr404(c.req.param('idOrSlug'));
    if (!row.published && !c.get('user')) throw new HttpError(401, 'Authentication required', 'UNAUTHENTICATED');
    return ok(c, toRecord(row, deps.kind));
  });

  // versions (forms only)
  if (deps.kind === 'form') {
    app.get('/:idOrSlug/versions', async (c) => {
      const row = await rowOr404(c.req.param('idOrSlug'));
      const res = await deps.db.query<{ version: number; snapshot: unknown; published_at: string }>(
        'SELECT version, snapshot, published_at FROM mosaic_form_versions WHERE form_id = $1 ORDER BY version DESC',
        [row.id],
      );
      return ok(
        c,
        res.rows.map((r) => ({
          version: r.version,
          snapshot: r.snapshot,
          publishedAt: new Date(r.published_at).toISOString(),
        })),
      );
    });
    app.get('/:idOrSlug/versions/:version', async (c) => {
      const row = await rowOr404(c.req.param('idOrSlug'));
      const version = Number(c.req.param('version'));
      const res = await deps.db.query<{ version: number; snapshot: unknown; published_at: string }>(
        'SELECT version, snapshot, published_at FROM mosaic_form_versions WHERE form_id = $1 AND version = $2',
        [row.id, version],
      );
      const found = res.rows[0];
      if (!found) throw new HttpError(404, 'Version not found', 'NOT_FOUND');
      return ok(c, {
        version: found.version,
        snapshot: found.snapshot,
        publishedAt: new Date(found.published_at).toISOString(),
      });
    });
  }

  // create
  app.post('/', async (c) => {
    const user = requireManage(c.get('user'), deps.managePerm, 'create');
    const body = await readJson<Record<string, unknown>>(c);
    const name = String(body.name ?? '').trim();
    if (!name) throw new HttpError(422, 'name is required', 'BAD_INPUT');
    const root = assertUsableSchema(body.schema ?? { type: deps.kind, children: [] }, deps.kind);
    const id = `${prefixFor(deps.kind)}_${Math.random().toString(36).slice(2, 12)}`;
    const slug = await uniqueSlug(deps.db, deps.kind, String(body.slug ?? name));
    const cols = deps.kind === 'page'
      ? '(id, slug, name, description, entity, route, version, published, schema, data_source, settings)'
      : '(id, slug, name, description, entity, version, published, schema, data_source, settings)';
    const vals = deps.kind === 'page'
      ? '($1, $2, $3, $4, $5, $6, 1, false, $7::jsonb, $8::jsonb, $9::jsonb)'
      : '($1, $2, $3, $4, $5, 1, false, $6::jsonb, $7::jsonb, $8::jsonb)';
    const params = deps.kind === 'page'
      ? [
          id,
          slug,
          name,
          body.description ? String(body.description) : null,
          body.entity ? String(body.entity) : null,
          String(body.route ?? `/${slug}`),
          JSON.stringify(root),
          JSON.stringify(body.dataSource ?? { kind: 'none' }),
          JSON.stringify(body.settings ?? {}),
        ]
      : [
          id,
          slug,
          name,
          body.description ? String(body.description) : null,
          body.entity ? String(body.entity) : null,
          JSON.stringify(root),
          JSON.stringify(body.dataSource ?? { kind: 'none' }),
          JSON.stringify(body.settings ?? {}),
        ];
    const res = await deps.db.query<ArtifactRow>(
      `INSERT INTO ${table} ${cols} VALUES ${vals} RETURNING ${returnCols(deps.kind)}`,
      params,
    );
    writeAudit(deps.db, { action: 'create', entity: deps.kind, recordId: id, user });
    return ok(c, toRecord(res.rows[0]!, deps.kind), 201);
  });

  // update
  app.put('/:idOrSlug', async (c) => {
    const user = requireManage(c.get('user'), deps.managePerm, 'update');
    const row = await rowOr404(c.req.param('idOrSlug'));
    const body = await readJson<Record<string, unknown>>(c);
    const root = body.schema !== undefined ? assertUsableSchema(body.schema, deps.kind) : (row.schema as never);
    const res = await deps.db.query<ArtifactRow>(
      `UPDATE ${table} SET
         name = COALESCE($2, name),
         description = COALESCE($3, description),
         entity = CASE WHEN $4::boolean THEN $5 ELSE entity END,
         route = CASE WHEN $6::boolean THEN $7 ELSE route END,
         schema = $8::jsonb,
         data_source = COALESCE($9::jsonb, data_source),
         settings = COALESCE($10::jsonb, settings),
         updated_at = now()
       WHERE id = $1 RETURNING ${returnCols(deps.kind)}`,
      [
        row.id,
        body.name !== undefined ? String(body.name) : null,
        body.description !== undefined ? String(body.description) : null,
        body.entity !== undefined,
        body.entity !== undefined ? String(body.entity ?? '') || null : null,
        body.route !== undefined && deps.kind === 'page',
        String(body.route ?? '') || null,
        JSON.stringify(root),
        body.dataSource !== undefined ? JSON.stringify(body.dataSource) : null,
        body.settings !== undefined ? JSON.stringify(body.settings) : null,
      ],
    );
    writeAudit(deps.db, { action: 'update', entity: deps.kind, recordId: row.id, user });
    return ok(c, toRecord(res.rows[0]!, deps.kind));
  });

  // publish (bumps version, snapshots for forms)
  app.post('/:idOrSlug/publish', async (c) => {
    const user = requireManage(c.get('user'), deps.managePerm, 'publish');
    const row = await rowOr404(c.req.param('idOrSlug'));
    const nextVersion = row.version + 1;
    await deps.db.query(`UPDATE ${table} SET published = true, version = $2, updated_at = now() WHERE id = $1`, [
      row.id,
      nextVersion,
    ]);
    if (deps.kind === 'form') {
      const snapshot = { ...row, version: nextVersion, published: true };
      await deps.db.query(
        `INSERT INTO mosaic_form_versions (id, form_id, version, snapshot) VALUES ($1, $2, $3, $4::jsonb)`,
        [`fv_${Math.random().toString(36).slice(2, 12)}`, row.id, nextVersion, JSON.stringify(snapshot)],
      );
    }
    writeAudit(deps.db, { action: 'publish', entity: deps.kind, recordId: row.id, user });
    const updated = await rowOr404(row.id);
    return ok(c, toRecord(updated, deps.kind));
  });

  // unpublish
  app.post('/:idOrSlug/unpublish', async (c) => {
    const user = requireManage(c.get('user'), deps.managePerm, 'publish');
    const row = await rowOr404(c.req.param('idOrSlug'));
    await deps.db.query(`UPDATE ${table} SET published = false, updated_at = now() WHERE id = $1`, [row.id]);
    writeAudit(deps.db, { action: 'publish', entity: deps.kind, recordId: row.id, user });
    const updated = await rowOr404(row.id);
    return ok(c, toRecord(updated, deps.kind));
  });

  // delete
  app.delete('/:idOrSlug', async (c) => {
    const user = requireManage(c.get('user'), deps.managePerm, 'delete');
    const row = await rowOr404(c.req.param('idOrSlug'));
    await deps.db.query(`DELETE FROM ${table} WHERE id = $1`, [row.id]);
    if (deps.kind === 'form') {
      await deps.db.query('DELETE FROM mosaic_form_versions WHERE form_id = $1', [row.id]);
    }
    writeAudit(deps.db, { action: 'delete', entity: deps.kind, recordId: row.id, user });
    return ok(c, { id: row.id, deleted: true });
  });

  app.onError((err, c) => {
    if (err instanceof HttpError) return fail(c, err.status, err.message, err.code, err.details);
    console.error(`[mosaic] ${deps.kind} error:`, err);
    return fail(c, 500, 'Internal server error', 'INTERNAL');
  });

  return app;
}
