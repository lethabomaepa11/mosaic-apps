import type { Cookies } from '@sveltejs/kit';
import { getCloudDb, hosted, id, slugify } from './db';
import { enqueueJob, kickJobs } from './jobs';
import { isDaisyTheme } from '../themes';
import { canManageConnections } from './connections';
import { discardPreview } from './preview';
import type { AppFramework } from '../framework';
import { decryptProviderSecret } from './providers';

export interface NewProject { prompt: string; name: string; appFramework: AppFramework; uiTheme: string; uiSystem: string; includeHome: boolean; includeLogin: boolean }

/** Reads and validates the prompt form; the name is optional and derived from the brief. */
export function readProjectForm(data: FormData): NewProject | { error: string } {
  const prompt = String(data.get('prompt') ?? '').trim().slice(0, 4000);
  // "A CRM for a solar installer with leads, …" → "CRM for a solar installer".
  const derived = prompt.split(/[,.;:!?]|\s(?:with|that|which|where|so|to help)\s/i)[0]!.replace(/^(build|create|make)?\s*(me\s+)?(an?|the)\s+/i, '').replace(/[^\p{L}\p{N}\s&'-]/gu, '').split(/\s+/).slice(0, 6).join(' ');
  const name = (String(data.get('name') ?? '').trim() || derived.charAt(0).toUpperCase() + derived.slice(1)).slice(0, 60);
  if (name.length < 2 || prompt.length < 10) return { error: 'Describe the app in a little more detail.' };
  const theme = String(data.get('uiTheme') ?? 'corporate');
  const system = String(data.get('uiSystem') ?? 'daisyui');
  const appFramework = String(data.get('appFramework') ?? 'sveltekit');
  if (appFramework !== 'sveltekit' && appFramework !== 'nextjs') return { error: 'Choose SvelteKit or Next.js.' };
  return {
    prompt, name, appFramework, uiTheme: isDaisyTheme(theme) ? theme : 'corporate', uiSystem: appFramework === 'nextjs' ? 'mosaic' : ['daisyui', 'mosaic'].includes(system) ? system : 'daisyui',
    // Unchecked checkboxes are absent; a pending prompt saved from the public page keeps its choices.
    includeHome: data.get('includeHome') === 'on', includeLogin: data.get('includeLogin') === 'on',
  };
}

export async function organizationFor(userId: string) {
  const db = await getCloudDb();
  const result = await db.query<{ id: string; name: string; slug: string; role: string }>(
    `SELECT organization.id, organization.name, organization.slug, membership.role FROM cloud_organizations organization
     JOIN cloud_memberships membership ON membership.organization_id = organization.id
     WHERE membership.user_id = $1 ORDER BY organization.created_at LIMIT 1`, [userId],
  );
  return result.rows[0];
}

export async function createProject(userId: string, input: NewProject, origin: string): Promise<string> {
  const organization = await organizationFor(userId);
  if (!organization) throw new Error('No organization membership is available.');
  const db = await getCloudDb();
  const projectId = id();
  const conversationId = id();
  const slug = `${slugify(input.name)}-${projectId.slice(0, 6)}`;
  await db.tx(async (tx) => {
    await tx.query(
      `INSERT INTO cloud_projects (id, organization_id, name, slug, prompt, status, include_home, include_login, app_framework, ui_system, ui_theme)
       VALUES ($1, $2, $3, $4, $5, 'queued', $6, $7, $8, $9, $10)`,
      [projectId, organization.id, input.name, slug, input.prompt, input.includeHome, input.includeLogin, input.appFramework, input.uiSystem, input.uiTheme],
    );
    await tx.query(
      `INSERT INTO cloud_environments (id, project_id, name, kind, status, url) VALUES
       ($1, $2, 'Preview', 'preview', 'ready', $4), ($3, $2, 'Production', 'production', 'not_configured', NULL)`,
      [id(), projectId, id(), `${origin}/preview/${slug}`],
    );
    await tx.query('INSERT INTO cloud_conversations (id, project_id) VALUES ($1, $2)', [conversationId, projectId]);
    await tx.query('INSERT INTO cloud_messages (id, conversation_id, role, content) VALUES ($1, $2, $3, $4)', [id(), conversationId, 'user', input.prompt]);
    await tx.query(
      `INSERT INTO cloud_audit_log (id, organization_id, user_id, action, target_type, target_id, metadata)
       VALUES ($1, $2, $3, 'project.create', 'project', $4, $5::jsonb)`,
      [id(), organization.id, userId, projectId, JSON.stringify({ name: input.name, slug, appFramework: input.appFramework })],
    );
    await enqueueJob(tx, { projectId, kind: 'generate', metadata: { prompt: input.prompt, userId }, stage: 'Waiting to plan' });
  });
  kickJobs();
  return projectId;
}

export async function deleteProject(projectId: string, userId: string, confirmation: FormDataEntryValue | null) {
  const db = await getCloudDb();
  const result = await db.tx(async (tx) => {
    const { rows: [project] } = await tx.query<{ name: string; organization_id: string; role: string }>(
      `SELECT project.name, project.organization_id, membership.role FROM cloud_projects project
       JOIN cloud_memberships membership ON membership.organization_id = project.organization_id
       WHERE project.id = $1 AND membership.user_id = $2 FOR UPDATE OF project, membership`, [projectId, userId],
    );
    if (!project) return { status: 404 as const, message: 'Project not found.' };
    if (!canManageConnections(project.role)) return { status: 403 as const, message: 'Only workspace owners and admins can delete a project.' };
    if (confirmation !== project.name) return { status: 400 as const, message: 'Type the exact project name to confirm deletion.' };

    // Lock queued jobs before deleting them so a worker cannot claim one during deletion.
    const jobs = await tx.query<{ status: string }>('SELECT status FROM cloud_jobs WHERE project_id = $1 FOR UPDATE', [projectId]);
    if (jobs.rows.some((job) => job.status === 'running')) return { status: 409 as const, message: 'Wait for the running job to finish before deleting this project.' };

    await tx.query('DELETE FROM cloud_jobs WHERE project_id = $1', [projectId]);
    await tx.query('DELETE FROM cloud_messages WHERE conversation_id IN (SELECT id FROM cloud_conversations WHERE project_id = $1)', [projectId]);
    await tx.query('DELETE FROM cloud_conversations WHERE project_id = $1', [projectId]);
    await tx.query('DELETE FROM cloud_releases WHERE project_id = $1', [projectId]);
    await tx.query('DELETE FROM cloud_environments WHERE project_id = $1', [projectId]);
    await tx.query('DELETE FROM cloud_projects WHERE id = $1', [projectId]);
    await tx.query(
      `INSERT INTO cloud_audit_log (id, organization_id, user_id, action, target_type, target_id)
       VALUES ($1, $2, $3, 'project.delete', 'project', $4)`, [id(), project.organization_id, userId, projectId],
    );
  });
  if (!result) discardPreview(projectId);
  return result;
}

export async function deploymentCredentials(projectId: string, userId: string) {
  const db = await getCloudDb();
  const { rows: [row] } = await db.query<{ deploy_secret: Parameters<typeof decryptProviderSecret>[0] }>(
    `SELECT project.deploy_secret FROM cloud_projects project
     JOIN cloud_memberships membership ON membership.organization_id = project.organization_id
     JOIN cloud_environments environment ON environment.project_id = project.id
     WHERE project.id = $1 AND membership.user_id = $2 AND membership.role IN ('owner', 'admin')
       AND environment.kind = 'production' AND environment.status = 'ready' AND project.deploy_secret IS NOT NULL`,
    [projectId, userId],
  );
  if (!row) return undefined;
  const { adminEmail, adminPassword } = JSON.parse(decryptProviderSecret(row.deploy_secret)) as { adminEmail: string; adminPassword: string };
  return { email: adminEmail, password: adminPassword };
}

// A signed-out visitor's prompt waits in an HttpOnly cookie until they sign in, then becomes their project.
const PENDING = 'mosaic_pending_project';

export function savePendingProject(cookies: Cookies, input: NewProject): void {
  cookies.set(PENDING, Buffer.from(JSON.stringify(input)).toString('base64url'), { path: '/', httpOnly: true, sameSite: 'lax', secure: hosted, maxAge: 60 * 60 });
}

export async function continuePendingProject(cookies: Cookies, userId: string, origin: string): Promise<string | undefined> {
  const raw = cookies.get(PENDING);
  if (!raw) return undefined;
  cookies.delete(PENDING, { path: '/' });
  try {
    const saved = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as Partial<NewProject>;
    const form = new FormData();
    for (const [key, value] of Object.entries(saved)) form.set(key, typeof value === 'boolean' ? (value ? 'on' : '') : String(value ?? ''));
    const input = readProjectForm(form); // re-validate: the cookie is user-controlled input
    return 'error' in input ? undefined : await createProject(userId, input, origin);
  } catch {
    return undefined;
  }
}
