/** An entity workflow is created atomically, including published form snapshots. */
import { Hono } from 'hono';
import { generateEntityWorkflow, newId, type EntityWorkflowOptions } from '@mosaic-apps/core';
import type { Db } from '../db/driver.js';
import { getEntity } from '../entities/registry.js';
import { requirePermission } from './rbac.js';
import { HttpError, fail, ok, readJson } from './http.js';
import type { AuthEnv } from './auth.js';

export function workflowRoutes(db: Db): Hono<AuthEnv> {
  const app = new Hono<AuthEnv>();
  app.post('/entity', async (context) => {
    const user = context.get('user');
    if (!user) throw new HttpError(401, 'Sign in to generate application views.', 'UNAUTHENTICATED');
    if (!requirePermission(user, 'forms:manage') || !requirePermission(user, 'pages:manage')) {
      throw new HttpError(403, 'Generating views requires form and page management permissions.', 'FORBIDDEN');
    }
    const body = await readJson<EntityWorkflowOptions & { entity?: string }>(context);
    if (typeof body.entity !== 'string') throw new HttpError(422, 'Choose an entity.', 'BAD_INPUT');
    for (const key of ['name', 'slug', 'folder'] as const) {
      if (body[key] !== undefined && (typeof body[key] !== 'string' || body[key]!.length > 160)) {
        throw new HttpError(422, `${key} must be a string up to 160 characters.`, 'BAD_INPUT');
      }
    }
    if (body.folder?.split(/[\\/]/).some((part) => part === '.' || part === '..')) throw new HttpError(422, 'Folder cannot contain . or .. segments.', 'BAD_INPUT');
    if (body.pageSize !== undefined && (!Number.isInteger(body.pageSize) || body.pageSize < 5 || body.pageSize > 100)) throw new HttpError(422, 'Page size must be between 5 and 100.', 'BAD_INPUT');
    const entity = await getEntity(db, body.entity);
    if (!entity) throw new HttpError(404, 'Entity not found.', 'NOT_FOUND');
    let workflow;
    try { workflow = generateEntityWorkflow(entity.definition, body); }
    catch (error) { throw new HttpError(422, error instanceof Error ? error.message : 'Invalid view configuration.', 'BAD_INPUT'); }
    await db.tx(async (tx) => {
      const slugs = Object.values(workflow.forms).map((form) => form.slug);
      const existing = await tx.query('SELECT id FROM mosaic_forms WHERE slug = ANY($1::text[]) UNION ALL SELECT id FROM mosaic_pages WHERE slug = $2 OR route = $3', [slugs, workflow.page.slug, workflow.page.route]);
      if (existing.rows.length) throw new HttpError(409, 'Views with this name already exist. Open those views or choose a different name.', 'WORKFLOW_EXISTS');
      for (const form of Object.values(workflow.forms)) {
        const result = await tx.query<Record<string, unknown>>(`INSERT INTO mosaic_forms
          (id, slug, name, folder, entity, version, published, schema, data_source, settings)
          VALUES ($1,$2,$3,$4,$5,1,true,$6::jsonb,$7::jsonb,$8::jsonb) RETURNING *`,
          [form.id, form.slug, form.name, form.folder, form.entity, JSON.stringify(form.root), JSON.stringify(form.dataSource), JSON.stringify(form.settings)]);
        await tx.query('INSERT INTO mosaic_form_versions (id, form_id, version, snapshot) VALUES ($1,$2,1,$3::jsonb)', [newId('fv'), form.id, JSON.stringify(result.rows[0])]);
      }
      const page = workflow.page;
      await tx.query(`INSERT INTO mosaic_pages (id, slug, name, folder, route, version, published, schema, settings)
        VALUES ($1,$2,$3,$4,$5,1,true,$6::jsonb,$7::jsonb)`, [page.id, page.slug, page.name, page.folder, page.route, JSON.stringify(page.root), JSON.stringify(page.settings)]);
      await tx.query(`INSERT INTO mosaic_audit_log (action, entity, record_id, changes, user_id, user_email)
        VALUES ('generate', 'workflow', $1, $2::jsonb, $3, $4)`, [page.id, JSON.stringify({ entity: { from: null, to: body.entity }, views: { from: null, to: slugs } }), user.id, user.email]);
    });
    return ok(context, workflow, 201);
  });
  app.onError((error, context) => {
    if (error instanceof HttpError) return fail(context, error.status, error.message, error.code, error.details);
    if ((error as { code?: string }).code === '23505') return fail(context, 409, 'Views with this name already exist.', 'WORKFLOW_EXISTS');
    console.error('[mosaic] workflow generation failed:', error);
    return fail(context, 500, 'Could not generate application views.', 'INTERNAL');
  });
  return app;
}
