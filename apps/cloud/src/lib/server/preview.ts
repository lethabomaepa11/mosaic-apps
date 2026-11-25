import { createHmac } from 'node:crypto';
import { createMosaicServer, ident, signJwt, type MosaicServer } from '@mosaic-apps/server';
import type { NavItemDef, PageDef } from '@mosaic-apps/core';
import { getCloudDb, hosted, readCloud } from './db';
import { applyApp, inProcessCaller, seedAndSmokeTest, type MosaicCall } from './mosaic-runtime';
import { compileSpec, type AppSpec, type CompiledApp } from './spec';
import { previewDatabaseUrl, withPreviewSchema } from './preview-schema';
import { createWorkflowEndpoints } from '../../../../../templates/fullstack/apps/web/src/lib/server/create-workflows.js';

/**
 * Each project's live preview is a real Mosaic app running inside Cloud with its own
 * database (never the Cloud control database). Its content is fully derived from the
 * verified spec, so an empty database is rebuilt on start: locally it persists under
 * ./data/previews. Hosted previews use separate schemas in a dedicated configured database.
 */
interface PreviewRuntime { server: MosaicServer; call: MosaicCall; token: () => string }
const MAX_RUNNING = hosted ? 2 : 8;
const cache = globalThis as typeof globalThis & { __mosaicPreviews?: Map<string, Promise<PreviewRuntime>> };
const running: Map<string, Promise<PreviewRuntime>> = (cache.__mosaicPreviews ??= new Map());

export async function discardPreview(projectId: string): Promise<void> {
  const runtime = running.get(projectId);
  running.delete(projectId);
  await runtime?.then((item) => item.server.close()).catch(() => {});
}

const secretFor = (projectId: string, purpose: string) =>
  createHmac('sha256', process.env.CLOUD_SESSION_SECRET ?? 'mosaic-local-preview').update(`${purpose}:${projectId}`).digest('base64url');
const ADMIN_EMAIL = 'preview-admin@mosaic.local';

type PreviewProject = { id: string; slug: string; app_spec: AppSpec | null };

async function start(project: PreviewProject, databaseUrl: string): Promise<PreviewRuntime> {
  const jwtSecret = secretFor(project.id, 'jwt');
  const server = await createMosaicServer({
    databaseUrl, database: { poolMax: 2, idleTimeoutMillis: 5_000 },
    auth: { jwtSecret, oauth: false }, notifications: false, cors: false,
    endpoints: [{
      method: 'POST', path: '/:workflow/submit', summary: 'Submit a generated preview workflow',
      responses: { 201: { description: 'Submitted' } },
      handler: async (context) => {
        const db = await getCloudDb();
        const { rows: [current] } = await db.query<{ app_spec: AppSpec | null }>('SELECT app_spec FROM cloud_projects WHERE id = $1', [project.id]);
        const spec = current?.app_spec;
        const workflowName = context.params.workflow;
        const workflow = spec && compileSpec(spec).workflows?.find((item) => item.entity.replaceAll('_', '-') === workflowName);
        if (!workflow) return Response.json({ success: false, error: { message: 'Workflow not found' } }, { status: 404 });
        const endpoint = createWorkflowEndpoints([workflow])[0]!;
        const profile = workflow.profile;
        const sampleEmail = profile && spec.sampleData.find((sample) => sample.entity === profile.entity)?.records
          .flat().find((pair) => pair.field === profile.emailField)?.value;
        const user = context.user && sampleEmail ? { ...context.user, email: sampleEmail } : context.user;
        return endpoint.handler({ ...context, user });
      },
    }],
    seed: { admin: { email: ADMIN_EMAIL, password: secretFor(project.id, 'admin') }, demo: false },
  });
  try {
    const { rows: [admin] } = await server.db.query<{ id: string }>('SELECT id FROM mosaic_users WHERE email = $1', [ADMIN_EMAIL]);
    if (!admin) throw new Error('Preview could not load its service account.');
    const token = () => signJwt({ sub: admin.id, email: ADMIN_EMAIL, roles: ['admin'] }, jwtSecret, 120);
    const call: MosaicCall = (...args) => inProcessCaller(server, token())(...args);
    const { rows: [state] } = await server.db.query<{ exists: boolean; initialized: boolean }>(`SELECT
      to_regclass('mosaic_preview_state') IS NOT NULL AS exists,
      EXISTS (SELECT 1 FROM mosaic_entities) AS initialized`);
    await server.db.query('CREATE TABLE IF NOT EXISTS mosaic_preview_state (key text PRIMARY KEY)');
    // Preserve visual edits in previews created before the publication markers were introduced.
    if (!state.exists && state.initialized) await server.db.query("INSERT INTO mosaic_preview_state VALUES ('initialized') ON CONFLICT DO NOTHING");
    const runtime = { server, call, token };
    if (project.app_spec) await publishOnce(runtime, 'initialized', project.app_spec, compileSpec(project.app_spec));
    return runtime;
  } catch (cause) {
    await server.close().catch(() => {});
    throw cause;
  }
}

