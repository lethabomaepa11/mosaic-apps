import { createHmac } from 'node:crypto';
import { createMosaicServer, type MosaicServer } from '@mosaic-apps/server';
import type { PageDef } from '@mosaic-apps/core';
import { getCloudDb, hosted } from './db';
import { applyApp, inProcessCaller, loginToken, seedAndSmokeTest, type MosaicCall } from './mosaic-runtime';
import { compileSpec, type AppSpec, type CompiledApp } from './spec';

/**
 * Each project's live preview is a real Mosaic app running inside Cloud with its own
 * database (never the Cloud control database). Its content is fully derived from the
 * verified spec, so an empty database is rebuilt on start: locally it persists under
 * ./data/previews; on serverless hosts it is in-memory per instance.
 */
interface PreviewRuntime { server: MosaicServer; call: MosaicCall; token: string }
const MAX_RUNNING = 8;
const cache = globalThis as typeof globalThis & { __mosaicPreviews?: Map<string, Promise<PreviewRuntime>> };
const running: Map<string, Promise<PreviewRuntime>> = (cache.__mosaicPreviews ??= new Map());

const secretFor = (projectId: string, purpose: string) =>
  createHmac('sha256', process.env.CLOUD_SESSION_SECRET ?? 'mosaic-local-preview').update(`${purpose}:${projectId}`).digest('base64url');
const ADMIN_EMAIL = 'preview-admin@mosaic.local';

async function start(project: { id: string; slug: string; app_spec: AppSpec | null }): Promise<PreviewRuntime> {
  const server = await createMosaicServer({
    databaseUrl: hosted ? 'pglite://memory' : `pglite://./data/previews/${project.slug.replace(/[^a-z0-9-]/g, '')}`,
    auth: { jwtSecret: secretFor(project.id, 'jwt') }, cors: false,
    seed: { admin: { email: ADMIN_EMAIL, password: secretFor(project.id, 'admin') }, demo: false },
  });
  const token = await loginToken(inProcessCaller(server, ''), ADMIN_EMAIL, secretFor(project.id, 'admin'));
  const call = inProcessCaller(server, token);
  const entities = await call('GET', '/api/entities');
  if (project.app_spec && !(entities.body?.data ?? []).length) await publish(call, project.app_spec, compileSpec(project.app_spec));
  return { server, call, token };
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

export function previewRuntime(project: { id: string; slug: string; app_spec: AppSpec | null }): Promise<PreviewRuntime> {
  let runtime = running.get(project.id);
  if (!runtime) {
    runtime = start(project).catch((cause) => { running.delete(project.id); throw cause; });
    running.set(project.id, runtime);
    if (running.size > MAX_RUNNING) {
      const [oldestId, oldest] = running.entries().next().value!;
      running.delete(oldestId);
      void oldest.then((item: PreviewRuntime) => item.server.close()).catch(() => {});
    }
  }
  return runtime;
}

/** Called after every verified build: the preview iframe shows the new release immediately. */
export async function publishToPreview(project: { id: string; slug: string }, spec: AppSpec, app: CompiledApp): Promise<void> {
  const runtime = await previewRuntime({ ...project, app_spec: spec });
  await publish(runtime.call, spec, app);
}

export async function previewPages(project: { id: string; slug: string; app_spec: AppSpec | null }): Promise<PageDef[]> {
  const { call } = await previewRuntime(project);
  const pages = await call('GET', '/api/pages?published=true');
  return (pages.body?.data ?? []) as PageDef[];
}

/** Previews are private to the project's workspace members (the iframe is same-origin, so the Cloud session applies). */
export async function previewProject(slug: string, userId: string) {
  const db = await getCloudDb();
  const result = await db.query<{ id: string; slug: string; name: string; ui_theme: string; app_spec: AppSpec | null }>(
    `SELECT project.id, project.slug, project.name, project.ui_theme, project.app_spec FROM cloud_projects project
     JOIN cloud_memberships membership ON membership.organization_id = project.organization_id
     WHERE project.slug = $1 AND membership.user_id = $2`, [slug, userId],
  );
  return result.rows[0];
}
