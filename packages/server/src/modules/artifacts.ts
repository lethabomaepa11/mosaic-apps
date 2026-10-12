/** Form & page artifacts: JSON schemas stored in postgres, with publish-versioning. */

import { Hono } from 'hono';
import { ensureRoot, matchPageRoute, pageRouteSpecificity, validateDefinitionTree, validatePageRoute, slugify, type FormDef, type PageDef } from '@mosaic-apps/core';
import type { Db } from '../db/driver.js';
import { HttpError, fail, ok, readJson } from './http.js';
import { requirePermission } from './rbac.js';
import { writeAudit } from './audit.js';
import type { AuthEnv, AuthUser } from './auth.js';
import { reservePageRoute } from './page-routes.js';

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
  folder: string | null;
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

function folderPath(value: unknown): string {
  const path = String(value ?? '').replace(/\\/g, '/').split('/').map((part) => part.trim()).filter(Boolean).join('/');
  if (path.split('/').some((part) => part === '.' || part === '..')) {
    throw new HttpError(422, 'Folder path cannot contain . or .. segments', 'BAD_FOLDER');
  }
  return path;
}

function toRecord(row: ArtifactRow, kind: ArtifactKind): FormDef | PageDef {
  const base = {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description ?? undefined,
    folder: row.folder ?? undefined,
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

/** Columns must match each table exactly (mosaic_pages has no entity/data_source; mosaic_forms has no route). */
function returnCols(kind: ArtifactKind): string {
  return kind === 'page'
    ? 'id, slug, name, description, folder, route, version, published, schema, settings, created_at, updated_at'
    : 'id, slug, name, description, folder, entity, version, published, schema, data_source, settings, created_at, updated_at';
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
  if (typeof (root as { id?: unknown }).id !== 'string' || !(root as { id?: string }).id?.trim()) (root as { id?: string }).id = `${prefixFor(kind)}_root_${Math.random().toString(36).slice(2)}`;
  try { validateDefinitionTree(root); } catch (error) { throw new HttpError(422, error instanceof Error ? error.message : 'Invalid component tree.', 'BAD_SCHEMA'); }
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

function requiresAuthentication(row: ArtifactRow, kind: ArtifactKind): boolean {
  return !row.published || (kind === 'page' && !!(row.settings as { requiresAuth?: boolean } | null)?.requiresAuth);
}

function validateArtifactInput(body: Record<string, unknown>, kind: ArtifactKind): void {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(422, 'An artifact object is required.', 'BAD_INPUT');
  if (kind === 'page' && body.route !== undefined) {
    try { validatePageRoute(body.route as string); } catch (error) { throw new HttpError(422, error instanceof Error ? error.message : 'Invalid page route.', 'BAD_ROUTE'); }
  }
  if (body.settings !== undefined && (!body.settings || typeof body.settings !== 'object' || Array.isArray(body.settings))) throw new HttpError(422, 'Settings must be an object.', 'BAD_SETTINGS');
  const settings = body.settings as { requiresAuth?: unknown; mode?: unknown } | undefined;
  if (kind === 'page' && settings?.requiresAuth !== undefined && typeof settings.requiresAuth !== 'boolean') throw new HttpError(422, 'Require authentication must be a boolean.', 'BAD_SETTINGS');
  if (kind === 'form' && settings?.mode !== undefined && !['create', 'edit', 'view'].includes(String(settings.mode))) throw new HttpError(422, 'Form mode must be create, edit or view.', 'BAD_SETTINGS');
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'undefined';
}

function samePublishedContent(row: ArtifactRow, snapshot: unknown): boolean {
  if (!snapshot || typeof snapshot !== 'object') return false;
  const old = snapshot as Partial<ArtifactRow>;
  return ['id', 'slug', 'name', 'description', 'folder', 'entity', 'route', 'schema', 'data_source', 'settings']
    .every((key) => canonical((row as unknown as Record<string, unknown>)[key]) === canonical((old as Record<string, unknown>)[key]));
}

function sameArtifactContent(left: ArtifactRow, right: ArtifactRow): boolean {
  return ['id', 'slug', 'name', 'description', 'folder', 'entity', 'route', 'schema', 'data_source', 'settings']
    .every((key) => canonical((left as unknown as Record<string, unknown>)[key]) === canonical((right as unknown as Record<string, unknown>)[key]));
}

export function artifactRoutes(deps: ArtifactDeps): Hono<AuthEnv> {
  const app = new Hono<AuthEnv>();
  const table = tableFor(deps.kind);
  const historyTable = deps.kind === 'form' ? 'mosaic_form_versions' : 'mosaic_page_versions';
  const historyKey = deps.kind === 'form' ? 'form_id' : 'page_id';
  async function snapshotPublished(tx: Db, row: ArtifactRow) {
    if (!row.published) return;
    const existing = await tx.query(`SELECT 1 FROM ${historyTable} WHERE ${historyKey} = $1 AND version = $2`, [row.id, row.version]);
    if (!existing.rows.length) await tx.query(`INSERT INTO ${historyTable} (id, ${historyKey}, version, snapshot) VALUES ($1,$2,$3,$4::jsonb)`, [`av_${Math.random().toString(36).slice(2)}`, row.id, row.version, JSON.stringify(row)]);
  }

  const rowOr404 = async (idOrSlug: string): Promise<ArtifactRow> => {
    const res = await deps.db.query<ArtifactRow>(`SELECT ${returnCols(deps.kind)} FROM ${table} WHERE id = $1 OR slug = $1`, [
      idOrSlug,
    ]);
    const row = res.rows[0];
    if (!row) throw new HttpError(404, `${deps.kind} not found`, 'NOT_FOUND');
    return row;
  };

  if (deps.kind === 'page') app.get('/resolve', async (c) => {
    const path = c.req.query('path') ?? '';
    if (!path.startsWith('/') || path.length > 2000) throw new HttpError(422, 'A local page path is required.', 'BAD_ROUTE');
    const result = await deps.db.query<ArtifactRow>(`SELECT ${returnCols('page')} FROM ${table} WHERE published = true ORDER BY route, id`);
    const matches = result.rows.map(row => ({ row, params: matchPageRoute(row.route ?? `/${row.slug}`, path) }))
      .filter(match => match.params !== null).sort((a, b) => pageRouteSpecificity(b.row.route!) - pageRouteSpecificity(a.row.route!));
    const selected = matches[0];
    if (!selected) throw new HttpError(404, 'Page not found.', 'NOT_FOUND');
    if (requiresAuthentication(selected.row, 'page') && !c.get('user')) throw new HttpError(401, 'Authentication required', 'UNAUTHENTICATED');
    return ok(c, { page: toRecord(selected.row, 'page'), params: selected.params });
  });

  app.get('/folders', async (c) => {
    if (!c.get('user')) throw new HttpError(401, 'Authentication required', 'UNAUTHENTICATED');
    const res = await deps.db.query<{ folder: string }>(`SELECT DISTINCT folder FROM ${table} WHERE folder IS NOT NULL ORDER BY folder`);
    const stored = await deps.db.query<{ value: unknown }>(`SELECT value FROM mosaic_settings WHERE key = $1`, [`studio.${deps.kind}s.folders`]);
    const configured = Array.isArray(stored.rows[0]?.value) ? stored.rows[0]!.value as string[] : [];
    return ok(c, [...new Set([...configured, ...res.rows.map((row) => row.folder)])].sort());
  });

  app.post('/folders', async (c) => {
    requireManage(c.get('user'), deps.managePerm, 'update');
    const body = await readJson<{ path?: unknown }>(c);
    const path = folderPath(body.path);
    if (!path) throw new HttpError(422, 'Folder path is required', 'BAD_FOLDER');
    const key = `studio.${deps.kind}s.folders`;
    const current = await deps.db.query<{ value: unknown }>('SELECT value FROM mosaic_settings WHERE key = $1', [key]);
    const paths = Array.isArray(current.rows[0]?.value) ? current.rows[0]!.value as string[] : [];
    await deps.db.query(
      'INSERT INTO mosaic_settings (key, value, description, updated_at) VALUES ($1, $2::jsonb, $3, now()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()',
      [key, JSON.stringify([...new Set([...paths, path])]), `Studio ${deps.kind} folders`],
    );
    return ok(c, { path }, 201);
  });

  app.post('/folders/rename', async (c) => {
    const user = requireManage(c.get('user'), deps.managePerm, 'update');
    const body = await readJson<{ from?: unknown; to?: unknown }>(c);
    const from = folderPath(body.from);
    const to = folderPath(body.to);
    if (!from || !to || from === to || to.startsWith(`${from}/`)) {
      throw new HttpError(422, 'Choose a different folder path', 'BAD_FOLDER');
    }
    const result = await deps.db.query(
      `UPDATE ${table}
       SET folder = CASE WHEN folder = $1 THEN $2 ELSE $2 || substring(folder from length($1) + 1) END,
           updated_at = now()
       WHERE folder = $1 OR left(folder, length($1) + 1) = $1 || '/'`,
      [from, to],
    );
    const key = `studio.${deps.kind}s.folders`;
    const current = await deps.db.query<{ value: unknown }>('SELECT value FROM mosaic_settings WHERE key = $1', [key]);
    const paths = Array.isArray(current.rows[0]?.value) ? current.rows[0]!.value as string[] : [];
    const renamed = paths.map((path) => path === from || path.startsWith(`${from}/`) ? `${to}${path.slice(from.length)}` : path);
    await deps.db.query('UPDATE mosaic_settings SET value = $2::jsonb, updated_at = now() WHERE key = $1', [key, JSON.stringify(renamed)]);
    writeAudit(deps.db, { action: 'update', entity: `${deps.kind}_folder`, recordId: from, user });
    return ok(c, { from, to, updated: result.rowCount ?? 0 });
  });

  app.post('/folders/delete', async (c) => {
    const user = requireManage(c.get('user'), deps.managePerm, 'update');
    const body = await readJson<{ path?: unknown }>(c);
    const path = folderPath(body.path);
    if (!path) throw new HttpError(422, 'Folder path is required', 'BAD_FOLDER');
    const result = await deps.db.query(
      `UPDATE ${table} SET folder = NULL, updated_at = now()
       WHERE folder = $1 OR left(folder, length($1) + 1) = $1 || '/'`,
      [path],
    );
    const key = `studio.${deps.kind}s.folders`;
    const current = await deps.db.query<{ value: unknown }>('SELECT value FROM mosaic_settings WHERE key = $1', [key]);
    const paths = Array.isArray(current.rows[0]?.value) ? current.rows[0]!.value as string[] : [];
    await deps.db.query('UPDATE mosaic_settings SET value = $2::jsonb, updated_at = now() WHERE key = $1', [key, JSON.stringify(paths.filter((item) => item !== path && !item.startsWith(`${path}/`)))]);
    writeAudit(deps.db, { action: 'update', entity: `${deps.kind}_folder`, recordId: path, user });
    return ok(c, { path, movedToRoot: result.rowCount ?? 0 });
  });

  // list
  app.get('/', async (c) => {
    const user = c.get('user');
    const publishedOnly = c.req.query('published') === 'true';
    if (!user && !publishedOnly) throw new HttpError(401, 'Authentication required', 'UNAUTHENTICATED');
    const filters: string[] = [];
    const params: unknown[] = [];
    if (publishedOnly) filters.push('published = true');
    const entity = c.req.query('entity');
    if (entity && deps.kind === 'form') {
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
    return ok(c, res.rows.filter((r) => r.published ? !!user || !requiresAuthentication(r, deps.kind) : requirePermission(user, deps.managePerm)).map((r) => toRecord(r, deps.kind)));
  });

  // get by id or slug (published artifacts are readable anonymously)
  app.get('/:idOrSlug', async (c) => {
    const row = await rowOr404(c.req.param('idOrSlug'));
    if (requiresAuthentication(row, deps.kind) && !c.get('user')) throw new HttpError(401, 'Authentication required', 'UNAUTHENTICATED');
    if (!row.published) requireManage(c.get('user'), deps.managePerm, 'read draft');
    return ok(c, toRecord(row, deps.kind));
  });

  // Published history is management-only for both artifact kinds.
  {
    app.get('/:idOrSlug/versions', async (c) => {
      requireManage(c.get('user'), deps.managePerm, 'read history');
      const row = await rowOr404(c.req.param('idOrSlug'));
      const res = await deps.db.query<{ version: number; snapshot: unknown; published_at: string }>(
        `SELECT version, snapshot, published_at FROM ${historyTable} WHERE ${historyKey} = $1 ORDER BY version DESC LIMIT 100`,
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
      requireManage(c.get('user'), deps.managePerm, 'read history');
      const row = await rowOr404(c.req.param('idOrSlug'));
      const version = Number(c.req.param('version'));
      const res = await deps.db.query<{ version: number; snapshot: unknown; published_at: string }>(
        `SELECT version, snapshot, published_at FROM ${historyTable} WHERE ${historyKey} = $1 AND version = $2`,
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

  app.post('/:idOrSlug/versions/:version/restore', async (c) => {
    const user = requireManage(c.get('user'), deps.managePerm, 'restore');
    const body = await readJson<{ expectedVersion?: number }>(c);
    const version = Number(c.req.param('version'));
    if (!Number.isInteger(version) || version < 1 || !Number.isInteger(body?.expectedVersion)) throw new HttpError(422, 'Choose a published version and supply expectedVersion.', 'BAD_VERSION');
    const restored = await deps.db.tx(async tx => {
      const selected = await tx.query<ArtifactRow>(`SELECT ${returnCols(deps.kind)} FROM ${table} WHERE id = $1 OR slug = $1 FOR UPDATE`, [c.req.param('idOrSlug')]);
      const current = selected.rows[0];
      if (!current) throw new HttpError(404, 'Artifact not found.', 'NOT_FOUND');
      if (current.version !== body.expectedVersion) throw new HttpError(409, 'This definition changed after it was loaded.', 'STALE_VERSION', { expectedVersion: body.expectedVersion, actualVersion: current.version });
      const result = await tx.query<{ snapshot: ArtifactRow }>(`SELECT snapshot FROM ${historyTable} WHERE ${historyKey} = $1 AND version = $2`, [current.id, version]);
      const saved = result.rows[0]?.snapshot;
      if (!saved) throw new HttpError(404, 'Published version not found.', 'NOT_FOUND');
      const root = assertUsableSchema(saved.schema, deps.kind);
      validateArtifactInput({ settings: saved.settings ?? {}, ...(deps.kind === 'page' ? { route: saved.route } : {}) }, deps.kind);
      if (deps.kind === 'page') await reservePageRoute(tx, saved.route!, current.id);
      await snapshotPublished(tx, current);
      const fields = deps.kind === 'page' ? ['name', 'description', 'folder', 'route', 'schema', 'settings'] : ['name', 'description', 'folder', 'entity', 'schema', 'data_source', 'settings'];
      const values = fields.map(key => ['schema', 'settings', 'data_source'].includes(key) ? JSON.stringify(key === 'schema' ? root : saved[key as keyof ArtifactRow] ?? null) : saved[key as keyof ArtifactRow] ?? null);
      const assignments = fields.map((key, index) => `${key} = $${index + 2}${['schema', 'settings', 'data_source'].includes(key) ? '::jsonb' : ''}`).join(', ');
      const updated = await tx.query<ArtifactRow>(`UPDATE ${table} SET ${assignments}, published = true, version = version + 1, updated_at = now() WHERE id = $1 RETURNING ${returnCols(deps.kind)}`, [current.id, ...values]);
      const row = updated.rows[0]!;
      await tx.query(`INSERT INTO ${historyTable} (id, ${historyKey}, version, snapshot) VALUES ($1,$2,$3,$4::jsonb)`, [`av_${Math.random().toString(36).slice(2)}`, row.id, row.version, JSON.stringify(row)]);
      await tx.query('INSERT INTO mosaic_audit_log (action, entity, record_id, changes, user_id, user_email) VALUES ($1,$2,$3,$4::jsonb,$5,$6)', ['restore', deps.kind, row.id, JSON.stringify({ version: { from: current.version, to: row.version }, restoredFrom: { from: null, to: version } }), user.id, user.email]);
      return row;
    });
    return ok(c, toRecord(restored, deps.kind));
  });

  // create
  app.post('/', async (c) => {
    const user = requireManage(c.get('user'), deps.managePerm, 'create');
    const body = await readJson<Record<string, unknown>>(c);
    validateArtifactInput(body, deps.kind);
    const name = String(body.name ?? '').trim();
    if (!name) throw new HttpError(422, 'name is required', 'BAD_INPUT');
    const root = assertUsableSchema(body.schema ?? { type: deps.kind, children: [] }, deps.kind);
    const id = `${prefixFor(deps.kind)}_${Math.random().toString(36).slice(2, 12)}`;
    const slug = await uniqueSlug(deps.db, deps.kind, String(body.slug ?? name));
    const cols = deps.kind === 'page'
      ? '(id, slug, name, description, folder, route, version, published, schema, settings)'
      : '(id, slug, name, description, folder, entity, version, published, schema, data_source, settings)';
    const vals = deps.kind === 'page'
      ? '($1, $2, $3, $4, $5, $6, 1, false, $7::jsonb, $8::jsonb)'
      : '($1, $2, $3, $4, $5, $6, 1, false, $7::jsonb, $8::jsonb, $9::jsonb)';
    const params = deps.kind === 'page'
      ? [
          id,
          slug,
          name,
          body.description ? String(body.description) : null,
          folderPath(body.folder) || null,
          String(body.route ?? `/${slug}`),
          JSON.stringify(root),
          JSON.stringify(body.settings ?? {}),
        ]
      : [
          id,
          slug,
          name,
          body.description ? String(body.description) : null,
          folderPath(body.folder) || null,
          body.entity ? String(body.entity) : null,
          JSON.stringify(root),
          JSON.stringify(body.dataSource ?? { kind: 'none' }),
          JSON.stringify(body.settings ?? {}),
        ];
    const res = await deps.db.tx(async tx => {
      if (deps.kind === 'page') await reservePageRoute(tx, String(body.route ?? `/${slug}`));
      return tx.query<ArtifactRow>(`INSERT INTO ${table} ${cols} VALUES ${vals} RETURNING ${returnCols(deps.kind)}`, params);
    });
    writeAudit(deps.db, { action: 'create', entity: deps.kind, recordId: id, user });
    return ok(c, toRecord(res.rows[0]!, deps.kind), 201);
  });

  // Atomic authoring lifecycle: update and publish under one row lock.
  app.put('/:idOrSlug/save-and-publish', async (c) => {
    const user = requireManage(c.get('user'), deps.managePerm, 'publish');
    const idOrSlug = c.req.param('idOrSlug');
    const body = await readJson<Record<string, unknown>>(c);
    validateArtifactInput(body, deps.kind);
    const expectedVersion = body.expectedVersion === undefined ? undefined : Number(body.expectedVersion);
    const result = await deps.db.tx(async (tx) => {
      const selected = await tx.query<ArtifactRow>(`SELECT ${returnCols(deps.kind)} FROM ${table} WHERE id = $1 OR slug = $1 FOR UPDATE`, [idOrSlug]);
      const row = selected.rows[0];
      if (!row) throw new HttpError(404, `${deps.kind} not found`, 'NOT_FOUND');
      if (expectedVersion !== undefined && (!Number.isInteger(expectedVersion) || expectedVersion !== row.version)) {
        throw new HttpError(409, `This ${deps.kind} changed after it was loaded`, 'STALE_VERSION', { expectedVersion, actualVersion: row.version });
      }
      await snapshotPublished(tx, row);
      if (deps.kind === 'page') await reservePageRoute(tx, String(body.route ?? row.route), row.id);
      const schemaInput = body.root ?? body.schema;
      const root = schemaInput !== undefined ? assertUsableSchema(schemaInput, deps.kind) : row.schema;
      let updated: ArtifactRow;
      if (deps.kind === 'page') {
        const res = await tx.query<ArtifactRow>(
          `UPDATE ${table} SET
             name = COALESCE($2, name), description = COALESCE($3, description),
             folder = CASE WHEN $4::boolean THEN NULLIF($5, '') ELSE folder END,
             route = CASE WHEN $6::boolean THEN $7 ELSE route END,
             schema = $8::jsonb, settings = COALESCE($9::jsonb, settings), updated_at = now()
           WHERE id = $1 RETURNING ${returnCols(deps.kind)}`,
          [row.id, body.name !== undefined ? String(body.name) : null, body.description !== undefined ? String(body.description) : null,
            body.folder !== undefined, folderPath(body.folder), body.route !== undefined, String(body.route ?? '') || null,
            JSON.stringify(root), body.settings !== undefined ? JSON.stringify(body.settings) : null],
        );
        updated = res.rows[0]!;
      } else {
        const res = await tx.query<ArtifactRow>(
          `UPDATE ${table} SET
             name = COALESCE($2, name), description = COALESCE($3, description),
             folder = CASE WHEN $4::boolean THEN NULLIF($5, '') ELSE folder END,
             entity = CASE WHEN $6::boolean THEN $7 ELSE entity END,
             schema = $8::jsonb, data_source = COALESCE($9::jsonb, data_source),
             settings = COALESCE($10::jsonb, settings), updated_at = now()
           WHERE id = $1 RETURNING ${returnCols(deps.kind)}`,
          [row.id, body.name !== undefined ? String(body.name) : null, body.description !== undefined ? String(body.description) : null,
            body.folder !== undefined, folderPath(body.folder), body.entity !== undefined,
            body.entity !== undefined ? String(body.entity ?? '') || null : null, JSON.stringify(root),
            body.dataSource !== undefined ? JSON.stringify(body.dataSource) : null,
            body.settings !== undefined ? JSON.stringify(body.settings) : null],
        );
        updated = res.rows[0]!;
      }

      const changed = !row.published || !sameArtifactContent(row, updated);
      const nextVersion = changed ? row.version + 1 : row.version;
      const final = await tx.query<ArtifactRow>(
        `UPDATE ${table} SET published = true, version = $2, updated_at = now() WHERE id = $1 RETURNING ${returnCols(deps.kind)}`,
        [row.id, nextVersion],
      );
      updated = final.rows[0]!;
      if (changed) {
        await tx.query(
          `INSERT INTO ${historyTable} (id, ${historyKey}, version, snapshot) VALUES ($1, $2, $3, $4::jsonb)`,
          [`fv_${Math.random().toString(36).slice(2, 12)}`, row.id, nextVersion, JSON.stringify(updated)],
        );
      }
      return { row: updated, changed };
    });
    writeAudit(deps.db, { action: 'update', entity: deps.kind, recordId: result.row.id, user });
    if (result.changed) writeAudit(deps.db, { action: 'publish', entity: deps.kind, recordId: result.row.id, user });
    return ok(c, toRecord(result.row, deps.kind));
  });

  // update
  app.put('/:idOrSlug', async (c) => {
    const user = requireManage(c.get('user'), deps.managePerm, 'update');
    const row = await rowOr404(c.req.param('idOrSlug'));
    const body = await readJson<Record<string, unknown>>(c);
    validateArtifactInput(body, deps.kind);
    const schemaInput = body.root ?? body.schema;
    const root = schemaInput !== undefined ? assertUsableSchema(schemaInput, deps.kind) : (row.schema as never);
    if (deps.kind === 'page') {
      const res = await deps.db.tx(async tx => {
        await reservePageRoute(tx, String(body.route ?? row.route), row.id);
        return tx.query<ArtifactRow>(
        `UPDATE ${table} SET
           name = COALESCE($2, name),
           description = COALESCE($3, description),
           folder = CASE WHEN $4::boolean THEN NULLIF($5, '') ELSE folder END,
           route = CASE WHEN $6::boolean THEN $7 ELSE route END,
           schema = $8::jsonb,
           settings = COALESCE($9::jsonb, settings),
           updated_at = now()
         WHERE id = $1 RETURNING ${returnCols(deps.kind)}`,
        [
          row.id,
          body.name !== undefined ? String(body.name) : null,
          body.description !== undefined ? String(body.description) : null,
          body.folder !== undefined,
          folderPath(body.folder),
          body.route !== undefined,
          String(body.route ?? '') || null,
          JSON.stringify(root),
          body.settings !== undefined ? JSON.stringify(body.settings) : null,
        ],
        );
      });
      writeAudit(deps.db, { action: 'update', entity: deps.kind, recordId: row.id, user });
      return ok(c, toRecord(res.rows[0]!, deps.kind));
    }
    const res = await deps.db.query<ArtifactRow>(
      `UPDATE ${table} SET
         name = COALESCE($2, name),
         description = COALESCE($3, description),
         folder = CASE WHEN $4::boolean THEN NULLIF($5, '') ELSE folder END,
         entity = CASE WHEN $6::boolean THEN $7 ELSE entity END,
         schema = $8::jsonb,
         data_source = COALESCE($9::jsonb, data_source),
         settings = COALESCE($10::jsonb, settings),
         updated_at = now()
       WHERE id = $1 RETURNING ${returnCols(deps.kind)}`,
      [
        row.id,
        body.name !== undefined ? String(body.name) : null,
        body.description !== undefined ? String(body.description) : null,
        body.folder !== undefined,
        folderPath(body.folder),
        body.entity !== undefined,
        body.entity !== undefined ? String(body.entity ?? '') || null : null,
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
    const idOrSlug = c.req.param('idOrSlug');
    const result = await deps.db.tx(async (tx) => {
      const selected = await tx.query<ArtifactRow>(`SELECT ${returnCols(deps.kind)} FROM ${table} WHERE id = $1 OR slug = $1 FOR UPDATE`, [idOrSlug]);
      const row = selected.rows[0];
      if (!row) throw new HttpError(404, `${deps.kind} not found`, 'NOT_FOUND');
      await snapshotPublished(tx, row);
      if (deps.kind === 'page') await reservePageRoute(tx, row.route!, row.id);
      if (row.published) {
        const previous = await tx.query<{ snapshot: unknown }>(
          `SELECT snapshot FROM ${historyTable} WHERE ${historyKey} = $1 ORDER BY version DESC LIMIT 1`, [row.id],
        );
        if (previous.rows[0] && samePublishedContent(row, previous.rows[0].snapshot)) return { row, changed: false };
      }
      const nextVersion = row.version + 1;
      await tx.query(`UPDATE ${table} SET published = true, version = $2, updated_at = now() WHERE id = $1`, [row.id, nextVersion]);
      {
        const snapshot = { ...row, version: nextVersion, published: true };
        await tx.query(
          `INSERT INTO ${historyTable} (id, ${historyKey}, version, snapshot) VALUES ($1, $2, $3, $4::jsonb)`,
          [`fv_${Math.random().toString(36).slice(2, 12)}`, row.id, nextVersion, JSON.stringify(snapshot)],
        );
      }
      const updated = await tx.query<ArtifactRow>(`SELECT ${returnCols(deps.kind)} FROM ${table} WHERE id = $1`, [row.id]);
      return { row: updated.rows[0]!, changed: true };
    });
    if (result.changed) writeAudit(deps.db, { action: 'publish', entity: deps.kind, recordId: result.row.id, user });
    return ok(c, toRecord(result.row, deps.kind));
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
    await deps.db.query(`DELETE FROM ${historyTable} WHERE ${historyKey} = $1`, [row.id]);
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

