import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getCloudDb, id } from '#lib/server/db';
import { isDaisyTheme } from '#lib/themes';
import type { ProjectBlueprint } from '#lib/server/groq';
import { enqueueJob, kickJobs } from '#lib/server/jobs';

async function projectFor(projectId: string, userId: string) {
  const db = await getCloudDb();
  const result = await db.query<{
    id: string; organization_id: string; name: string; slug: string; prompt: string; status: string;
    include_home: boolean; include_login: boolean; app_framework: string; ui_system: string; ui_theme: string;
    blueprint: ProjectBlueprint | null; planner_model: string | null; planned_at: string | null;
    github_repository: string | null; vercel_project_id: string | null; neon_project_id: string | null;
  }>(
    // Explicit columns: this row is sent to the browser, and database_secret must never be.
    `SELECT project.id, project.organization_id, project.name, project.slug, project.prompt, project.status,
       project.include_home, project.include_login, project.app_framework, project.ui_system, project.ui_theme,
       project.blueprint, project.planner_model, project.planned_at, project.github_repository,
       project.vercel_project_id, project.neon_project_id
     FROM cloud_projects project
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
  const [environments, jobs, messages, releases] = await Promise.all([
    db.query<{ id: string; name: string; kind: string; status: string; url: string | null }>('SELECT id, name, kind, status, url FROM cloud_environments WHERE project_id = $1 ORDER BY kind DESC', [project.id]),
    db.query<{ id: string; kind: string; status: string; progress: number; stage: string | null; error: string | null; created_at: string; started_at: string | null; run_after: string; log: Array<{ at: string; message: string }> }>('SELECT id, kind, status, progress, stage, error, created_at, started_at, run_after, log FROM cloud_jobs WHERE project_id = $1 ORDER BY created_at DESC LIMIT 20', [project.id]),
    db.query<{ id: string; role: string; content: string; created_at: string }>(
      `SELECT message.id, message.role, message.content, message.created_at
       FROM cloud_messages message JOIN cloud_conversations conversation ON conversation.id = message.conversation_id
       WHERE conversation.project_id = $1 ORDER BY message.created_at`, [project.id],
    ),
    db.query<{ id: string; version: number; status: string; checksum: string; file_count: number; created_at: string }>('SELECT id, version, status, checksum, file_count, created_at FROM cloud_releases WHERE project_id = $1 ORDER BY version DESC LIMIT 10', [project.id]),
  ]);
  // Reopening the builder resumes work no runner picked up (e.g. after a function was recycled).
  // Only overdue/stalled jobs count: the page polls every 2s and must not start a runner per poll.
  const now = Date.now();
  if (jobs.rows.some((job) => (job.status === 'queued' && now - new Date(job.run_after).getTime() > 30_000) || (job.status === 'running' && now - new Date(job.started_at ?? job.created_at).getTime() > 10 * 60_000))) kickJobs();
  return { project, environments: environments.rows, jobs: jobs.rows, messages: messages.rows, releases: releases.rows };
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
      // The built-in preview reads these settings live; the job carries them into source, Git and Vercel.
      const changed = requestedTheme !== project.ui_theme || requestedUiSystem !== project.ui_system;
      if (changed && project.blueprint) await enqueueJob(tx, { projectId: project.id, kind: 'generate', metadata: { reuseBlueprint: true }, stage: 'Waiting to apply design settings' });
    });
    kickJobs();
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
      await enqueueJob(tx, { projectId: project.id, kind: 'generate', metadata: { prompt, revise: true }, stage: 'Waiting to plan the change' });
      await tx.query("UPDATE cloud_projects SET status = 'queued', updated_at = now() WHERE id = $1", [project.id]);
      await tx.query(
        `INSERT INTO cloud_audit_log (id, organization_id, user_id, action, target_type, target_id)
         VALUES ($1, $2, $3, 'generation.queue', 'project', $4)`,
        [id(), project.organization_id, locals.user!.id, project.id],
      );
    });
    kickJobs();
    return { queued: true };
  },
  retry: async ({ params, request, locals }) => {
    if (!locals.user) throw redirect(303, '/login');
    const project = await projectFor(params.id, locals.user.id);
    if (!project) throw error(404, 'Project not found');
    const jobId = String((await request.formData()).get('jobId') ?? '');
    const db = await getCloudDb();
    const retried = await db.query(
      "UPDATE cloud_jobs SET status = 'queued', attempts = 0, error = NULL, finished_at = NULL, run_after = now(), stage = 'Queued for retry' WHERE id = $1 AND project_id = $2 AND status = 'failed' RETURNING id",
      [jobId, project.id],
    );
    if (!retried.rows.length) return fail(404, { message: 'That job cannot be retried.' });
    await db.query("UPDATE cloud_projects SET status = 'queued', updated_at = now() WHERE id = $1", [project.id]);
    kickJobs();
    return { queued: true };
  },
};
