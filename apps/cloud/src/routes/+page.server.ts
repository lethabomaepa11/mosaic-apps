import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getCloudDb, id, slugify } from '#lib/server/db';
import { isDaisyTheme } from '#lib/themes';

async function organizationFor(userId: string) {
  const db = await getCloudDb();
  const result = await db.query<{ id: string; name: string; slug: string; role: string }>(
    `SELECT organization.id, organization.name, organization.slug, membership.role
     FROM cloud_organizations organization
     JOIN cloud_memberships membership ON membership.organization_id = organization.id
     WHERE membership.user_id = $1 ORDER BY organization.created_at LIMIT 1`, [userId],
  );
  return result.rows[0];
}

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) throw redirect(303, '/login');
  const db = await getCloudDb();
  const organization = await organizationFor(locals.user.id);
  if (!organization) return { organization: null, projects: [], connections: [] };
  const [projects, connections] = await Promise.all([
    db.query<{ id: string; name: string; slug: string; prompt: string; status: string; updated_at: string }>(
      'SELECT id, name, slug, prompt, status, updated_at FROM cloud_projects WHERE organization_id = $1 ORDER BY updated_at DESC', [organization.id],
    ),
    db.query<{ provider: string; status: string; label: string }>(
      'SELECT provider, status, label FROM cloud_provider_connections WHERE organization_id = $1 ORDER BY provider', [organization.id],
    ),
  ]);
  return { organization, projects: projects.rows, connections: connections.rows };
};

export const actions: Actions = {
  create: async ({ request, locals }) => {
    if (!locals.user) throw redirect(303, '/login');
    const organization = await organizationFor(locals.user.id);
    if (!organization) return fail(403, { message: 'No organization membership is available.' });
    const data = await request.formData();
    const name = String(data.get('name') ?? '').trim();
    const prompt = String(data.get('prompt') ?? '').trim();
    const requestedTheme = String(data.get('uiTheme') ?? 'corporate');
    const uiTheme = isDaisyTheme(requestedTheme) ? requestedTheme : 'corporate';
    const appFramework = 'sveltekit';
    const requestedUiSystem = String(data.get('uiSystem') ?? 'daisyui');
    const uiSystem = ['daisyui', 'mosaic'].includes(requestedUiSystem) ? requestedUiSystem : 'daisyui';
    if (name.length < 2 || prompt.length < 10) return fail(400, { message: 'Add a project name and a more specific app brief.' });
    const db = await getCloudDb();
    const projectId = id();
    const conversationId = id();
    const projectSlug = `${slugify(name)}-${projectId.slice(0, 6)}`;
    await db.tx(async (tx) => {
      await tx.query(
        `INSERT INTO cloud_projects (id, organization_id, name, slug, prompt, include_home, include_login, app_framework, ui_system, ui_theme)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [projectId, organization.id, name, projectSlug, prompt, data.get('includeHome') === 'on', data.get('includeLogin') === 'on', appFramework, uiSystem, uiTheme],
      );
      await tx.query(
        `INSERT INTO cloud_environments (id, project_id, name, kind) VALUES
         ($1, $2, 'Preview', 'preview'), ($3, $2, 'Production', 'production')`,
        [id(), projectId, id()],
      );
      await tx.query('INSERT INTO cloud_conversations (id, project_id) VALUES ($1, $2)', [conversationId, projectId]);
      await tx.query('INSERT INTO cloud_messages (id, conversation_id, role, content) VALUES ($1, $2, $3, $4)', [id(), conversationId, 'user', prompt]);
      await tx.query(
        `INSERT INTO cloud_jobs (id, project_id, kind, status, progress, stage, metadata)
         VALUES ($1, $2, 'generate', 'queued', 0, 'Waiting for isolated workspace', $3::jsonb)`,
        [id(), projectId, JSON.stringify({ source: 'studio', includeHome: data.get('includeHome') === 'on', includeLogin: data.get('includeLogin') === 'on', appFramework, uiSystem, uiTheme })],
      );
      await tx.query(
        `INSERT INTO cloud_audit_log (id, organization_id, user_id, action, target_type, target_id, metadata)
         VALUES ($1, $2, $3, 'project.create', 'project', $4, $5::jsonb)`,
        [id(), organization.id, locals.user!.id, projectId, JSON.stringify({ name, slug: projectSlug })],
      );
    });
    throw redirect(303, `/projects/${projectId}`);
  },
};