async function publishOnce(runtime: PreviewRuntime, key: string, spec: AppSpec, app: CompiledApp): Promise<void> {
  const marker = await runtime.server.db.query('SELECT 1 FROM mosaic_preview_state WHERE key = $1', [key]);
  if (marker.rows.length) return;
  await publish(runtime.call, spec, app);
  await runtime.server.db.query("INSERT INTO mosaic_preview_state (key) VALUES ($1), ('initialized') ON CONFLICT DO NOTHING", [key]);
}

async function publish(call: MosaicCall, spec: AppSpec, app: CompiledApp): Promise<void> {
  const applied = await applyApp(call, app, { allowDestructive: true });
  if (applied.errors.length) throw new Error(`Preview publish failed: ${applied.errors[0]}`);
  // Sample data only for entities that have none yet, so user-entered preview records survive updates.
  const empty: AppSpec['entities'] = [];
  for (const entity of spec.entities) {
    const rows = await call('GET', `/api/entities/${entity.name}?pageSize=1`);
    if (!(rows.body?.data?.total > 0)) empty.push(entity);
  }
  if (empty.length) {
    const failures = await seedAndSmokeTest(call, { ...spec, entities: spec.entities }, { only: new Set(empty.map((entity) => entity.name)), smoke: false });
    if (failures.length) console.warn('Preview sample data was partly rejected', failures);
  }
}

export function previewRuntime(project: PreviewProject): Promise<PreviewRuntime> {
  let runtime = running.get(project.id);
  if (!runtime) {
    const initialize = previewDatabaseUrl() ? withPreviewSchema(project.id, async (db, schema, url) => {
      const exists = await (await getCloudDb()).query('SELECT 1 FROM cloud_projects WHERE id = $1', [project.id]);
      if (!exists.rows.length) throw new Error('The preview project no longer exists.');
      await db.query(`CREATE SCHEMA IF NOT EXISTS ${ident(schema)}`);
      return start(project, url);
    }) : start(project, hosted ? 'pglite://memory' : `pglite://./data/previews/${project.slug.replace(/[^a-z0-9-]/g, '')}`);
    runtime = initialize.catch((cause) => { if (running.get(project.id) === runtime) running.delete(project.id); throw cause; });
    running.set(project.id, runtime);
    if (running.size > MAX_RUNNING) {
      void discardPreview(running.keys().next().value!);
    }
  }
  return runtime;
}

/** Called after every verified build: the preview iframe shows the new release immediately. */
export async function publishToPreview(project: { id: string; slug: string }, spec: AppSpec, app: CompiledApp, jobId: string): Promise<void> {
  const runtime = await previewRuntime({ ...project, app_spec: null });
  const apply = () => publishOnce(runtime, jobId, spec, app);
  if (previewDatabaseUrl()) await withPreviewSchema(project.id, apply);
  else await apply();
}

export async function previewPages(project: { id: string; slug: string; app_spec: AppSpec | null }): Promise<PageDef[]> {
  const { call } = await previewRuntime(project);
  const pages = await call('GET', '/api/pages?published=true');
  if (pages.status !== 200) throw new Error(`Could not load preview pages (${pages.status}).`);
  return (pages.body?.data ?? []) as PageDef[];
}

export async function previewNavigation(project: PreviewProject, pages: PageDef[]): Promise<NavItemDef[]> {
  const defaults = pages
    .filter((page) => page.settings?.menu?.show !== false && !page.route.split('/').some((part) => part.startsWith(':')))
    .sort((a, b) => (a.settings?.menu?.order ?? 99) - (b.settings?.menu?.order ?? 99))
    .map((page) => ({ label: page.settings?.menu?.label ?? page.settings?.title ?? page.name, href: page.route, icon: page.settings?.menu?.icon, section: page.settings?.menu?.group }));
  const { call } = await previewRuntime(project);
  const result = await call('GET', '/api/settings').catch(() => undefined);
  const setting = result?.status === 200 && Array.isArray(result.body?.data)
    ? result.body.data.find((item: { key?: string }) => item?.key === 'app.nav') : undefined;
  const items: NavItemDef[] = Array.isArray(setting?.value) ? setting.value : defaults;
  return items.filter((item) => typeof item?.label === 'string' && typeof item.href === 'string' && /^\/(?![/\\])/.test(item.href) && !/[\\\u0000-\u001f]/.test(item.href))
    .map(({ label, href, icon, section }) => ({ label, href, icon: typeof icon === 'string' ? icon : undefined, section: typeof section === 'string' ? section : undefined }));
}

/** Previews are private to the project's workspace members (the iframe is same-origin, so the Cloud session applies). */
export async function previewProject(slug: string, userId: string) {
  const result = await readCloud((db) => db.query<{ id: string; slug: string; name: string; app_framework: string; ui_theme: string; app_spec: AppSpec | null; live_url: string | null }>(
    `SELECT project.id, project.slug, project.name, project.app_framework, project.ui_theme, project.app_spec, live.url AS live_url FROM cloud_projects project
     JOIN cloud_memberships membership ON membership.organization_id = project.organization_id
     LEFT JOIN cloud_environments live ON live.project_id = project.id AND live.kind = 'production' AND live.status = 'ready'
     WHERE project.slug = $1 AND membership.user_id = $2`, [slug, userId],
  ));
  return result.rows[0];
}
