import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getCloudDb, id } from '#lib/server/db';
import { isDaisyTheme } from '#lib/themes';

async function projectFor(projectId: string, userId: string) {
  const db = await getCloudDb();
  const result = await db.query<{
    id: string; organization_id: string; name: string; slug: string; prompt: string; status: string;
    include_home: boolean; include_login: boolean; app_framework: string; ui_system: string; ui_theme: string;
    github_repository: string | null; vercel_project_id: string | null;
  }>(
    `SELECT project.* FROM cloud_projects project
     JOIN cloud_memberships membership ON membership.organization_id = project.organization_id
     WHERE project.id = $1 AND membership.user_id = $2`, [projectId, userId],
  );
  return result.rows[0];
}

export const load: PageServerLoad = async ({ params, locals }) => {
  if (!locals.user) throw redirect(303, '/login');
  const project = await projectFor(params.id, locals.user.id);
  if (!project) throw error(404, 'Project not found');
  const db = await getCloudDb();
  const [environments, jobs, messages] = await Promise.all([
    db.query<{ id: string; name: string; kind: string; status: string; url: string | null }>('SELECT id, name, kind, status, url FROM cloud_environments WHERE project_id = $1 ORDER BY kind DESC', [project.id]),
    db.query<{ id: string; kind: string; status: string; progress: number; stage: string | null; error: string | null; created_at: string }>('SELECT id, kind, status, progress, stage, error, created_at FROM cloud_jobs WHERE project_id = $1 ORDER BY created_at DESC LIMIT 20', [project.id]),
    db.query<{ id: string; role: string; content: string; created_at: string }>(
      `SELECT message.id, message.role, message.content, message.created_at
       FROM cloud_messages message JOIN cloud_conversations conversation ON conversation.id = message.conversation_id
       WHERE conversation.project_id = $1 ORDER BY message.created_at`, [project.id],
    ),
  ]);
  return { project, environments: environments.rows, jobs: jobs.rows, messages: messages.rows };
};

export const actions: Actions = {
  settings: async ({ params, request, locals }) => {
    if (!locals.user) throw redirect(303, '/login');
    const user = locals.user;
    const project = await projectFor(params.id, user.id);
    if (!project) throw error(404, 'Project not found');
    const form = await request.formData();
    const requestedTheme = String(form.get('uiTheme') ?? 'corporate');
    const requestedUiSystem = String(form.get('uiSystem') ?? 'daisyui');
    if (!isDaisyTheme(requestedTheme) || !['daisyui', 'mosaic'].includes(requestedUiSystem)) {
      return fail(400, { settingsMessage: 'Choose a supported UI system and theme.' });
    }
    const db = await getCloudDb();
    await db.tx(async (tx) => {
      await tx.query(
        'UPDATE cloud_projects SET app_framework = $2, ui_system = $3, ui_theme = $4, updated_at = now() WHERE id = $1',
        [project.id, 'sveltekit', requestedUiSystem, requestedTheme],
      );
      await tx.query(
        `INSERT INTO cloud_audit_log (id, organization_id, user_id, action, target_type, target_id, metadata)
         VALUES ($1, $2, $3, 'project.settings.update', 'project', $4, $5::jsonb)`,
        [id(), project.organization_id, user.id, project.id, JSON.stringify({ appFramework: 'sveltekit', uiSystem: requestedUiSystem, uiTheme: requestedTheme })],
      );
    });
    return { settingsSaved: true, uiSystem: requestedUiSystem, uiTheme: requestedTheme };
  },
  iterate: async ({ params, request, locals }) => {
    if (!locals.user) throw redirect(303, '/login');
    const project = await projectFor(params.id, locals.user.id);
    if (!project) throw error(404, 'Project not found');
    const form = await request.formData();
    const prompt = String(form.get('prompt') ?? '').trim();
    if (prompt.length < 3) return fail(400, { message: 'Describe the change you want.' });
    const db = await getCloudDb();
    let conversation = await db.query<{ id: string }>('SELECT id FROM cloud_conversations WHERE project_id = $1 ORDER BY created_at LIMIT 1', [project.id]);
    if (!conversation.rows[0]) {
      await db.query('INSERT INTO cloud_conversations (id, project_id) VALUES ($1, $2)', [id(), project.id]);
      conversation = await db.query<{ id: string }>('SELECT id FROM cloud_conversations WHERE project_id = $1 ORDER BY created_at LIMIT 1', [project.id]);
    }
    await db.tx(async (tx) => {
      await tx.query('INSERT INTO cloud_messages (id, conversation_id, role, content) VALUES ($1, $2, $3, $4)', [id(), conversation.rows[0]!.id, 'user', prompt]);
      await tx.query(
        `INSERT INTO cloud_jobs (id, project_id, kind, status, progress, stage, metadata)
         VALUES ($1, $2, 'generate', 'queued', 0, 'Waiting for isolated workspace', $3::jsonb)`,
        [id(), project.id, JSON.stringify({ source: 'conversation' })],
      );
      await tx.query('UPDATE cloud_projects SET status = $2, updated_at = now() WHERE id = $1', [project.id, 'queued']);
      await tx.query(
        `INSERT INTO cloud_audit_log (id, organization_id, user_id, action, target_type, target_id)
         VALUES ($1, $2, $3, 'generation.queue', 'project', $4)`,
        [id(), project.organization_id, locals.user!.id, project.id],
      );
    });
    return { queued: true };
  },
};
